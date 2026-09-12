"""
Senha, sessão, assinatura do certificado e token de check-in.

Quatro mecanismos independentes, de propósito: cada um tem seu próprio segredo,
para que comprometer um não comprometa os outros.

| Mecanismo        | Segredo             | Protege contra                        |
|------------------|---------------------|---------------------------------------|
| Senha            | (hash próprio)      | Vazamento do banco                    |
| Access token     | `jwt_secret`        | Forjar identidade                     |
| Refresh token    | (hash no banco)     | Roubo de sessão persistente           |
| Assinatura       | `chave_assinatura`  | Escrita fraudulenta direto no banco   |
| Token de QR      | `checkin_secret`    | Registrar presença sem estar no local |
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import math
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, NamedTuple

import bcrypt
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)
from cryptography.exceptions import InvalidSignature

from app.core.config import config

_ph = PasswordHasher()
_PREFIXOS_BCRYPT = ("$2a$", "$2b$", "$2y$")


# ===================== Senhas =====================


def gerar_hash_senha(senha: str) -> str:
    """Argon2id — recomendação atual da OWASP (RNF-03)."""
    return _ph.hash(senha)


def conferir_senha(senha: str, hash_guardado: str) -> bool:
    """
    Aceita Argon2id e também bcrypt, este último só para contas herdadas do
    backend Node. O hash legado é convertido no primeiro login bem-sucedido.
    """
    if not hash_guardado:
        return False

    if hash_guardado.startswith(_PREFIXOS_BCRYPT):
        try:
            return bcrypt.checkpw(senha.encode(), hash_guardado.encode())
        except (ValueError, TypeError):
            return False

    try:
        return _ph.verify(hash_guardado, senha)
    except (VerifyMismatchError, InvalidHashError, ValueError):
        return False


def precisa_regravar(hash_guardado: str) -> bool:
    """True para hash bcrypt legado ou Argon2 com parâmetros defasados."""
    if not hash_guardado:
        return False
    if hash_guardado.startswith(_PREFIXOS_BCRYPT):
        return True
    try:
        return _ph.check_needs_rehash(hash_guardado)
    except (InvalidHashError, ValueError):
        return False


# ===================== Access token =====================


def criar_access_token(usuario_id: uuid.UUID | str, papel: str) -> tuple[str, int]:
    """
    Emite o access token. Retorna (token, segundos até expirar).

    O papel viaja no payload para que a checagem de permissão não precise ir ao
    banco em toda requisição.
    """
    agora = datetime.now(timezone.utc)
    duracao = timedelta(minutes=config.access_token_minutos)

    payload: dict[str, Any] = {
        "sub": str(usuario_id),
        "papel": papel,
        "tipo": "acesso",
        "iat": agora,
        "exp": agora + duracao,
        "jti": secrets.token_urlsafe(16),
    }
    token = jwt.encode(payload, config.jwt_secret, algorithm=config.jwt_algoritmo)
    return token, int(duracao.total_seconds())


def ler_access_token(token: str) -> dict[str, Any] | None:
    """Valida assinatura e expiração. Retorna o payload, ou None se inválido."""
    try:
        payload = jwt.decode(token, config.jwt_secret, algorithms=[config.jwt_algoritmo])
    except jwt.PyJWTError:
        return None
    if payload.get("tipo") != "acesso" or not payload.get("sub"):
        return None
    return payload


# ===================== Refresh token =====================


def gerar_refresh_token() -> str:
    """Token opaco, entregue ao cliente e nunca gravado em claro."""
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    """
    SHA-256 basta aqui, ao contrário de senha: o token tem 384 bits de entropia
    aleatória, então não há dicionário nem força bruta a temer. O hash precisa
    ser determinístico para permitir busca por igualdade.
    """
    return hashlib.sha256(token.encode()).hexdigest()


def expiracao_refresh() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=config.refresh_token_dias)


# ===================== Assinatura do certificado (D4) =====================


def gerar_par_de_chaves() -> tuple[str, str]:
    """Cria um par Ed25519. Retorna (privada_pem_b64, publica_pem)."""
    privada = Ed25519PrivateKey.generate()
    pem_privada = privada.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    pem_publica = privada.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return base64.b64encode(pem_privada).decode(), pem_publica.decode()


def _carregar_privada() -> Ed25519PrivateKey:
    if not config.chave_assinatura:
        raise RuntimeError(
            "chave_assinatura não configurada. "
            "Gere com: python -m app.cli gerar-chave"
        )
    pem = base64.b64decode(config.chave_assinatura)
    return serialization.load_pem_private_key(pem, password=None)


def chave_publica_pem() -> str:
    """PEM da chave pública, para auditoria independente."""
    return _carregar_privada().public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode()


def impressao_digital_chave() -> str:
    """Identifica a chave em uso sem expor nada dela."""
    return hashlib.sha256(chave_publica_pem().encode()).hexdigest()[:16]


def texto_canonico_certificado(
    codigo: str, nome_aluno: str, titulo_atividade: str,
    horas: int, emitido_em: datetime,
) -> str:
    """
    Monta o texto assinado. A ordem e o separador são parte do contrato: mudá-los
    invalida toda assinatura já emitida.

    Os valores vêm das colunas congeladas do certificado, nunca de junção — se
    a ONG mudar de nome depois, a assinatura continua conferindo.
    """
    return "|".join([
        codigo,
        nome_aluno,
        titulo_atividade,
        str(horas),
        emitido_em.astimezone(timezone.utc).isoformat(timespec="seconds"),
    ])


def assinar_certificado(texto: str) -> str:
    return base64.b64encode(_carregar_privada().sign(texto.encode())).decode()


def conferir_assinatura(texto: str, assinatura_b64: str) -> bool:
    """False quando o registro foi alterado depois da emissão (FV-01 E3)."""
    try:
        publica: Ed25519PublicKey = _carregar_privada().public_key()
        publica.verify(base64.b64decode(assinatura_b64), texto.encode())
        return True
    except (InvalidSignature, ValueError, TypeError, RuntimeError):
        return False


# ===================== Token de check-in (D31) =====================
#
# Derivado do tempo, nada é gravado. O servidor recalcula e compara, como nos
# aplicativos de código de banco. O "vale uma vez" não vem daqui: vem de a
# inscrição aceitar um único check-in.


def _janela_atual(agora: float | None = None) -> int:
    segundos = agora if agora is not None else time.time()
    return int(segundos // config.checkin_janela_segundos)


class TokenCheckin(NamedTuple):
    """
    Resultado da leitura de um token de QR.

    `motivo` distingue os casos que a tela precisa tratar de formas diferentes:
    um código vencido é o caso **comum** (o QR roda a cada 30 s), enquanto
    assinatura inválida é tentativa de forjar.
    """

    valido: bool
    atividade_id: uuid.UUID | None = None
    janela: int | None = None
    motivo: str | None = None


def _cru(dados: bytes) -> str:
    return base64.urlsafe_b64encode(dados).decode().rstrip("=")


def _decodificar(texto: str) -> bytes:
    return base64.urlsafe_b64decode(texto + "=" * (-len(texto) % 4))


def _assinatura(atividade_id: uuid.UUID | str, janela: int) -> bytes:
    if not config.checkin_secret:
        raise RuntimeError("checkin_secret não configurado")
    mensagem = f"{atividade_id}:{janela}".encode()
    return hmac.new(config.checkin_secret.encode(), mensagem, hashlib.sha256).digest()[:18]


def gerar_token_checkin(atividade_id: uuid.UUID | str, janela: int | None = None) -> str:
    """
    `MH1.<atividade>.<janela>.<assinatura>` — derivado do tempo, nada é gravado.

    O token carrega a atividade e a janela **em claro**, e não é problema: a
    assinatura é que impede forjar. Carregá-los é o que permite ao servidor
    responder "este código é de outra atividade" em vez de um "inválido" que não
    ajuda ninguém — e medir a idade exata do código em vez de só compará-lo com
    a janela vigente.
    """
    j = _janela_atual() if janela is None else janela
    identificador = uuid.UUID(str(atividade_id))
    return f"MH1.{_cru(identificador.bytes)}.{j}.{_cru(_assinatura(identificador, j))}"


def ler_token_checkin(token: str, agora: float | None = None) -> TokenCheckin:
    """
    Confere assinatura e validade, e diz **por que** recusou.

    A janela dura 30 s, mas o token continua aceito por uma folga depois que ela
    fecha: quem escaneia no último instante precisa de tempo para a requisição
    chegar. O limite é fixo e medido a partir do fim da janela, então nenhum
    código sobrevive além de `janela + graça` — 40 s no padrão.
    """
    partes = (token or "").split(".")
    if len(partes) != 4 or partes[0] != "MH1":
        return TokenCheckin(False, motivo="malformado")

    try:
        atividade_id = uuid.UUID(bytes=_decodificar(partes[1]))
        janela = int(partes[2])
        assinatura = _decodificar(partes[3])
    except (ValueError, TypeError):
        return TokenCheckin(False, motivo="malformado")

    # Confere a assinatura antes da validade: um token forjado não merece a
    # mensagem simpática de "código vencido".
    if not hmac.compare_digest(assinatura, _assinatura(atividade_id, janela)):
        return TokenCheckin(False, atividade_id=atividade_id, janela=janela,
                            motivo="assinatura_invalida")

    segundos = time.time() if agora is None else agora
    duracao = config.checkin_janela_segundos
    limite = (janela + 1) * duracao + config.checkin_graca_segundos

    if segundos >= limite:
        return TokenCheckin(False, atividade_id=atividade_id, janela=janela,
                            motivo="expirado")
    if janela > _janela_atual(segundos):
        # Janela no futuro: relógio adiantado ou token fabricado à frente.
        return TokenCheckin(False, atividade_id=atividade_id, janela=janela,
                            motivo="expirado")

    return TokenCheckin(True, atividade_id=atividade_id, janela=janela)


def segundos_ate_proximo_token() -> int:
    """
    Quanto falta para o QR trocar. Nunca devolve zero: arredondar para baixo no
    último instante da janela faria a contagem exibir "0s" e o cliente poderia
    não buscar o token seguinte.
    """
    janela = config.checkin_janela_segundos
    return max(1, math.ceil(janela - (time.time() % janela)))


def conferir_token_checkin(token: str, atividade_id: uuid.UUID | str) -> bool:
    """Atalho para quem já sabe de qual atividade o token deveria ser."""
    lido = ler_token_checkin(token)
    return lido.valido and str(lido.atividade_id) == str(atividade_id)


# ===================== Código de verificação =====================


def gerar_codigo_verificacao() -> str:
    """16 caracteres hexadecimais — o que vai dentro do QR do certificado."""
    return secrets.token_hex(8)

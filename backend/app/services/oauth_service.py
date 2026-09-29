"""
Entrada pelo Google (D41).

Fluxo: *authorization code* com PKCE. O navegador nunca vê token nenhum do
Google — o código volta para a nossa API, que o troca pelo `id_token` no
servidor, confere a assinatura do Google e só então abre a sessão normal do
Mais Horas. Do ponto de vista do resto do sistema, nada muda: sai o mesmo par
access token + refresh em cookie.

Duas travas que valem a leitura:

- **A identidade é (provedor, `sub`), não o e-mail.** O `sub` do Google é
  estável; o e-mail pode ser trocado, e num domínio corporativo pode até ser
  reatribuído a outra pessoa.
- **O e-mail precisa vir verificado pelo Google** (`email_verified`). Sem isso,
  qualquer pessoa que criasse uma conta Google com o e-mail de outra assumiria
  a conta dela aqui.
"""

from __future__ import annotations

import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from urllib.parse import urlencode

import httpx
import jwt
from fastapi import Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import auditoria
from app.core.config import config
from app.core.errors import ErroDeNegocio
from app.db.models import IdentidadeExterna, PerfilEstudante, PerfilOng, Usuario
from app.services import auth_service

PROVEDOR = "google"
AUTORIZACAO = "https://accounts.google.com/o/oauth2/v2/auth"
TROCA = "https://oauth2.googleapis.com/token"
CHAVES = "https://www.googleapis.com/oauth2/v3/certs"
EMISSORES = ("https://accounts.google.com", "accounts.google.com")

# O estado da ida ao Google vive num cookie curto: guardá-lo no banco criaria
# uma tabela de lixo que ninguém limpa.
MINUTOS_DE_IDA = 10
MINUTOS_DE_CADASTRO = 15


@dataclass
class Identidade:
    """O que o Google afirma sobre quem entrou."""

    sub: str
    email: str
    nome: str
    dominio: str | None

    @property
    def institucional(self) -> bool:
        alvo = config.dominio_institucional.strip().lower()
        return bool(alvo) and (self.dominio or "").lower() == alvo


def disponivel() -> bool:
    return bool(config.google_client_id and config.google_client_secret)


def _exigir_configuracao() -> None:
    if not disponivel():
        raise ErroDeNegocio(
            "google_indisponivel",
            "A entrada pelo Google não está configurada neste servidor",
            status.HTTP_503_SERVICE_UNAVAILABLE)


def _url_de_retorno() -> str:
    return f"{config.app_url.rstrip('/')}/api/v1/auth/google/retorno"


def _assinar(dados: dict, minutos: int) -> str:
    """Estado e cadastro pendente viajam em JWT nosso, dentro de cookie."""
    agora = datetime.now(timezone.utc)
    return jwt.encode({**dados, "iat": agora,
                       "exp": agora + timedelta(minutes=minutos)},
                      config.jwt_secret, algorithm=config.jwt_algoritmo)


def _ler(token: str | None, campos: tuple[str, ...]) -> dict:
    if not token:
        raise ErroDeNegocio("google_estado_invalido",
                            "A entrada pelo Google expirou. Tente de novo",
                            status.HTTP_400_BAD_REQUEST)
    try:
        dados = jwt.decode(token, config.jwt_secret,
                           algorithms=[config.jwt_algoritmo])
    except jwt.PyJWTError as erro:
        raise ErroDeNegocio("google_estado_invalido",
                            "A entrada pelo Google expirou. Tente de novo",
                            status.HTTP_400_BAD_REQUEST) from erro
    if any(campo not in dados for campo in campos):
        raise ErroDeNegocio("google_estado_invalido",
                            "A entrada pelo Google expirou. Tente de novo",
                            status.HTTP_400_BAD_REQUEST)
    return dados


def comecar() -> tuple[str, str]:
    """
    Devolve (url do Google, cookie de estado).

    O `state` protege contra CSRF e o PKCE contra o código ser interceptado e
    trocado por outra pessoa — os dois viajam no cookie, que o atacante não
    consegue forjar.
    """
    _exigir_configuracao()
    verificador = secrets.token_urlsafe(64)
    desafio = _cru(sha256(verificador.encode()).digest())
    estado = secrets.token_urlsafe(24)

    url = f"{AUTORIZACAO}?" + urlencode({
        "client_id": config.google_client_id,
        "redirect_uri": _url_de_retorno(),
        "response_type": "code",
        "scope": "openid email profile",
        "state": estado,
        "code_challenge": desafio,
        "code_challenge_method": "S256",
        "prompt": "select_account",
    })
    return url, _assinar({"estado": estado, "verificador": verificador},
                         MINUTOS_DE_IDA)


def _cru(dados: bytes) -> str:
    import base64

    return base64.urlsafe_b64encode(dados).decode().rstrip("=")


def ler_ida(cookie: str | None, estado_recebido: str) -> dict:
    """
    Confere o `state` que voltou do Google contra o que guardamos.

    É o que impede alguém de induzir a vítima a completar um login com a conta
    do atacante (CSRF de login): sem o cookie desta máquina, o retorno não vale.
    """
    dados = _ler(cookie, ("estado", "verificador"))
    if not secrets.compare_digest(dados["estado"], estado_recebido or ""):
        raise ErroDeNegocio("google_estado_invalido",
                            "A entrada pelo Google expirou. Tente de novo",
                            status.HTTP_400_BAD_REQUEST)
    return dados


async def identidade_do_codigo(codigo: str, verificador: str) -> Identidade:
    """Troca o código pelo `id_token` e confere a assinatura do Google."""
    async with httpx.AsyncClient(timeout=15) as http:
        resposta = await http.post(TROCA, data={
            "code": codigo,
            "client_id": config.google_client_id,
            "client_secret": config.google_client_secret,
            "redirect_uri": _url_de_retorno(),
            "grant_type": "authorization_code",
            "code_verifier": verificador,
        })
    if resposta.status_code != 200:
        raise ErroDeNegocio("google_recusou",
                            "O Google não confirmou esta entrada. Tente de novo",
                            status.HTTP_400_BAD_REQUEST)

    bruto = resposta.json().get("id_token")
    if not bruto:
        raise ErroDeNegocio("google_recusou",
                            "O Google não confirmou esta entrada. Tente de novo",
                            status.HTTP_400_BAD_REQUEST)
    return ler_id_token(bruto)


def ler_id_token(bruto: str) -> Identidade:
    """
    Valida o `id_token` contra as chaves públicas do Google.

    Aceitar o token sem conferir a assinatura seria aceitar qualquer JSON que
    alguém colasse aqui dizendo ser de quem quisesse.
    """
    try:
        chaves = jwt.PyJWKClient(CHAVES)
        chave = chaves.get_signing_key_from_jwt(bruto)
        dados = jwt.decode(bruto, chave.key, algorithms=["RS256"],
                           audience=config.google_client_id)
    except jwt.PyJWTError as erro:
        raise ErroDeNegocio("google_recusou",
                            "Não consegui validar a resposta do Google",
                            status.HTTP_400_BAD_REQUEST) from erro

    if dados.get("iss") not in EMISSORES:
        raise ErroDeNegocio("google_recusou", "Resposta do Google inesperada",
                            status.HTTP_400_BAD_REQUEST)
    if not dados.get("email") or not dados.get("email_verified"):
        raise ErroDeNegocio(
            "google_email_nao_verificado",
            "Esta conta Google não tem o e-mail verificado",
            status.HTTP_400_BAD_REQUEST)

    return Identidade(sub=str(dados["sub"]),
                      email=str(dados["email"]).strip().lower(),
                      nome=str(dados.get("name") or dados["email"].split("@")[0]),
                      dominio=dados.get("hd"))


# ===================== Entrada =====================


async def entrar(
    sessao: AsyncSession, identidade: Identidade, *, request: Request | None = None
) -> auth_service.Sessao | str:
    """
    Abre a sessão de quem já é conhecido, ou devolve um **cadastro pendente**.

    A conta nova não é criada aqui: falta escolher o papel, e criar antes disso
    deixaria contas sem dono definido se a pessoa desistisse na tela seguinte.
    """
    registro = await sessao.scalar(
        select(IdentidadeExterna).where(IdentidadeExterna.provedor == PROVEDOR,
                                        IdentidadeExterna.sub == identidade.sub))

    usuario = None
    if registro is not None:
        usuario = await sessao.get(Usuario, registro.usuario_id)
    else:
        # Mesmo e-mail, já cadastrado com senha: é a mesma pessoa, e o Google
        # acabou de provar que o e-mail é dela. Vincula em vez de recusar.
        usuario = await sessao.scalar(
            select(Usuario).where(Usuario.email == identidade.email))

    if usuario is None:
        return _assinar({"sub": identidade.sub, "email": identidade.email,
                         "nome": identidade.nome,
                         "dominio": identidade.dominio or ""},
                        MINUTOS_DE_CADASTRO)

    if usuario.situacao != "ativa":
        raise ErroDeNegocio("conta_suspensa",
                            "Esta conta está suspensa. Procure a administração",
                            status.HTTP_403_FORBIDDEN)

    if registro is None:
        sessao.add(IdentidadeExterna(
            usuario_id=usuario.id, provedor=PROVEDOR, sub=identidade.sub,
            email=identidade.email, dominio=identidade.dominio,
            ultimo_acesso_em=datetime.now(timezone.utc)))
        await auditoria.registrar(
            sessao, "conta.vinculada_google", ator_id=usuario.id,
            ator_papel=usuario.papel, entidade="usuario", entidade_id=usuario.id,
            depois={"dominio": identidade.dominio}, request=request)
    else:
        registro.ultimo_acesso_em = datetime.now(timezone.utc)
        registro.email = identidade.email
        registro.dominio = identidade.dominio

    resultado = await auth_service.abrir_sessao(sessao, usuario, request=request)
    await auditoria.registrar(
        sessao, "sessao.iniciada", ator_id=usuario.id, ator_papel=usuario.papel,
        entidade="usuario", entidade_id=usuario.id,
        depois={"origem": "google"}, request=request)
    await sessao.commit()
    await sessao.refresh(usuario)
    return resultado


async def concluir_cadastro(
    sessao: AsyncSession, pendente: str | None, papel: str, *,
    request: Request | None = None,
) -> auth_service.Sessao:
    """Cria a conta depois de a pessoa escolher o papel."""
    dados = _ler(pendente, ("sub", "email", "nome"))
    if papel not in ("estudante", "ong"):
        raise ErroDeNegocio("dados_invalidos", "Escolha estudante ou ONG")

    ja_existe = await sessao.scalar(
        select(IdentidadeExterna).where(IdentidadeExterna.provedor == PROVEDOR,
                                        IdentidadeExterna.sub == dados["sub"]))
    if ja_existe is not None:
        raise ErroDeNegocio("conta_ja_criada",
                            "Esta conta Google já está cadastrada. Entre de novo",
                            status.HTTP_409_CONFLICT)

    usuario = Usuario(nome=dados["nome"][:120], email=dados["email"],
                      senha_hash=None, papel=papel)
    sessao.add(usuario)
    await sessao.flush()
    sessao.add(PerfilEstudante(usuario_id=usuario.id) if papel == "estudante"
               else PerfilOng(usuario_id=usuario.id))
    sessao.add(IdentidadeExterna(
        usuario_id=usuario.id, provedor=PROVEDOR, sub=dados["sub"],
        email=dados["email"], dominio=dados.get("dominio") or None,
        ultimo_acesso_em=datetime.now(timezone.utc)))

    resultado = await auth_service.abrir_sessao(sessao, usuario, request=request)
    await auditoria.registrar(
        sessao, "conta.criada", ator_id=usuario.id, ator_papel=papel,
        entidade="usuario", entidade_id=usuario.id,
        depois={"origem": "google", "dominio": dados.get("dominio") or None},
        request=request)
    await sessao.commit()
    await sessao.refresh(usuario)
    return resultado


async def vinculo_institucional(sessao: AsyncSession,
                                usuario_id: uuid.UUID) -> str | None:
    """Domínio institucional da conta, quando ela entrou por um."""
    alvo = config.dominio_institucional.strip().lower()
    if not alvo:
        return None
    dominio = await sessao.scalar(
        select(IdentidadeExterna.dominio).where(
            IdentidadeExterna.usuario_id == usuario_id,
            IdentidadeExterna.provedor == PROVEDOR))
    return dominio if (dominio or "").lower() == alvo else None

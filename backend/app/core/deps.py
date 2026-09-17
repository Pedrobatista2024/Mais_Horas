"""
Dependências de autenticação e autorização.

Declaradas na assinatura da rota, não escondidas em middleware: assim o FastAPI
documenta sozinho quem exige token e qual papel cada rota pede, e não há como
esquecer a checagem.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Annotated

from fastapi import Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import auditoria
from app.core.errors import ErroDeNegocio
from app.core.security import ler_access_token
from app.db.models import TokenSessao, Usuario
from app.db.session import obter_sessao

Sessao = Annotated[AsyncSession, Depends(obter_sessao)]


def _extrair_token(request: Request) -> str:
    cabecalho = request.headers.get("authorization")
    if not cabecalho or not cabecalho.lower().startswith("bearer "):
        raise ErroDeNegocio("nao_autenticado", "Autenticação necessária",
                            status.HTTP_401_UNAUTHORIZED)
    token = cabecalho.split(" ", 1)[1].strip()
    if not token:
        raise ErroDeNegocio("nao_autenticado", "Autenticação necessária",
                            status.HTTP_401_UNAUTHORIZED)
    return token


@dataclass(frozen=True)
class Espelho:
    """Quem está observando, em nome de quem, e por qual sessão."""

    admin: Usuario
    alvo: Usuario
    sessao_id: uuid.UUID


METODOS_DE_LEITURA = ("GET", "HEAD", "OPTIONS")

# A única escrita permitida no modo espelho é sair dele.
ROTA_DE_SAIDA = "/admin/sair-do-modo"

# Consultas que o próprio layout faz sozinho, a cada minuto: registrá-las
# afogaria a trilha de navegação sem dizer nada sobre o que o admin olhou.
LEITURAS_AUTOMATICAS = ("/notificacoes/contador",)


def _expirado() -> ErroDeNegocio:
    return ErroDeNegocio("espelho_expirado",
                         "O modo \"entrar como\" terminou. Volte ao console.",
                         status.HTTP_401_UNAUTHORIZED)


async def _conferir_espelho(request: Request, sessao: AsyncSession, payload: dict,
                            alvo: Usuario) -> Espelho:
    """
    RN-29 a RN-31, conferidas **a cada requisição**, não só na entrada: se a
    sessão for encerrada, o admin suspenso ou o alvo promovido a admin no
    meio do caminho, o espelho morre na próxima chamada.
    """
    try:
        sessao_id = uuid.UUID(payload["sid"])
        admin_id = uuid.UUID(payload["adm"])
    except (KeyError, ValueError, TypeError):
        raise _expirado() from None

    registro = await sessao.get(TokenSessao, sessao_id)
    agora = datetime.now(timezone.utc)
    if (registro is None or registro.usuario_id != alvo.id
            or registro.em_nome_de != admin_id
            or registro.revogado_em is not None or registro.expira_em <= agora):
        raise _expirado()

    admin = await sessao.get(Usuario, admin_id)
    if (admin is None or admin.papel != "superadmin" or admin.situacao != "ativa"
            or alvo.papel == "superadmin"):
        raise _expirado()

    espelho = Espelho(admin=admin, alvo=alvo, sessao_id=sessao_id)
    request.state.espelho = espelho

    rota = request.url.path
    if request.method not in METODOS_DE_LEITURA:
        if not rota.endswith(ROTA_DE_SAIDA):
            raise ErroDeNegocio(
                "modo_somente_leitura",
                "Modo somente leitura: no \"entrar como\" nada pode ser alterado.",
                status.HTTP_403_FORBIDDEN)
    elif not rota.endswith(LEITURAS_AUTOMATICAS):
        # Registrado no servidor, e não pela tela: um admin mal-intencionado
        # não consegue pular o próprio rastro.
        await auditoria.registrar(
            sessao, "admin.navegou_como", ator_id=admin.id, ator_papel=admin.papel,
            em_nome_de_id=alvo.id, entidade="usuario", entidade_id=alvo.id,
            depois={"rota": rota, "consulta": str(request.url.query)[:300] or None},
            request=request)
        await sessao.commit()

    return espelho


async def usuario_atual(request: Request, sessao: Sessao) -> Usuario:
    """
    Valida o access token e devolve o usuário carregado do banco.

    No modo "entrar como", devolve o **alvo** — as telas mostram o que a pessoa
    vê — e deixa o admin em `request.state.espelho`.
    """
    request.state.espelho = None
    payload = ler_access_token(_extrair_token(request))
    if payload is None:
        raise ErroDeNegocio("sessao_invalida", "Sessão inválida ou expirada",
                            status.HTTP_401_UNAUTHORIZED)

    try:
        usuario_id = uuid.UUID(payload["sub"])
    except (ValueError, KeyError, TypeError):
        raise ErroDeNegocio("sessao_invalida", "Sessão inválida ou expirada",
                            status.HTTP_401_UNAUTHORIZED) from None

    usuario = await sessao.get(Usuario, usuario_id)
    if usuario is None:
        raise ErroDeNegocio("sessao_invalida", "Sessão inválida ou expirada",
                            status.HTTP_401_UNAUTHORIZED)
    if usuario.situacao != "ativa":
        raise ErroDeNegocio("conta_suspensa",
                            "Esta conta está suspensa. Fale com o suporte.",
                            status.HTTP_403_FORBIDDEN)
    if payload.get("espelho"):
        await _conferir_espelho(request, sessao, payload, usuario)
    return usuario


async def sessao_espelho(request: Request, usuario: "UsuarioAtual") -> Espelho:
    """Exige estar no modo "entrar como" — é a porta de saída dele."""
    espelho = getattr(request.state, "espelho", None)
    if espelho is None:
        raise ErroDeNegocio("fora_do_modo_espelho",
                            "Você não está no modo \"entrar como\"")
    return espelho


def em_modo_espelho(request: Request | None) -> bool:
    return bool(request is not None and getattr(request.state, "espelho", None))


UsuarioAtual = Annotated[Usuario, Depends(usuario_atual)]


def exigir_papel(*papeis: str):
    """Uso: `Depends(exigir_papel("ong"))`."""

    async def _guarda(usuario: UsuarioAtual) -> Usuario:
        if usuario.papel not in papeis:
            raise ErroDeNegocio("acesso_negado",
                                "Você não tem acesso a esta área",
                                status.HTTP_403_FORBIDDEN)
        return usuario

    return _guarda


Estudante = Annotated[Usuario, Depends(exigir_papel("estudante"))]
Ong = Annotated[Usuario, Depends(exigir_papel("ong"))]
Admin = Annotated[Usuario, Depends(exigir_papel("superadmin"))]
SessaoEspelho = Annotated[Espelho, Depends(sessao_espelho)]

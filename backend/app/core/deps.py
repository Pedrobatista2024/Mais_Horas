"""
Dependências de autenticação e autorização.

Declaradas na assinatura da rota, não escondidas em middleware: assim o FastAPI
documenta sozinho quem exige token e qual papel cada rota pede, e não há como
esquecer a checagem.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ErroDeNegocio
from app.core.security import ler_access_token
from app.db.models import Usuario
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


async def usuario_atual(request: Request, sessao: Sessao) -> Usuario:
    """Valida o access token e devolve o usuário carregado do banco."""
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
    return usuario


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

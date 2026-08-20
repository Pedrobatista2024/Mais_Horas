"""
Dependências de autenticação e autorização.

Substituem o `authMiddleware` e o `requireRole` do backend Node. A diferença é
que aqui elas são declaradas na assinatura da rota, então o FastAPI já
documenta quem exige token e quem exige papel.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.security import decode_access_token
from app.db.models import User
from app.db.session import get_db

DbSession = Annotated[AsyncSession, Depends(get_db)]


def _extract_bearer(request: Request) -> str:
    header = request.headers.get("authorization")
    if not header or not header.lower().startswith("bearer "):
        raise AppError("Token não fornecido", status.HTTP_401_UNAUTHORIZED)
    token = header.split(" ", 1)[1].strip()
    if not token:
        raise AppError("Token não fornecido", status.HTTP_401_UNAUTHORIZED)
    return token


async def get_current_user(request: Request, db: DbSession) -> User:
    """Valida o access token e devolve o usuário carregado do banco."""
    token = _extract_bearer(request)

    payload = decode_access_token(token)
    if payload is None:
        raise AppError("Token inválido", status.HTTP_401_UNAUTHORIZED)

    try:
        user_id = uuid.UUID(payload["sub"])
    except (ValueError, KeyError, TypeError):
        raise AppError("Token inválido", status.HTTP_401_UNAUTHORIZED) from None

    user = await db.get(User, user_id)
    if user is None:
        raise AppError("Usuário não encontrado", status.HTTP_404_NOT_FOUND)

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_role(*roles: str):
    """
    Exige que o usuário autenticado tenha um dos papéis informados.

    Uso: `Depends(require_role("organization"))`
    """

    async def _guard(user: CurrentUser) -> User:
        if user.role not in roles:
            raise AppError("Acesso negado para o seu perfil", status.HTTP_403_FORBIDDEN)
        return user

    return _guard


StudentUser = Annotated[User, Depends(require_role("student"))]
OrgUser = Annotated[User, Depends(require_role("organization"))]

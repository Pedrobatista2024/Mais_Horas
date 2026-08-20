"""Respostas de autenticação."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class SessionOut(BaseModel):
    """
    Payload de login/registro/refresh.

    `token` continua no corpo (o frontend guarda em memória). O refresh token
    NAO aparece aqui: ele viaja apenas no cookie httpOnly, fora do alcance de
    qualquer JavaScript da página.
    """

    message: str
    user: dict[str, Any]
    token: str
    expiresIn: int

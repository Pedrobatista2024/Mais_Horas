"""Schemas de notificação."""

from __future__ import annotations

from pydantic import BaseModel


class NotificacaoSaida(BaseModel):
    id: str
    tipo: str
    titulo: str
    mensagem: str
    link: str | None = None
    lida: bool
    criadoEm: str


class Contador(BaseModel):
    naoLidas: int


class MarcadasSaida(BaseModel):
    marcadas: int

"""Schemas de check-in e validação de presença."""

from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.inscricao import AlunoDaInscricao


class CheckinEntrada(BaseModel):
    """
    O corpo traz **só o token** — ele mesmo diz de qual atividade é.

    A geolocalização é opcional e é camada extra, nunca a defesa principal:
    coordenada de celular se falsifica, o que não vale para a assinatura.
    """

    model_config = ConfigDict(extra="forbid")

    token: str = Field(min_length=1, max_length=200)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)


class CheckinManualEntrada(BaseModel):
    model_config = ConfigDict(extra="forbid")

    inscricaoId: uuid.UUID


class PresencaEntrada(BaseModel):
    model_config = ConfigDict(extra="forbid")

    situacao: Literal["presente", "ausente"]


class DecisaoDePresenca(BaseModel):
    model_config = ConfigDict(extra="forbid")

    inscricaoId: uuid.UUID
    situacao: Literal["presente", "ausente"]


class PresencasEmLote(BaseModel):
    model_config = ConfigDict(extra="forbid")

    decisoes: list[DecisaoDePresenca] = Field(min_length=1, max_length=500)


class TokenDoPainel(BaseModel):
    token: str
    validoPor: int
    expiraEm: str


class LinhaDePresenca(BaseModel):
    inscricaoId: str
    aluno: AlunoDaInscricao
    situacao: str
    checkinEm: str | None = None
    checkinOrigem: str | None = None
    decidida: bool | None = None
    sugestao: str | None = None


class AtividadeDoPainel(BaseModel):
    id: str
    titulo: str
    situacao: str
    cargaHoraria: int | None = None


class PainelSaida(BaseModel):
    atividade: AtividadeDoPainel
    presentes: int
    inscritos: int
    itens: list[LinhaDePresenca]


class ValidacaoSaida(BaseModel):
    atividade: AtividadeDoPainel
    comCheckin: int
    semDecisao: int
    itens: list[LinhaDePresenca]


class CheckinSaida(BaseModel):
    inscricaoId: str
    atividade: dict
    checkinEm: str
    origem: str


class LoteSaida(BaseModel):
    alteradas: int


class FinalizacaoSaida(BaseModel):
    id: str
    situacao: str
    presentes: int
    ausentes: int
    certificadosEmitidos: int
    cargaHoraria: int

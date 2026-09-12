"""Schemas de inscrição."""

from __future__ import annotations

import uuid
from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class InscricaoEntrada(BaseModel):
    model_config = ConfigDict(extra="forbid")

    atividadeId: uuid.UUID


class AprovacaoEmLote(BaseModel):
    """
    A ONG manda **quais** inscrições aprovar, não "todas as pendentes".

    "Aprovar todas" aprova o que estava na tela. Se alguém se inscreveu entre o
    carregamento e o clique, essa pessoa fica de fora — e é o certo: a ONG não
    decidiu sobre quem ela não viu.
    """

    model_config = ConfigDict(extra="forbid")

    ids: list[uuid.UUID] = Field(min_length=1, max_length=200)


class AtividadeDaInscricao(BaseModel):
    """O que a tela do aluno precisa saber da atividade, sem buscá-la de novo."""

    id: str
    titulo: str
    data: date
    horaInicio: str
    horaFim: str
    local: str
    cidade: str | None
    cargaHoraria: int
    situacao: str
    ong: str


class AlunoDaInscricao(BaseModel):
    """
    O que a ONG vê de quem se inscreveu (`O5`).

    Só chega em listagem da própria atividade — o aluno nunca vê este bloco de
    outro aluno (RN-47).
    """

    id: str
    nome: str
    email: str
    curso: str | None = None
    instituicao: str | None = None
    foto: str | None = None


class InscricaoSaida(BaseModel):
    id: str
    situacao: str
    criadoEm: str
    respondidaEm: str | None = None
    canceladaEm: str | None = None
    podeCancelar: bool = False
    atividade: AtividadeDaInscricao | None = None
    aluno: AlunoDaInscricao | None = None


class ResultadoDoLote(BaseModel):
    """
    Um lote pode acertar umas e errar outras.

    Devolver só "ok" esconderia o aluno que cancelou no meio do caminho; devolver
    erro derrubaria as aprovações válidas. Então vai o placar.
    """

    aprovadas: int
    ignoradas: list[dict]

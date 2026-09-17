"""Saídas do portal público."""

from __future__ import annotations

from pydantic import BaseModel

from app.schemas.atividade import AtividadeSaida


class ResumoDoPortal(BaseModel):
    atividadesRealizadas: int
    atividadesAbertas: int
    horasCertificadas: int
    certificadosEmitidos: int
    estudantes: int
    ongs: int
    codigoDemonstracao: str | None


class OngDoPortal(BaseModel):
    id: str
    nome: str
    descricao: str | None
    cidade: str | None
    estado: str | None
    logo: str | None
    verificada: bool
    atividadesRealizadas: int
    atividadesAbertas: int


class PerfilPublicoDaOng(OngDoPortal):
    site: str | None
    instagram: str | None
    horasCertificadas: int
    desde: str
    proximasAtividades: list[AtividadeSaida]

"""Schemas de certificado."""

from __future__ import annotations

from datetime import date
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.comum import Pagina

class CertificadoSaida(BaseModel):
    id: str
    codigo: str
    aluno: str
    atividade: str
    atividadeId: str
    organizacao: str
    horas: int
    dataAtividade: date
    emitidoEm: str
    revogado: bool
    revogadoEm: str | None = None
    urlVerificacao: str


class PaginaDeCertificados(Pagina[CertificadoSaida]):
    """A lista de `E6` leva junto o total de horas válidas (RN-16)."""

    horasValidas: int = 0


class DadosVerificados(BaseModel):
    codigo: str
    aluno: str
    atividade: str
    organizacao: str
    horas: int
    dataAtividade: date
    emitidoEm: str
    revogado: bool
    revogadoEm: str | None = None
    urlVerificacao: str


class Selos(BaseModel):
    existe: bool
    naoRevogado: bool
    assinaturaConfere: bool


class VerificacaoSaida(BaseModel):
    """
    A resposta traz o texto pronto (RN-56). A tela exibe o que veio, e não
    monta mensagem genérica por conta própria.
    """

    valido: bool
    desfecho: str
    titulo: str
    mensagem: str
    selos: Selos
    certificado: DadosVerificados | None = None


class RevogacaoEntrada(BaseModel):
    """RN-34 — revogar exige motivo; ele aparece na verificação pública."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    motivo: str = Field(min_length=5, max_length=300)

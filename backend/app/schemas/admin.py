"""Schemas do console administrativo."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class MotivoObrigatorio(BaseModel):
    """Suspender, cancelar e forçar exigem motivo: ele vai para a trilha."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    motivo: str = Field(min_length=5, max_length=300)


class ForcarValidacao(MotivoObrigatorio):
    politica: Literal["checkin_presente", "todos_ausentes"]


class NovoAdmin(BaseModel):
    """RN-37 — criar admin exige reconfirmar a própria senha."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    nome: str = Field(min_length=2, max_length=120)
    email: EmailStr
    senhaAtual: str = Field(min_length=1, max_length=200)


class ResumoUsuario(BaseModel):
    id: str
    nome: str
    email: str
    papel: str
    situacao: str
    criadoEm: str | None = None
    ultimoAcesso: str | None = None


class SessaoAtiva(BaseModel):
    id: str
    ip: str | None = None
    dispositivo: str | None = None
    abertaEm: str | None = None
    expiraEm: str | None = None
    espelho: bool = False


class DetalheUsuario(ResumoUsuario):
    suspensoEm: str | None = None
    motivoSuspensao: str | None = None
    perfil: dict | None = None
    contagens: dict
    sessoesAtivas: list[SessaoAtiva]


class SuspensaoSaida(ResumoUsuario):
    atividadesCanceladas: int = 0


class OngAdmin(BaseModel):
    id: str
    nome: str
    email: str
    cnpj: str | None = None
    cidade: str | None = None
    situacao: str
    verificada: bool
    verificadaEm: str | None = None
    atividades: int
    voluntarios: int
    certificados: int
    criadoEm: str | None = None


class RegistroDeAuditoria(BaseModel):
    id: int
    ocorridoEm: str | None = None
    acao: str
    atorId: str | None = None
    atorNome: str | None = None
    atorPapel: str | None = None
    emNomeDeId: str | None = None
    emNomeDeNome: str | None = None
    entidade: str | None = None
    entidadeId: str | None = None
    antes: dict | None = None
    depois: dict | None = None
    ip: str | None = None
    userAgent: str | None = None


class Alerta(BaseModel):
    tipo: str
    gravidade: str
    quantidade: int
    mensagem: str
    link: str


class VisaoGeral(BaseModel):
    contas: dict
    atividades: dict
    certificados: dict
    checkinsUltimas24h: int
    saude: dict
    alertas: list[Alerta]


class Divergente(BaseModel):
    id: str
    codigo: str
    aluno: str
    atividade: str


class RelatorioDeIntegridade(BaseModel):
    verificadoEm: str
    total: int
    validos: int
    divergentes: list[Divergente]

"""Saídas dos painéis E1 e O1."""

from __future__ import annotations

from pydantic import BaseModel


class AtividadeDoDestaque(BaseModel):
    id: str
    titulo: str
    data: str
    horaInicio: str
    horaFim: str
    local: str


class Destaque(BaseModel):
    """A ação mais urgente do momento. `tipo` diz qual botão a tela mostra."""

    tipo: str
    titulo: str
    mensagem: str
    atividade: AtividadeDoDestaque | None = None
    quantidade: int | None = None


class PainelDoEstudante(BaseModel):
    horasValidadas: int
    certificados: int
    inscricoesAtivas: int
    limiteInscricoes: int
    proximaAtividade: AtividadeDoDestaque | None
    destaque: Destaque


class PainelDaOng(BaseModel):
    atividadesPublicadas: int
    voluntariosEngajados: int
    certificadosEmitidos: int
    inscricoesPendentes: int
    rascunhos: int
    aguardandoValidacao: int
    destaque: Destaque

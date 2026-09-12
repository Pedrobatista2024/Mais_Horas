"""Schemas de atividade."""

from __future__ import annotations

from datetime import date, time

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


def _horas_entre(inicio: time, fim: time) -> int:
    """
    Carga horária sugerida pela duração (RN-48).

    Arredonda para baixo: um evento de 3h40 sugere 3 horas, não 4. A ONG pode
    corrigir se houver motivo, mas o padrão nunca infla.
    """
    minutos = (fim.hour * 60 + fim.minute) - (inicio.hour * 60 + inicio.minute)
    return max(1, minutos // 60)


class _CamposAtividade(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    titulo: str = Field(min_length=1, max_length=40)
    descricao: str = Field(min_length=1, max_length=1500)
    local: str = Field(min_length=1, max_length=50)
    cidade: str | None = Field(default=None, max_length=80)
    estado: str | None = Field(default=None, max_length=80)
    data: date
    hora_inicio: time
    hora_fim: time
    carga_horaria: int | None = Field(default=None, gt=0, le=24)
    vagas_min: int = Field(default=1, ge=1)
    vagas_max: int = Field(default=20, ge=1)
    exige_aprovacao: bool = False

    @model_validator(mode="after")
    def _coerencia(self):
        if self.hora_fim <= self.hora_inicio:
            raise ValueError("O horário de término deve ser posterior ao de início")
        if self.vagas_max < self.vagas_min:
            raise ValueError("O máximo de vagas não pode ser menor que o mínimo")
        # Omitida, a carga vem do horário (RN-48).
        if self.carga_horaria is None:
            self.carga_horaria = _horas_entre(self.hora_inicio, self.hora_fim)
        return self


class AtividadeEntrada(_CamposAtividade):
    """Criação. A atividade nasce sempre como rascunho (D6)."""


class AtividadeEdicao(BaseModel):
    """
    Edição — todos opcionais.

    A coerência entre campos é verificada no service, que conhece os valores
    atuais: aqui só chega o que o cliente mandou.
    """

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    titulo: str | None = Field(default=None, min_length=1, max_length=40)
    descricao: str | None = Field(default=None, min_length=1, max_length=1500)
    local: str | None = Field(default=None, min_length=1, max_length=50)
    cidade: str | None = Field(default=None, max_length=80)
    estado: str | None = Field(default=None, max_length=80)
    data: date | None = None
    hora_inicio: time | None = None
    hora_fim: time | None = None
    carga_horaria: int | None = Field(default=None, gt=0, le=24)
    vagas_min: int | None = Field(default=None, ge=1)
    vagas_max: int | None = Field(default=None, ge=1)
    exige_aprovacao: bool | None = None


class MotivoEntrada(BaseModel):
    motivo: str | None = Field(default=None, max_length=300)


class OngResumo(BaseModel):
    id: str
    nome: str
    verificada: bool


class AtividadeSaida(BaseModel):
    """
    `situacao` já vem **calculada**: pode valer `em_andamento` mesmo com
    `publicada` gravado no banco (RN-54).

    `vagasOcupadas` é contagem, nunca a lista de nomes — o aluno não vê quem
    mais se inscreveu (RN-47).
    """

    id: str
    titulo: str
    descricao: str
    local: str
    cidade: str | None
    estado: str | None
    data: date
    horaInicio: str
    horaFim: str
    cargaHoraria: int
    vagasMin: int
    vagasMax: int
    vagasOcupadas: int
    vagasRestantes: int
    lotada: bool
    exigeAprovacao: bool
    situacao: str
    ong: OngResumo
    editadaPorAdminEm: str | None = None
    minhaInscricao: dict | None = None

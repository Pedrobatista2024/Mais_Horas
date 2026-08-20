"""Schemas de atividade e presença."""

from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

DATE_PATTERN = r"^\d{4}-\d{2}-\d{2}$"
TIME_PATTERN = r"^([01]\d|2[0-3]):[0-5]\d$"


class CreateActivityIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=40)
    description: str = Field(min_length=1, max_length=1500)
    location: str = Field(min_length=1, max_length=50)
    date: str = Field(pattern=DATE_PATTERN)
    startTime: str = Field(pattern=TIME_PATTERN)
    endTime: str = Field(pattern=TIME_PATTERN)
    workloadHours: int = Field(gt=0)
    minParticipants: int = Field(default=1, ge=1)
    maxParticipants: int = Field(default=20, ge=1)

    @model_validator(mode="after")
    def _check_consistency(self) -> "CreateActivityIn":
        # Comparação lexicográfica funciona porque o formato é HH:MM zero-padded.
        if self.startTime >= self.endTime:
            raise ValueError("A hora de início deve ser menor que a de fim")
        if self.maxParticipants < self.minParticipants:
            raise ValueError("Máximo de participantes não pode ser menor que o mínimo")
        return self


class UpdateActivityIn(BaseModel):
    """Mesmos campos, todos opcionais. Sem checagem cruzada — o service decide."""

    model_config = ConfigDict(str_strip_whitespace=True)

    title: str | None = Field(default=None, min_length=1, max_length=40)
    description: str | None = Field(default=None, min_length=1, max_length=1500)
    location: str | None = Field(default=None, min_length=1, max_length=50)
    date: str | None = Field(default=None, pattern=DATE_PATTERN)
    startTime: str | None = Field(default=None, pattern=TIME_PATTERN)
    endTime: str | None = Field(default=None, pattern=TIME_PATTERN)
    workloadHours: int | None = Field(default=None, gt=0)
    minParticipants: int | None = Field(default=None, ge=1)
    maxParticipants: int | None = Field(default=None, ge=1)


class AttendanceIn(BaseModel):
    userId: uuid.UUID
    status: Literal["present", "absent"]

    @field_validator("status", mode="before")
    @classmethod
    def _check_status(cls, v: object) -> object:
        if v not in ("present", "absent"):
            raise ValueError("Status inválido")
        return v

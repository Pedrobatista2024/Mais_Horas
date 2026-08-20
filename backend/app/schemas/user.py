"""Schemas de usuário — equivalentes aos validators zod do backend Node."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

Role = Literal["student", "organization"]


class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=100)
    role: Role = "student"

    @field_validator("name", mode="before")
    @classmethod
    def _strip_name(cls, v: object) -> object:
        return v.strip() if isinstance(v, str) else v

    @field_validator("email", mode="before")
    @classmethod
    def _normalize_email(cls, v: object) -> object:
        return v.strip().lower() if isinstance(v, str) else v


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)

    @field_validator("email", mode="before")
    @classmethod
    def _normalize_email(cls, v: object) -> object:
        return v.strip().lower() if isinstance(v, str) else v


class UpdateProfileIn(BaseModel):
    """
    Atualização de perfil: qualquer subconjunto dos campos.

    Chega por multipart quando há foto. Campos extras são ignorados em vez de
    rejeitados, mantendo o comportamento `passthrough` do schema zod original.
    """

    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=2, max_length=120)

    # ===== Aluno =====
    fullName: str | None = Field(default=None, max_length=120)
    sex: str | None = Field(default=None, max_length=30)
    birthDate: str | None = None
    phone: str | None = Field(default=None, max_length=30)
    city: str | None = Field(default=None, max_length=80)
    state: str | None = Field(default=None, max_length=80)
    neighborhood: str | None = Field(default=None, max_length=80)
    institution: str | None = Field(default=None, max_length=120)
    courseName: str | None = Field(default=None, max_length=120)
    aboutMe: str | None = Field(default=None, max_length=1000)
    linkedin: str | None = Field(default=None, max_length=200)
    photoUrl: str | None = Field(default=None, max_length=500)

    # ===== ONG =====
    organizationName: str | None = Field(default=None, max_length=120)
    cnpj: str | None = Field(default=None, max_length=30)
    description: str | None = Field(default=None, max_length=1000)
    website: str | None = Field(default=None, max_length=200)
    instagram: str | None = Field(default=None, max_length=200)
    address: str | None = Field(default=None, max_length=200)

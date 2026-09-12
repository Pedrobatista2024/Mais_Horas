"""Schemas de perfil."""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _vazio_vira_nulo(v: object) -> object:
    """Campo apagado pelo usuário chega como string vazia; guardar nulo."""
    if isinstance(v, str):
        limpo = v.strip()
        return limpo or None
    return v


class PerfilEstudanteEntrada(BaseModel):
    """Todos opcionais: o perfil é preenchido aos poucos."""

    model_config = ConfigDict(extra="forbid")

    nome_completo: str | None = Field(default=None, max_length=120)
    instituicao: str | None = Field(default=None, max_length=120)
    curso: str | None = Field(default=None, max_length=120)
    sexo: str | None = Field(default=None, max_length=30)
    data_nascimento: date | None = None
    telefone: str | None = Field(default=None, max_length=30)
    cidade: str | None = Field(default=None, max_length=80)
    estado: str | None = Field(default=None, max_length=80)
    bairro: str | None = Field(default=None, max_length=80)
    sobre_mim: str | None = Field(default=None, max_length=1000)
    linkedin: str | None = Field(default=None, max_length=200)

    @field_validator("*", mode="before")
    @classmethod
    def _limpar(cls, v: object) -> object:
        return _vazio_vira_nulo(v)


class PerfilOngEntrada(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nome_organizacao: str | None = Field(default=None, max_length=120)
    cnpj: str | None = Field(default=None, max_length=30)
    descricao: str | None = Field(default=None, max_length=1000)
    telefone: str | None = Field(default=None, max_length=30)
    site: str | None = Field(default=None, max_length=200)
    instagram: str | None = Field(default=None, max_length=200)
    endereco: str | None = Field(default=None, max_length=200)
    cidade: str | None = Field(default=None, max_length=80)
    estado: str | None = Field(default=None, max_length=80)

    @field_validator("*", mode="before")
    @classmethod
    def _limpar(cls, v: object) -> object:
        return _vazio_vira_nulo(v)


class NomeEntrada(BaseModel):
    """O nome de exibição vive em `usuarios`, não no perfil."""

    nome: str | None = Field(default=None, min_length=2, max_length=120)


class PerfilSaida(BaseModel):
    """
    Resposta de `GET /perfil`.

    `perfilCompleto` só aparece para estudante — é o que a interface consulta
    para decidir se libera a inscrição ou manda preencher antes (RN-13).
    `camposFaltantes` diz quais, para a tela poder destacá-los.
    """

    id: str
    nome: str
    email: str
    papel: str
    perfil: dict
    perfilCompleto: bool | None = None
    camposFaltantes: list[str] | None = None


class PerfilPublicoSaida(BaseModel):
    id: str
    nome: str
    papel: str
    perfil: dict

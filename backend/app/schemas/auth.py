"""Schemas de autenticação."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

Papel = Literal["estudante", "ong"]  # superadmin nunca entra por aqui (RN-27)

SENHA_MINIMA = 8


class CadastroEntrada(BaseModel):
    nome: str = Field(min_length=2, max_length=120)
    email: EmailStr
    senha: str = Field(min_length=SENHA_MINIMA, max_length=200)
    papel: Papel

    @field_validator("nome", mode="before")
    @classmethod
    def _limpar_nome(cls, v: object) -> object:
        return v.strip() if isinstance(v, str) else v

    @field_validator("email", mode="before")
    @classmethod
    def _normalizar_email(cls, v: object) -> object:
        return v.strip().lower() if isinstance(v, str) else v


class LoginEntrada(BaseModel):
    email: EmailStr
    senha: str = Field(min_length=1)

    @field_validator("email", mode="before")
    @classmethod
    def _normalizar_email(cls, v: object) -> object:
        return v.strip().lower() if isinstance(v, str) else v


class EsqueciSenhaEntrada(BaseModel):
    email: EmailStr

    @field_validator("email", mode="before")
    @classmethod
    def _normalizar_email(cls, v: object) -> object:
        return v.strip().lower() if isinstance(v, str) else v


class RedefinirSenhaEntrada(BaseModel):
    token: str = Field(min_length=1)
    senha: str = Field(min_length=SENHA_MINIMA, max_length=200)


class UsuarioSessao(BaseModel):
    """Dados do usuário devolvidos na sessão. Sem `_id` (D29) e sem senha."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    nome: str
    email: str
    papel: str


class SessaoSaida(BaseModel):
    """
    Resposta de cadastro, login e renovação.

    O refresh token **não aparece aqui** — vai apenas no cookie httpOnly
    (RNF-05), fora do alcance de qualquer script da página.
    """

    usuario: UsuarioSessao
    token: str
    expiraEm: int


class MensagemSaida(BaseModel):
    mensagem: str

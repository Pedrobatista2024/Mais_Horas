"""Schemas compartilhados entre os módulos."""

from __future__ import annotations

from typing import Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class Pagina(BaseModel, Generic[T]):
    """Formato único de listagem (D37) — o frontend trata um só."""

    itens: list[T]
    pagina: int
    tamanho: int
    total: int
    paginas: int

    @classmethod
    def montar(cls, itens: list[T], total: int, pagina: int, tamanho: int) -> "Pagina[T]":
        paginas = (total + tamanho - 1) // tamanho if tamanho else 0
        return cls(itens=itens, pagina=pagina, tamanho=tamanho,
                   total=total, paginas=paginas)


class ParametrosPagina(BaseModel):
    pagina: int = Field(default=1, ge=1)
    tamanho: int = Field(default=20, ge=1, le=100)

    @property
    def deslocamento(self) -> int:
        return (self.pagina - 1) * self.tamanho

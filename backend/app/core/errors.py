"""
Erro de negócio e handlers centrais.

Formato único: `{ codigo, mensagem, detalhes? }`.

O `codigo` é estável e legível por máquina — o frontend decide o que fazer por
ele, nunca comparando o texto da mensagem. Melhorar uma frase não pode quebrar
a lógica de quem consome a API.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("mais_horas")


class ErroDeNegocio(Exception):
    """Lançado pelos services. Nunca montar resposta de erro no router."""

    def __init__(
        self,
        codigo: str,
        mensagem: str,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        detalhes: Any = None,
    ) -> None:
        super().__init__(mensagem)
        self.codigo = codigo
        self.mensagem = mensagem
        self.status_code = status_code
        self.detalhes = detalhes


def _corpo(codigo: str, mensagem: str, detalhes: Any = None) -> dict[str, Any]:
    corpo: dict[str, Any] = {"codigo": codigo, "mensagem": mensagem}
    if detalhes:
        corpo["detalhes"] = detalhes
    return corpo


# Traduz o código de erro do Postgres para a resposta da API.
_SQLSTATE = {
    "23505": ("registro_duplicado", "Este registro já existe", status.HTTP_409_CONFLICT),
    "23503": ("referencia_invalida", "Registro relacionado não encontrado",
              status.HTTP_400_BAD_REQUEST),
    "23514": ("dados_invalidos", "Os dados violam uma regra do sistema",
              status.HTTP_400_BAD_REQUEST),
}


def registrar_handlers(app: FastAPI) -> None:
    @app.exception_handler(ErroDeNegocio)
    async def _negocio(_: Request, exc: ErroDeNegocio) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_corpo(exc.codigo, exc.mensagem, exc.detalhes),
        )

    @app.exception_handler(RequestValidationError)
    async def _validacao(_: Request, exc: RequestValidationError) -> JSONResponse:
        detalhes = []
        for erro in exc.errors():
            partes = [str(p) for p in erro["loc"] if p not in ("body", "query", "path")]
            detalhes.append({
                "campo": ".".join(partes) or "corpo",
                "mensagem": erro.get("msg", "Valor inválido"),
            })
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=_corpo("dados_invalidos", "Dados inválidos", detalhes),
        )

    @app.exception_handler(IntegrityError)
    async def _integridade(_: Request, exc: IntegrityError) -> JSONResponse:
        estado = getattr(getattr(exc, "orig", None), "sqlstate", None)
        codigo, mensagem, http = _SQLSTATE.get(
            estado, ("erro_interno", "Erro interno no servidor",
                     status.HTTP_500_INTERNAL_SERVER_ERROR)
        )
        if http >= 500:
            log.exception("Violação de integridade não mapeada", exc_info=exc)
        return JSONResponse(status_code=http, content=_corpo(codigo, mensagem))

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        mapa = {
            status.HTTP_404_NOT_FOUND: ("nao_encontrado", "Recurso não encontrado"),
            status.HTTP_405_METHOD_NOT_ALLOWED: ("metodo_nao_permitido",
                                                 "Método não permitido"),
            status.HTTP_401_UNAUTHORIZED: ("nao_autenticado", "Autenticação necessária"),
            status.HTTP_403_FORBIDDEN: ("acesso_negado", "Acesso negado"),
        }
        codigo, padrao = mapa.get(exc.status_code, ("erro", "Erro na requisição"))
        mensagem = exc.detail if isinstance(exc.detail, str) and exc.detail not in (
            "Not Found", "Method Not Allowed", "Forbidden", "Unauthorized"
        ) else padrao
        return JSONResponse(status_code=exc.status_code, content=_corpo(codigo, mensagem))

    @app.exception_handler(Exception)
    async def _inesperado(_: Request, exc: Exception) -> JSONResponse:
        # O detalhe real fica no log do servidor, nunca na resposta.
        log.exception("Erro não tratado", exc_info=exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_corpo("erro_interno", "Erro interno no servidor"),
        )

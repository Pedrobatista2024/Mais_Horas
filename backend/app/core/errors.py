"""
Erro de negócio e handlers centrais.

Mantém o mesmo contrato de resposta do backend Node: todo erro sai como
`{ "message": ..., "details"?: [...] }`, para o frontend não precisar mudar.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppError(Exception):
    """Erro de negócio com status HTTP, lançado pelos services."""

    def __init__(
        self,
        message: str,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        details: Any = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details


def _payload(message: str, details: Any = None) -> dict[str, Any]:
    body: dict[str, Any] = {"message": message}
    if details:
        body["details"] = details
    return body


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_payload(exc.message, exc.details),
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        """
        Traduz o erro do Pydantic para o mesmo formato que o zod produzia:
        lista de { field, message }.
        """
        details = []
        for err in exc.errors():
            # loc vem como ("body", "campo") — descarta a origem
            parts = [str(p) for p in err["loc"] if p not in ("body", "query", "path")]
            details.append(
                {
                    "field": ".".join(parts) or "corpo",
                    "message": err.get("msg", "Valor inválido"),
                }
            )
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=_payload("Dados inválidos", details),
        )

    @app.exception_handler(IntegrityError)
    async def _integrity_error(_: Request, exc: IntegrityError) -> JSONResponse:
        """Violação de UNIQUE no Postgres (23505) vira 409, como antes."""
        code = getattr(getattr(exc, "orig", None), "sqlstate", None)
        if code == "23505":
            return JSONResponse(
                status_code=status.HTTP_409_CONFLICT,
                content=_payload("Registro já existe"),
            )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_payload("Erro interno no servidor"),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        detail = exc.detail
        message = detail if isinstance(detail, str) else "Erro na requisição"
        if exc.status_code == status.HTTP_404_NOT_FOUND and message == "Not Found":
            message = "Rota não encontrada"
        return JSONResponse(status_code=exc.status_code, content=_payload(message))

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        # O detalhe real fica no log do servidor, nunca na resposta.
        import logging

        logging.getLogger("mais_horas").exception("Erro não tratado", exc_info=exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_payload("Erro interno no servidor"),
        )

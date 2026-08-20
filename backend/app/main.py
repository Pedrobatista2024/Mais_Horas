"""
Ponto de entrada da API Mais Horas.

Equivalente ao server.js do backend Node: checagem de ambiente, segurança,
CORS, arquivos estáticos, rotas e tratamento central de erro.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.core.errors import register_error_handlers
from app.db.session import engine
from app.routers import activities, certificates, dashboard, participations, users

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mais_horas")

# ===== Checagens de ambiente =====
if not settings.jwt_secret:
    raise SystemExit(
        "JWT_SECRET não definido. Configure no .env antes de iniciar."
    )

if settings.is_production and not settings.cors_origins:
    raise SystemExit(
        "CORS_ORIGIN não definido em produção. Defina a URL do frontend antes de subir."
    )


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Equivalente enxuto ao helmet do Express."""

    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault(
            "Cross-Origin-Resource-Policy", "cross-origin"
        )
        response.headers.setdefault(
            "Permissions-Policy", "geolocation=(), microphone=(), camera=()"
        )
        if settings.is_production:
            response.headers.setdefault(
                "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
            )
        return response


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("API Mais Horas iniciando (ambiente: %s)", settings.environment)
    yield
    await engine.dispose()
    logger.info("Conexões do banco encerradas.")


app = FastAPI(
    title="Mais Horas API",
    description=(
        "API da plataforma que conecta estudantes e ONGs para horas de extensão, "
        "com certificado validável por QR Code."
    ),
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ===== Segurança =====
app.add_middleware(SecurityHeadersMiddleware)

# CORS: em produção exige lista explícita (checada no boot); em dev libera tudo.
# `allow_credentials` é obrigatório para o cookie de refresh atravessar origens.
if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=".*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# ===== Erros =====
register_error_handlers(app)

# ===== Uploads estáticos =====
upload_path = Path(settings.upload_dir)
upload_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=upload_path), name="uploads")


# ===== Rotas de serviço =====
@app.get("/", tags=["servico"])
async def root() -> dict[str, str]:
    return {"message": "API Mais Horas rodando e conectada ao PostgreSQL!"}


@app.get("/health", tags=["servico"])
async def health() -> dict[str, str]:
    return {"status": "ok"}


# ===== Rotas de negócio =====
app.include_router(users.router, prefix="/api")
app.include_router(activities.router, prefix="/api")
app.include_router(participations.router, prefix="/api")
app.include_router(certificates.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")

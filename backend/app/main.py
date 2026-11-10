"""
Ponto de entrada da API Mais Horas.

As rotas entram fatia a fatia, conforme docs/plano-execucao.md.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import config
from app.core.errors import ErroDeNegocio, registrar_handlers
from app.core.metricas import MedirRequisicoes
from app.db.session import engine
from app.routers import (
    admin, atividades, auth, certificados, checkin, inscricoes, notificacoes,
    painel, perfil, portal,
)

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("mais_horas")

PREFIXO = "/api/v1"

# ===== Checagens de ambiente =====
# Falhar no boot é melhor que descobrir em produção que o segredo não existe.

if not config.jwt_secret:
    raise SystemExit(
        "JWT_SECRET não definido. Gere com: python -m app.cli gerar-segredos"
    )

if not config.checkin_secret:
    raise SystemExit(
        "CHECKIN_SECRET não definido. Gere com: python -m app.cli gerar-segredos"
    )

if config.producao:
    if not config.cors_origens:
        raise SystemExit(
            "CORS_ORIGIN não definido em produção. Informe a URL do frontend."
        )
    if not config.chave_assinatura:
        raise SystemExit(
            "CHAVE_ASSINATURA não definida. Sem ela não há como emitir certificado. "
            "Gere com: python -m app.cli gerar-chave"
        )


class CabecalhosDeSeguranca(BaseHTTPMiddleware):
    """Equivalente enxuto ao helmet do Express."""

    async def dispatch(self, request, call_next):
        resposta = await call_next(request)
        resposta.headers.setdefault("X-Content-Type-Options", "nosniff")
        resposta.headers.setdefault("X-Frame-Options", "DENY")
        resposta.headers.setdefault("Referrer-Policy", "no-referrer")
        resposta.headers.setdefault("Cross-Origin-Resource-Policy", "cross-origin")
        resposta.headers.setdefault(
            "Permissions-Policy", "geolocation=(), microphone=(), camera=()"
        )
        if config.producao:
            resposta.headers.setdefault(
                "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
            )
        return resposta


@asynccontextmanager
async def ciclo_de_vida(_: FastAPI):
    log.info("API Mais Horas iniciando (ambiente: %s)", config.ambiente)
    if not config.chave_assinatura:
        log.warning(
            "CHAVE_ASSINATURA ausente — emissão de certificado indisponível. "
            "Gere com: python -m app.cli gerar-chave"
        )
    yield
    await engine.dispose()
    log.info("Conexões do banco encerradas.")


app = FastAPI(
    title="Mais Horas API",
    description=(
        "API da plataforma que conecta estudantes e ONGs para horas de extensão, "
        "com certificado verificável por QR Code."
    ),
    version="1.0.0",
    lifespan=ciclo_de_vida,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(CabecalhosDeSeguranca)

# `allow_credentials` é obrigatório para o cookie de refresh atravessar origens.
# Em produção a lista explícita é exigida no boot; fora dela, libera para o dev.
if config.cors_origens:
    app.add_middleware(
        CORSMiddleware, allow_origins=config.cors_origens, allow_credentials=True,
        allow_methods=["*"], allow_headers=["*"],
        # Sem expor, o navegador esconde o nome do PDF de quem baixa por outra origem.
        expose_headers=["Content-Disposition"],
    )
else:
    app.add_middleware(
        CORSMiddleware, allow_origin_regex=".*", allow_credentials=True,
        allow_methods=["*"], allow_headers=["*"],
        # Sem expor, o navegador esconde o nome do PDF de quem baixa por outra origem.
        expose_headers=["Content-Disposition"],
    )

registrar_handlers(app)

# Por último: o middleware adicionado por último é o mais externo, e é de fora
# que dá para medir o tempo inteiro da requisição, CORS incluído.
app.add_middleware(MedirRequisicoes)

# Uploads servidos estaticamente. Em produção o disco é efêmero — ver
# docs/deploy.md.
pasta_uploads = Path(config.upload_dir)
pasta_uploads.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=pasta_uploads), name="uploads")


@app.get("/saude", tags=["servico"])
async def saude() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/metrics", include_in_schema=False)
async def metricas(request: Request) -> Response:
    """
    Coleta do Prometheus, pela rede interna do Docker.

    Quem chega com `X-Forwarded-For` passou por um proxy, e o Prometheus não
    passa: a resposta é a mesma de uma rota que não existe.
    """
    if "x-forwarded-for" in request.headers:
        raise ErroDeNegocio("nao_encontrado", "Recurso não encontrado",
                            status.HTTP_404_NOT_FOUND)
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


# ===== Rotas de negócio =====
app.include_router(auth.router, prefix=PREFIXO)
app.include_router(perfil.router, prefix=PREFIXO)
app.include_router(atividades.router, prefix=PREFIXO)
app.include_router(inscricoes.router, prefix=PREFIXO)
app.include_router(checkin.router, prefix=PREFIXO)
app.include_router(certificados.router, prefix=PREFIXO)
app.include_router(admin.router, prefix=PREFIXO)
app.include_router(notificacoes.router, prefix=PREFIXO)
app.include_router(portal.router, prefix=PREFIXO)
app.include_router(painel.router, prefix=PREFIXO)

# A entrar nas próximas fatias:
#   Fatia 4  /api/v1/inscricoes
#   Fatia 5  /api/v1/checkin
#   Fatia 6  /api/v1/certificados
#   Fatia 7  /api/v1/notificacoes
#   Fatia 8  /api/v1/admin

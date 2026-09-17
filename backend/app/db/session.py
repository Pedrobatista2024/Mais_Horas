"""Engine e sessão assíncrona do SQLAlchemy."""

from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import config

_conectar: dict = {}
usar_ssl = config.pgssl if config.pgssl is not None else config.producao
if usar_ssl:
    # Banco gerenciado (Render, Neon...) exige SSL; o certificado nem sempre
    # valida na cadeia padrão.
    _conectar["ssl"] = True

engine = create_async_engine(
    config.database_url, echo=False, pool_pre_ping=True, connect_args=_conectar
)

CriarSessao = async_sessionmaker(
    bind=engine, class_=AsyncSession, expire_on_commit=False, autoflush=False
)


async def obter_sessao() -> AsyncGenerator[AsyncSession, None]:
    """Dependência do FastAPI: abre a sessão e garante rollback em falha."""
    async with CriarSessao() as sessao:
        try:
            yield sessao
        except Exception:
            await sessao.rollback()
            raise

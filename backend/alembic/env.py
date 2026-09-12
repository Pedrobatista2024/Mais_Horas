"""Ambiente do Alembic — usa a mesma URL e os mesmos modelos da aplicação."""

from __future__ import annotations

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.core.config import config as configuracao
from app.db.models import Base

config = context.config
config.set_main_option("sqlalchemy.url", configuracao.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def migrar_offline() -> None:
    context.configure(
        url=configuracao.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def _migrar(conexao: Connection) -> None:
    context.configure(connection=conexao, target_metadata=target_metadata,
                      compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


async def _migrar_async() -> None:
    motor = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.", poolclass=pool.NullPool,
    )
    async with motor.connect() as conexao:
        await conexao.run_sync(_migrar)
    await motor.dispose()


if context.is_offline_mode():
    migrar_offline()
else:
    asyncio.run(_migrar_async())

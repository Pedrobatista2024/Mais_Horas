"""
Base dos testes.

Cada teste roda numa transação própria, revertida ao final. Assim um teste nunca
enxerga o que outro escreveu, e a ordem de execução deixa de importar.

O engine é criado **por teste**, não uma vez por sessão: o pytest-asyncio dá uma
event loop nova a cada teste, e um engine criado em outra loop falha com
"attached to a different loop". O schema, esse sim, é montado uma única vez.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import config
from app.db.models import Base


async def _montar_schema() -> None:
    motor = create_async_engine(config.database_url_teste, echo=False)
    try:
        async with motor.begin() as conexao:
            await conexao.run_sync(Base.metadata.drop_all)
            await conexao.run_sync(Base.metadata.create_all)
    finally:
        await motor.dispose()


@pytest.fixture(scope="session", autouse=True)
def schema() -> None:
    """Recria o banco de teste uma vez, antes de tudo."""
    asyncio.run(_montar_schema())


@pytest_asyncio.fixture
async def sessao(schema) -> AsyncGenerator[AsyncSession, None]:
    """
    Sessão amarrada a uma transação externa, desfeita ao final do teste.

    O rollback é o que garante isolamento sem recriar as tabelas a cada caso —
    inclusive quando o próprio teste provoca um erro de integridade.

    `create_savepoint` faz a sessão se comportar como em produção: cada
    `commit()` fica valendo até o fim do teste, e um `rollback()` desfaz só o
    que ainda não foi commitado. Sem isso, um rollback apagava o teste inteiro
    — e um teste de atomicidade passava por vacuidade, sem provar nada.
    """
    motor = create_async_engine(config.database_url_teste, echo=False)
    try:
        async with motor.connect() as conexao:
            transacao = await conexao.begin()
            criar = async_sessionmaker(bind=conexao, expire_on_commit=False,
                                       join_transaction_mode="create_savepoint")
            async with criar() as s:
                yield s
            if transacao.is_active:
                await transacao.rollback()
    finally:
        await motor.dispose()

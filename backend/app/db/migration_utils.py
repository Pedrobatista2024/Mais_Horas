"""
Helper para rodar scripts SQL com vários comandos nas migrations.

O driver asyncpg recusa múltiplos comandos num mesmo prepared statement
("cannot insert multiple commands into a prepared statement"), então o script
precisa ser quebrado e executado statement por statement.
"""

from __future__ import annotations

from alembic import op


def run_script(sql: str) -> None:
    for statement in sql.split(";"):
        cleaned = statement.strip()
        if cleaned:
            op.execute(cleaned)

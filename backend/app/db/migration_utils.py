"""
Helper para rodar scripts SQL com vários comandos nas migrations.

O driver asyncpg recusa múltiplos comandos num mesmo prepared statement
("cannot insert multiple commands into a prepared statement"), então o script
precisa ser quebrado e executado um comando por vez.
"""

from __future__ import annotations

from alembic import op


def executar_script(sql: str) -> None:
    """Divide por ';' e executa cada comando, ignorando linhas de comentário."""
    for bruto in sql.split(";"):
        comando = "\n".join(
            linha for linha in bruto.splitlines()
            if not linha.strip().startswith("--")
        ).strip()
        if comando:
            op.execute(comando)

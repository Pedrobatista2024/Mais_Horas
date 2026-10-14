"""Entrada também pela Microsoft e pelo GitHub.

Só a restrição muda: `identidades_externas` já foi desenhada para mais de um
provedor, com a chave em (provedor, sub). A lista de provedores aceitos fica no
banco, e não só no código, para que um valor inventado não entre por fora.

O downgrade apaga as identidades dos provedores novos antes de voltar a
restrição — sem isso ela não poderia ser recriada. Contas criadas por eles
ficam sem forma de entrar até alguém definir senha pelo "esqueci minha senha".

Revision ID: 0003
Revises: 0002
"""

from __future__ import annotations

from app.db.migration_utils import executar_script

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


AMPLIAR = """
ALTER TABLE identidades_externas DROP CONSTRAINT identidades_provedor_valido;
ALTER TABLE identidades_externas ADD CONSTRAINT identidades_provedor_valido
    CHECK (provedor IN ('google', 'microsoft', 'github'));
"""

RESTRINGIR = """
DELETE FROM identidades_externas WHERE provedor <> 'google';
ALTER TABLE identidades_externas DROP CONSTRAINT identidades_provedor_valido;
ALTER TABLE identidades_externas ADD CONSTRAINT identidades_provedor_valido
    CHECK (provedor IN ('google'));
"""


def upgrade() -> None:
    executar_script(AMPLIAR)


def downgrade() -> None:
    executar_script(RESTRINGIR)

"""Login por provedor externo (Google).

A identidade externa fica em tabela própria, e não em colunas de `usuarios`:
uma conta pode ter mais de um provedor amanhã, e a chave de busca é o par
(provedor, sub) — nunca o e-mail, que o usuário troca no provedor.

`senha_hash` passa a aceitar nulo: quem nasce pelo Google não tem senha, e
guardar um hash inútil só para preencher a coluna esconderia esse fato.

Revision ID: 0002
Revises: 0001
"""

from __future__ import annotations

from alembic import op

from app.db.migration_utils import executar_script

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


CRIAR = """
ALTER TABLE usuarios ALTER COLUMN senha_hash DROP NOT NULL;

CREATE TABLE IF NOT EXISTS identidades_externas (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id        UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    provedor          TEXT NOT NULL,
    sub               TEXT NOT NULL,
    email             TEXT NOT NULL,
    dominio           TEXT,
    criado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
    ultimo_acesso_em  TIMESTAMPTZ,
    CONSTRAINT identidades_provedor_valido CHECK (provedor IN ('google')),
    CONSTRAINT identidades_unica UNIQUE (provedor, sub)
);

CREATE INDEX IF NOT EXISTS idx_identidades_usuario
    ON identidades_externas (usuario_id);
"""

DESFAZER = """
DROP TABLE IF EXISTS identidades_externas;
UPDATE usuarios SET senha_hash = '' WHERE senha_hash IS NULL;
ALTER TABLE usuarios ALTER COLUMN senha_hash SET NOT NULL;
"""


def upgrade() -> None:
    executar_script(op, CRIAR)


def downgrade() -> None:
    executar_script(op, DESFAZER)

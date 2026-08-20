"""Schema inicial — espelha as tabelas criadas pelo backend Node.

Usa CREATE TABLE IF NOT EXISTS de propósito: em banco novo cria tudo, e em banco
que já rodou o backend Node não faz nada. Assim a mesma migration serve para os
dois casos, sem precisar de `alembic stamp` manual.

Revision ID: 0001
Revises:
"""

from __future__ import annotations

from alembic import op

from app.db.migration_utils import run_script

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


SCHEMA_SQL = """
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','organization')),
  student_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  organization_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  description TEXT,
  date TIMESTAMPTZ,
  start_time TEXT,
  end_time TEXT,
  location TEXT,
  workload_hours INTEGER,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  min_participants INTEGER NOT NULL DEFAULT 1,
  max_participants INTEGER NOT NULL DEFAULT 20,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','finished','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS participations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','present','absent')),
  validated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  workload_hours INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (activity_id, user_id)
);

CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  participation_id UUID NOT NULL UNIQUE REFERENCES participations(id) ON DELETE CASCADE,
  hours INTEGER NOT NULL,
  verification_code TEXT NOT NULL UNIQUE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_created_by ON activities(created_by);
CREATE INDEX IF NOT EXISTS idx_participations_activity ON participations(activity_id);
CREATE INDEX IF NOT EXISTS idx_participations_user ON participations(user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_user ON certificates(user_id);
"""


def upgrade() -> None:
    run_script(SCHEMA_SQL)


def downgrade() -> None:
    run_script(
        """
        DROP TABLE IF EXISTS certificates;
        DROP TABLE IF EXISTS participations;
        DROP TABLE IF EXISTS activities;
        DROP TABLE IF EXISTS users;
        """
    )

import pg from "pg";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("DATABASE_URL não definida — configure no .env antes de subir o servidor");
}

export const pool = new Pool({
  connectionString,
  ssl:
    process.env.PGSSL === "true" || process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

export const query = (text, params) => pool.query(text, params);

const SCHEMA_SQL = `
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
`;

export const connectDB = async () => {
  try {
    await pool.query("SELECT 1");
    await pool.query(SCHEMA_SQL);
    console.log("Banco PostgreSQL conectado e schema garantido.");
  } catch (error) {
    console.error("Erro ao conectar/inicializar PostgreSQL:", error);
    process.exit(1);
  }
};

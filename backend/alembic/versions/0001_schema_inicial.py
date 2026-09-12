"""Schema inicial — as 10 tabelas de docs/modelo-dados.md.

Substitui o schema anterior, em inglês, criado pelo backend Node. As tabelas
antigas são descartadas: a base é recriada do zero (D28) e os dados que havia
eram de teste.

Revision ID: 0001
Revises:
"""

from __future__ import annotations

from alembic import op

from app.db.migration_utils import executar_script

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


DESCARTAR_ANTIGO = """
DROP TABLE IF EXISTS certificates CASCADE;
DROP TABLE IF EXISTS participations CASCADE;
DROP TABLE IF EXISTS activities CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS users CASCADE;
"""

CRIAR = """
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ===================== Contas =====================

CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  papel TEXT NOT NULL DEFAULT 'estudante',
  situacao TEXT NOT NULL DEFAULT 'ativa',
  suspenso_em TIMESTAMPTZ,
  suspenso_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  motivo_suspensao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT usuarios_papel_valido
    CHECK (papel IN ('estudante','ong','superadmin')),
  CONSTRAINT usuarios_situacao_valida
    CHECK (situacao IN ('ativa','suspensa')),
  CONSTRAINT usuarios_suspensao_coerente CHECK (
    (situacao = 'ativa'    AND suspenso_em IS NULL) OR
    (situacao = 'suspensa' AND suspenso_em IS NOT NULL
                           AND motivo_suspensao IS NOT NULL))
);

CREATE INDEX idx_usuarios_papel ON usuarios(papel);
CREATE INDEX idx_usuarios_situacao ON usuarios(situacao);

CREATE TABLE perfis_estudante (
  usuario_id UUID PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  nome_completo VARCHAR(120),
  instituicao VARCHAR(120),
  curso VARCHAR(120),
  sexo VARCHAR(30),
  data_nascimento DATE,
  telefone VARCHAR(30),
  cidade VARCHAR(80),
  estado VARCHAR(80),
  bairro VARCHAR(80),
  sobre_mim VARCHAR(1000),
  linkedin VARCHAR(200),
  foto TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE perfis_ong (
  usuario_id UUID PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  nome_organizacao VARCHAR(120),
  cnpj VARCHAR(30),
  descricao VARCHAR(1000),
  telefone VARCHAR(30),
  site VARCHAR(200),
  instagram VARCHAR(200),
  endereco VARCHAR(200),
  cidade VARCHAR(80),
  estado VARCHAR(80),
  logo TEXT,
  verificada_em TIMESTAMPTZ,
  verificada_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_perfis_ong_cidade ON perfis_ong(cidade);
CREATE INDEX idx_perfis_ong_verificada ON perfis_ong(verificada_em);

-- ===================== Domínio =====================

CREATE TABLE atividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ong_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo VARCHAR(40) NOT NULL,
  descricao VARCHAR(1500) NOT NULL,
  local VARCHAR(50) NOT NULL,
  cidade VARCHAR(80),
  estado VARCHAR(80),
  data DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  carga_horaria INTEGER NOT NULL,
  vagas_min INTEGER NOT NULL DEFAULT 1,
  vagas_max INTEGER NOT NULL DEFAULT 20,
  exige_aprovacao BOOLEAN NOT NULL DEFAULT false,
  situacao TEXT NOT NULL DEFAULT 'rascunho',
  publicada_em TIMESTAMPTZ,
  finalizada_em TIMESTAMPTZ,
  cancelada_em TIMESTAMPTZ,
  cancelada_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  editada_por_admin_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT atividades_situacao_valida
    CHECK (situacao IN ('rascunho','publicada','finalizada','cancelada')),
  CONSTRAINT atividades_horario_coerente CHECK (hora_fim > hora_inicio),
  CONSTRAINT atividades_carga_positiva CHECK (carga_horaria > 0),
  CONSTRAINT atividades_vagas_coerentes
    CHECK (vagas_max >= vagas_min AND vagas_min >= 1)
);

CREATE INDEX idx_atividades_ong ON atividades(ong_id);
CREATE INDEX idx_atividades_vitrine ON atividades(situacao, data);
CREATE INDEX idx_atividades_cidade ON atividades(cidade);

CREATE TABLE inscricoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atividade_id UUID NOT NULL REFERENCES atividades(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  situacao TEXT NOT NULL DEFAULT 'pendente',
  respondida_em TIMESTAMPTZ,
  respondida_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  cancelada_em TIMESTAMPTZ,
  checkin_em TIMESTAMPTZ,
  checkin_origem TEXT,
  checkin_latitude NUMERIC(9,6),
  checkin_longitude NUMERIC(9,6),
  checkin_registrado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  presenca_validada_em TIMESTAMPTZ,
  presenca_validada_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  carga_horaria_creditada INTEGER NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inscricoes_unica UNIQUE (atividade_id, usuario_id),
  CONSTRAINT inscricoes_situacao_valida CHECK (
    situacao IN ('pendente','confirmada','recusada','cancelada','presente','ausente')),
  CONSTRAINT inscricoes_checkin_origem
    CHECK (checkin_origem IS NULL OR checkin_origem IN ('qr','manual')),
  CONSTRAINT inscricoes_checkin_coerente CHECK (
    (checkin_em IS NULL AND checkin_origem IS NULL) OR
    (checkin_em IS NOT NULL AND checkin_origem IS NOT NULL)),
  CONSTRAINT inscricoes_manual_tem_responsavel CHECK (
    checkin_origem IS DISTINCT FROM 'manual' OR checkin_registrado_por IS NOT NULL),
  CONSTRAINT inscricoes_carga_nao_negativa CHECK (carga_horaria_creditada >= 0)
);

CREATE INDEX idx_inscricoes_atividade ON inscricoes(atividade_id, situacao);
CREATE INDEX idx_inscricoes_usuario ON inscricoes(usuario_id, situacao);

CREATE TABLE certificados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inscricao_id UUID NOT NULL UNIQUE REFERENCES inscricoes(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  atividade_id UUID NOT NULL REFERENCES atividades(id) ON DELETE CASCADE,
  codigo_verificacao VARCHAR(32) NOT NULL UNIQUE,
  horas INTEGER NOT NULL,
  nome_no_certificado VARCHAR(120) NOT NULL,
  nome_organizacao VARCHAR(120) NOT NULL,
  titulo_atividade VARCHAR(40) NOT NULL,
  data_atividade DATE NOT NULL,
  assinatura TEXT NOT NULL,
  emitido_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revogado_em TIMESTAMPTZ,
  revogado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  motivo_revogacao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT certificados_horas_positivas CHECK (horas > 0),
  CONSTRAINT certificados_revogacao_coerente CHECK (
    (revogado_em IS NULL AND motivo_revogacao IS NULL) OR
    (revogado_em IS NOT NULL AND motivo_revogacao IS NOT NULL))
);

CREATE INDEX idx_certificados_usuario ON certificados(usuario_id);
CREATE INDEX idx_certificados_atividade ON certificados(atividade_id);
CREATE INDEX idx_certificados_revogado ON certificados(revogado_em);

-- ===================== Apoio =====================

CREATE TABLE tokens_sessao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  familia_id UUID NOT NULL,
  expira_em TIMESTAMPTZ NOT NULL,
  usado_em TIMESTAMPTZ,
  revogado_em TIMESTAMPTZ,
  em_nome_de UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  user_agent VARCHAR(400),
  ip VARCHAR(64),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tokens_sessao_usuario ON tokens_sessao(usuario_id);
CREATE INDEX idx_tokens_sessao_familia ON tokens_sessao(familia_id);
CREATE INDEX idx_tokens_sessao_expira ON tokens_sessao(expira_em);

CREATE TABLE tokens_redefinicao_senha (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expira_em TIMESTAMPTZ NOT NULL,
  usado_em TIMESTAMPTZ,
  disparado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tokens_senha_usuario ON tokens_redefinicao_senha(usuario_id);

CREATE TABLE notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destinatario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo VARCHAR(60) NOT NULL,
  titulo VARCHAR(120) NOT NULL,
  mensagem VARCHAR(400) NOT NULL,
  link VARCHAR(200),
  lida_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notificacoes_destinatario ON notificacoes(destinatario_id, lida_em);

-- Sem chave estrangeira para usuarios, de propósito: a trilha precisa
-- sobreviver à remoção da conta que se quer investigar.
CREATE TABLE registros_auditoria (
  id BIGSERIAL PRIMARY KEY,
  ator_id UUID,
  ator_papel VARCHAR(20),
  em_nome_de_id UUID,
  acao VARCHAR(60) NOT NULL,
  entidade VARCHAR(40),
  entidade_id UUID,
  antes JSONB,
  depois JSONB,
  ip INET,
  user_agent TEXT,
  ocorrido_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auditoria_ocorrido ON registros_auditoria(ocorrido_em DESC);
CREATE INDEX idx_auditoria_ator ON registros_auditoria(ator_id);
CREATE INDEX idx_auditoria_acao ON registros_auditoria(acao);
CREATE INDEX idx_auditoria_entidade ON registros_auditoria(entidade, entidade_id);
CREATE INDEX idx_auditoria_em_nome_de ON registros_auditoria(em_nome_de_id);
"""

VISAO_SITUACAO = """
-- Situação real da atividade, calculada na leitura (D22, RN-54).
-- em_andamento e aguardando_validacao não existem como valor gravado.
CREATE OR REPLACE VIEW atividades_com_situacao AS
SELECT
  a.*,
  CASE
    WHEN a.situacao <> 'publicada' THEN a.situacao
    WHEN (a.data + a.hora_inicio) AT TIME ZONE 'America/Sao_Paulo' > NOW()
      THEN 'publicada'
    WHEN (a.data + a.hora_fim) AT TIME ZONE 'America/Sao_Paulo' < NOW()
      THEN 'aguardando_validacao'
    ELSE 'em_andamento'
  END AS situacao_real
FROM atividades a;
"""


def upgrade() -> None:
    executar_script(DESCARTAR_ANTIGO)
    executar_script(CRIAR)
    op.execute(VISAO_SITUACAO)


def downgrade() -> None:
    executar_script("""
        DROP VIEW IF EXISTS atividades_com_situacao;
        DROP TABLE IF EXISTS registros_auditoria;
        DROP TABLE IF EXISTS notificacoes;
        DROP TABLE IF EXISTS tokens_redefinicao_senha;
        DROP TABLE IF EXISTS tokens_sessao;
        DROP TABLE IF EXISTS certificados;
        DROP TABLE IF EXISTS inscricoes;
        DROP TABLE IF EXISTS atividades;
        DROP TABLE IF EXISTS perfis_ong;
        DROP TABLE IF EXISTS perfis_estudante;
        DROP TABLE IF EXISTS usuarios;
    """)

"""
Modelos SQLAlchemy — as 10 tabelas de docs/modelo-dados.md.

Tabelas e colunas em português (D26). As restrições que o banco consegue
garantir sozinho estão declaradas aqui, não só no service: regra garantida por
`CHECK` ou `UNIQUE` não depende de ninguém lembrar dela.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, time

from sqlalchemy import (
    BigInteger, Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index,
    Integer, Numeric, String, Text, Time, UniqueConstraint, text,
)
from sqlalchemy.dialects.postgresql import INET, JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


def _pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True,
                         server_default=text("gen_random_uuid()"))


def _criado() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), nullable=False,
                         server_default=text("NOW()"))


def _atualizado() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), nullable=False,
                         server_default=text("NOW()"), onupdate=text("NOW()"))


# ===================== Contas =====================


class Usuario(Base):
    __tablename__ = "usuarios"
    __table_args__ = (
        CheckConstraint("papel IN ('estudante','ong','superadmin')",
                        name="usuarios_papel_valido"),
        CheckConstraint("situacao IN ('ativa','suspensa')",
                        name="usuarios_situacao_valida"),
        # Impede o estado impossível: suspensa sem data nem motivo.
        CheckConstraint(
            "(situacao = 'ativa'    AND suspenso_em IS NULL) OR "
            "(situacao = 'suspensa' AND suspenso_em IS NOT NULL "
            "                       AND motivo_suspensao IS NOT NULL)",
            name="usuarios_suspensao_coerente"),
        Index("idx_usuarios_papel", "papel"),
        Index("idx_usuarios_situacao", "situacao"),
    )

    id: Mapped[uuid.UUID] = _pk()
    nome: Mapped[str] = mapped_column(Text, nullable=False)
    email: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    senha_hash: Mapped[str] = mapped_column(Text, nullable=False)
    papel: Mapped[str] = mapped_column(Text, nullable=False,
                                       server_default=text("'estudante'"))
    situacao: Mapped[str] = mapped_column(Text, nullable=False,
                                          server_default=text("'ativa'"))
    suspenso_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    suspenso_por: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="SET NULL"))
    motivo_suspensao: Mapped[str | None] = mapped_column(Text)
    criado_em: Mapped[datetime] = _criado()
    atualizado_em: Mapped[datetime] = _atualizado()

    # `foreign_keys` é obrigatório em perfil_ong: a tabela tem duas chaves para
    # `usuarios` — o dono do perfil e o admin que concedeu o selo de verificada.
    perfil_estudante: Mapped["PerfilEstudante | None"] = relationship(
        back_populates="usuario", cascade="all, delete-orphan", uselist=False)
    perfil_ong: Mapped["PerfilOng | None"] = relationship(
        back_populates="usuario", cascade="all, delete-orphan", uselist=False,
        foreign_keys="PerfilOng.usuario_id")


class PerfilEstudante(Base):
    """
    A chave primária é a estrangeira: garante um perfil por usuário sem coluna
    de id própria.

    Os três campos exigidos pela RN-13 não são NOT NULL — o perfil nasce vazio
    junto com a conta, e a exigência só vale no momento da primeira inscrição.
    """

    __tablename__ = "perfis_estudante"

    usuario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"),
        primary_key=True)
    nome_completo: Mapped[str | None] = mapped_column(String(120))
    instituicao: Mapped[str | None] = mapped_column(String(120))
    curso: Mapped[str | None] = mapped_column(String(120))
    sexo: Mapped[str | None] = mapped_column(String(30))
    data_nascimento: Mapped[date | None] = mapped_column(Date)
    telefone: Mapped[str | None] = mapped_column(String(30))
    cidade: Mapped[str | None] = mapped_column(String(80))
    estado: Mapped[str | None] = mapped_column(String(80))
    bairro: Mapped[str | None] = mapped_column(String(80))
    sobre_mim: Mapped[str | None] = mapped_column(String(1000))
    linkedin: Mapped[str | None] = mapped_column(String(200))
    foto: Mapped[str | None] = mapped_column(Text)
    criado_em: Mapped[datetime] = _criado()
    atualizado_em: Mapped[datetime] = _atualizado()

    usuario: Mapped["Usuario"] = relationship(back_populates="perfil_estudante")

    @property
    def completo(self) -> bool:
        """RN-13 — é o que libera a primeira inscrição."""
        return all(
            (campo or "").strip()
            for campo in (self.nome_completo, self.instituicao, self.curso)
        )


class PerfilOng(Base):
    __tablename__ = "perfis_ong"
    __table_args__ = (
        Index("idx_perfis_ong_cidade", "cidade"),
        Index("idx_perfis_ong_verificada", "verificada_em"),
    )

    usuario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"),
        primary_key=True)
    nome_organizacao: Mapped[str | None] = mapped_column(String(120))
    cnpj: Mapped[str | None] = mapped_column(String(30))
    descricao: Mapped[str | None] = mapped_column(String(1000))
    telefone: Mapped[str | None] = mapped_column(String(30))
    site: Mapped[str | None] = mapped_column(String(200))
    instagram: Mapped[str | None] = mapped_column(String(200))
    endereco: Mapped[str | None] = mapped_column(String(200))
    cidade: Mapped[str | None] = mapped_column(String(80))
    estado: Mapped[str | None] = mapped_column(String(80))
    logo: Mapped[str | None] = mapped_column(Text)
    verificada_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    verificada_por: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="SET NULL"))
    criado_em: Mapped[datetime] = _criado()
    atualizado_em: Mapped[datetime] = _atualizado()

    usuario: Mapped["Usuario"] = relationship(
        back_populates="perfil_ong", foreign_keys=[usuario_id])


# ===================== Domínio =====================


class Atividade(Base):
    """
    Só quatro situações são gravadas. `em_andamento` e `aguardando_validacao`
    são calculadas na leitura a partir do relógio (D22, RN-54) — não existem
    como valor no banco.
    """

    __tablename__ = "atividades"
    __table_args__ = (
        CheckConstraint("situacao IN ('rascunho','publicada','finalizada','cancelada')",
                        name="atividades_situacao_valida"),
        CheckConstraint("hora_fim > hora_inicio", name="atividades_horario_coerente"),
        CheckConstraint("carga_horaria > 0", name="atividades_carga_positiva"),
        CheckConstraint("vagas_max >= vagas_min AND vagas_min >= 1",
                        name="atividades_vagas_coerentes"),
        Index("idx_atividades_ong", "ong_id"),
        Index("idx_atividades_vitrine", "situacao", "data"),
        Index("idx_atividades_cidade", "cidade"),
    )

    id: Mapped[uuid.UUID] = _pk()
    ong_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"),
        nullable=False)
    titulo: Mapped[str] = mapped_column(String(40), nullable=False)
    descricao: Mapped[str] = mapped_column(String(1500), nullable=False)
    local: Mapped[str] = mapped_column(String(50), nullable=False)
    cidade: Mapped[str | None] = mapped_column(String(80))
    estado: Mapped[str | None] = mapped_column(String(80))
    data: Mapped[date] = mapped_column(Date, nullable=False)
    hora_inicio: Mapped[time] = mapped_column(Time, nullable=False)
    hora_fim: Mapped[time] = mapped_column(Time, nullable=False)
    carga_horaria: Mapped[int] = mapped_column(Integer, nullable=False)
    vagas_min: Mapped[int] = mapped_column(Integer, nullable=False,
                                           server_default=text("1"))
    vagas_max: Mapped[int] = mapped_column(Integer, nullable=False,
                                           server_default=text("20"))
    exige_aprovacao: Mapped[bool] = mapped_column(Boolean, nullable=False,
                                                  server_default=text("false"))
    situacao: Mapped[str] = mapped_column(Text, nullable=False,
                                          server_default=text("'rascunho'"))
    publicada_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finalizada_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelada_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelada_por: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="SET NULL"))
    editada_por_admin_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    criado_em: Mapped[datetime] = _criado()
    atualizado_em: Mapped[datetime] = _atualizado()

    ong: Mapped["Usuario"] = relationship(foreign_keys=[ong_id])
    inscricoes: Mapped[list["Inscricao"]] = relationship(
        back_populates="atividade", cascade="all, delete-orphan")


class Inscricao(Base):
    """
    O centro do domínio: guarda o vínculo, a evidência do check-in (D30) e a
    decisão de presença.

    Check-in e presença são coisas distintas — o primeiro é evidência, a segunda
    é a decisão da ONG tomada à luz dela (RN-17).
    """

    __tablename__ = "inscricoes"
    __table_args__ = (
        UniqueConstraint("atividade_id", "usuario_id", name="inscricoes_unica"),
        CheckConstraint(
            "situacao IN ('pendente','confirmada','recusada','cancelada',"
            "'presente','ausente')", name="inscricoes_situacao_valida"),
        CheckConstraint("checkin_origem IS NULL OR checkin_origem IN ('qr','manual')",
                        name="inscricoes_checkin_origem"),
        CheckConstraint(
            "(checkin_em IS NULL AND checkin_origem IS NULL) OR "
            "(checkin_em IS NOT NULL AND checkin_origem IS NOT NULL)",
            name="inscricoes_checkin_coerente"),
        # Sem responsável registrado, a distinção de origem perderia metade do valor.
        CheckConstraint(
            "checkin_origem IS DISTINCT FROM 'manual' OR "
            "checkin_registrado_por IS NOT NULL",
            name="inscricoes_manual_tem_responsavel"),
        CheckConstraint("carga_horaria_creditada >= 0",
                        name="inscricoes_carga_nao_negativa"),
        Index("idx_inscricoes_atividade", "atividade_id", "situacao"),
        Index("idx_inscricoes_usuario", "usuario_id", "situacao"),
    )

    id: Mapped[uuid.UUID] = _pk()
    atividade_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("atividades.id", ondelete="CASCADE"),
        nullable=False)
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"),
        nullable=False)
    situacao: Mapped[str] = mapped_column(Text, nullable=False,
                                          server_default=text("'pendente'"))
    respondida_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    respondida_por: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="SET NULL"))
    cancelada_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    checkin_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    checkin_origem: Mapped[str | None] = mapped_column(Text)
    checkin_latitude: Mapped[float | None] = mapped_column(Numeric(9, 6))
    checkin_longitude: Mapped[float | None] = mapped_column(Numeric(9, 6))
    checkin_registrado_por: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="SET NULL"))

    presenca_validada_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    presenca_validada_por: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="SET NULL"))
    carga_horaria_creditada: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0"))
    criado_em: Mapped[datetime] = _criado()
    atualizado_em: Mapped[datetime] = _atualizado()

    atividade: Mapped["Atividade"] = relationship(back_populates="inscricoes")
    usuario: Mapped["Usuario"] = relationship(foreign_keys=[usuario_id])


class Certificado(Base):
    """
    Os campos de conteúdo são congelados na emissão, não lidos por junção.

    A assinatura é calculada sobre esses valores: se viessem de junção e a ONG
    trocasse de nome, todo certificado antigo passaria a acusar adulteração.
    """

    __tablename__ = "certificados"
    __table_args__ = (
        CheckConstraint("horas > 0", name="certificados_horas_positivas"),
        CheckConstraint(
            "(revogado_em IS NULL AND motivo_revogacao IS NULL) OR "
            "(revogado_em IS NOT NULL AND motivo_revogacao IS NOT NULL)",
            name="certificados_revogacao_coerente"),
        Index("idx_certificados_usuario", "usuario_id"),
        Index("idx_certificados_atividade", "atividade_id"),
        Index("idx_certificados_revogado", "revogado_em"),
    )

    id: Mapped[uuid.UUID] = _pk()
    inscricao_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inscricoes.id", ondelete="CASCADE"),
        nullable=False, unique=True)
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"),
        nullable=False)
    atividade_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("atividades.id", ondelete="CASCADE"),
        nullable=False)
    codigo_verificacao: Mapped[str] = mapped_column(String(32), nullable=False,
                                                    unique=True)
    horas: Mapped[int] = mapped_column(Integer, nullable=False)

    # Congelados na emissão
    nome_no_certificado: Mapped[str] = mapped_column(String(120), nullable=False)
    nome_organizacao: Mapped[str] = mapped_column(String(120), nullable=False)
    titulo_atividade: Mapped[str] = mapped_column(String(40), nullable=False)
    data_atividade: Mapped[date] = mapped_column(Date, nullable=False)

    assinatura: Mapped[str] = mapped_column(Text, nullable=False)
    emitido_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("NOW()"))
    revogado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revogado_por: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="SET NULL"))
    motivo_revogacao: Mapped[str | None] = mapped_column(Text)
    criado_em: Mapped[datetime] = _criado()

    inscricao: Mapped["Inscricao"] = relationship(foreign_keys=[inscricao_id])
    usuario: Mapped["Usuario"] = relationship(foreign_keys=[usuario_id])
    atividade: Mapped["Atividade"] = relationship(foreign_keys=[atividade_id])


# ===================== Apoio =====================


class TokenSessao(Base):
    __tablename__ = "tokens_sessao"
    __table_args__ = (
        Index("idx_tokens_sessao_usuario", "usuario_id"),
        Index("idx_tokens_sessao_familia", "familia_id"),
        Index("idx_tokens_sessao_expira", "expira_em"),
    )

    id: Mapped[uuid.UUID] = _pk()
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"),
        nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    familia_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    expira_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    usado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revogado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Preenchido na sessão espelho do admin (D13). Enquanto houver valor aqui,
    # a API recusa qualquer escrita (RN-24).
    em_nome_de: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"))
    user_agent: Mapped[str | None] = mapped_column(String(400))
    ip: Mapped[str | None] = mapped_column(String(64))
    criado_em: Mapped[datetime] = _criado()

    usuario: Mapped["Usuario"] = relationship(foreign_keys=[usuario_id])


class TokenRedefinicaoSenha(Base):
    __tablename__ = "tokens_redefinicao_senha"
    __table_args__ = (Index("idx_tokens_senha_usuario", "usuario_id"),)

    id: Mapped[uuid.UUID] = _pk()
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"),
        nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    expira_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    usado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    disparado_por: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="SET NULL"))
    criado_em: Mapped[datetime] = _criado()


class Notificacao(Base):
    __tablename__ = "notificacoes"
    __table_args__ = (Index("idx_notificacoes_destinatario", "destinatario_id", "lida_em"),)

    id: Mapped[uuid.UUID] = _pk()
    destinatario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"),
        nullable=False)
    tipo: Mapped[str] = mapped_column(String(60), nullable=False)
    titulo: Mapped[str] = mapped_column(String(120), nullable=False)
    mensagem: Mapped[str] = mapped_column(String(400), nullable=False)
    link: Mapped[str | None] = mapped_column(String(200))
    lida_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    criado_em: Mapped[datetime] = _criado()


class RegistroAuditoria(Base):
    """
    Somente inserção (RN-33). Nenhum caminho da aplicação faz UPDATE ou DELETE.

    Não há chave estrangeira para `usuarios`, de propósito: uma FK em cascata
    apagaria justamente a trilha do usuário que se quer investigar.

    Id sequencial em vez de UUID porque aqui a ordem cronológica importa mais
    que a imprevisibilidade, e a tabela cresce muito mais que as outras.
    """

    __tablename__ = "registros_auditoria"
    __table_args__ = (
        Index("idx_auditoria_ocorrido", text("ocorrido_em DESC")),
        Index("idx_auditoria_ator", "ator_id"),
        Index("idx_auditoria_acao", "acao"),
        Index("idx_auditoria_entidade", "entidade", "entidade_id"),
        Index("idx_auditoria_em_nome_de", "em_nome_de_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    ator_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    ator_papel: Mapped[str | None] = mapped_column(String(20))
    em_nome_de_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    acao: Mapped[str] = mapped_column(String(60), nullable=False)
    entidade: Mapped[str | None] = mapped_column(String(40))
    entidade_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    antes: Mapped[dict | None] = mapped_column(JSONB)
    depois: Mapped[dict | None] = mapped_column(JSONB)
    ip: Mapped[str | None] = mapped_column(INET)
    user_agent: Mapped[str | None] = mapped_column(Text)
    ocorrido_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("NOW()"))

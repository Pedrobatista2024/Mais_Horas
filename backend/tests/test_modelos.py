"""
Testes das restrições declaradas no banco.

Verificam o que o banco garante sozinho — as regras que continuam valendo mesmo
que alguém escreva direto no Postgres, sem passar pela aplicação.
"""

from __future__ import annotations

import uuid
from datetime import date, time

import pytest
from sqlalchemy.exc import IntegrityError

from app.db.models import (
    Atividade, Certificado, Inscricao, PerfilEstudante, Usuario,
)


async def _usuario(sessao, papel="estudante", email=None) -> Usuario:
    u = Usuario(
        nome="Fulano",
        email=email or f"{uuid.uuid4().hex[:10]}@teste.com",
        senha_hash="$argon2id$fake",
        papel=papel,
    )
    sessao.add(u)
    await sessao.flush()
    return u


async def _atividade(sessao, ong, **extra) -> Atividade:
    dados = dict(
        ong_id=ong.id, titulo="Mutirão", descricao="Limpeza da praça",
        local="Praça Central", data=date(2030, 6, 15),
        hora_inicio=time(8, 0), hora_fim=time(12, 0),
        carga_horaria=4, vagas_min=1, vagas_max=20, situacao="publicada",
    )
    dados.update(extra)
    a = Atividade(**dados)
    sessao.add(a)
    await sessao.flush()
    return a


# ===================== Usuário =====================


async def test_email_e_unico(sessao):
    await _usuario(sessao, email="repetido@teste.com")
    sessao.add(Usuario(nome="Outro", email="repetido@teste.com",
                       senha_hash="x", papel="estudante"))
    with pytest.raises(IntegrityError):
        await sessao.flush()


async def test_papel_invalido_e_recusado(sessao):
    sessao.add(Usuario(nome="X", email=f"{uuid.uuid4().hex}@t.com",
                       senha_hash="x", papel="diretor"))
    with pytest.raises(IntegrityError):
        await sessao.flush()


async def test_suspensao_sem_motivo_e_recusada(sessao):
    """RN-26: o banco impede o estado impossível de conta suspensa sem motivo."""
    from datetime import datetime, timezone
    u = await _usuario(sessao)
    u.situacao = "suspensa"
    u.suspenso_em = datetime.now(timezone.utc)
    # motivo_suspensao deixado em branco de propósito
    with pytest.raises(IntegrityError):
        await sessao.flush()


# ===================== Perfil =====================


async def test_perfil_incompleto_nao_libera_inscricao(sessao):
    """RN-13."""
    u = await _usuario(sessao)
    perfil = PerfilEstudante(usuario_id=u.id, nome_completo="Maria Silva")
    assert not perfil.completo

    perfil.instituicao = "UniC"
    perfil.curso = "Sistemas de Informação"
    assert perfil.completo


async def test_perfil_com_campo_em_branco_nao_conta_como_completo(sessao):
    u = await _usuario(sessao)
    perfil = PerfilEstudante(
        usuario_id=u.id, nome_completo="Maria", instituicao="   ", curso="SI"
    )
    assert not perfil.completo


# ===================== Atividade =====================


async def test_horario_invertido_e_recusado(sessao):
    """RN-06."""
    ong = await _usuario(sessao, "ong")
    with pytest.raises(IntegrityError):
        await _atividade(sessao, ong, hora_inicio=time(12, 0), hora_fim=time(8, 0))


async def test_carga_horaria_zero_e_recusada(sessao):
    """RN-07."""
    ong = await _usuario(sessao, "ong")
    with pytest.raises(IntegrityError):
        await _atividade(sessao, ong, carga_horaria=0)


async def test_vagas_incoerentes_sao_recusadas(sessao):
    """RN-08."""
    ong = await _usuario(sessao, "ong")
    with pytest.raises(IntegrityError):
        await _atividade(sessao, ong, vagas_min=10, vagas_max=5)


async def test_situacao_calculada_nao_pode_ser_gravada(sessao):
    """
    D22/RN-54: `em_andamento` é derivada do relógio, não um valor do banco.
    Se coubesse aqui, haveria duas fontes de verdade para a mesma coisa.
    """
    ong = await _usuario(sessao, "ong")
    with pytest.raises(IntegrityError):
        await _atividade(sessao, ong, situacao="em_andamento")


# ===================== Inscrição =====================


async def test_inscricao_duplicada_e_recusada(sessao):
    """RN-01 — garantida pelo banco, não pelo service."""
    ong = await _usuario(sessao, "ong")
    aluno = await _usuario(sessao)
    atividade = await _atividade(sessao, ong)

    sessao.add(Inscricao(atividade_id=atividade.id, usuario_id=aluno.id,
                         situacao="confirmada"))
    await sessao.flush()

    sessao.add(Inscricao(atividade_id=atividade.id, usuario_id=aluno.id,
                         situacao="confirmada"))
    with pytest.raises(IntegrityError):
        await sessao.flush()


async def test_checkin_sem_origem_e_recusado(sessao):
    """Estado incoerente: houve check-in mas não se sabe como."""
    from datetime import datetime, timezone
    ong = await _usuario(sessao, "ong")
    aluno = await _usuario(sessao)
    atividade = await _atividade(sessao, ong)

    sessao.add(Inscricao(
        atividade_id=atividade.id, usuario_id=aluno.id, situacao="confirmada",
        checkin_em=datetime.now(timezone.utc),  # sem checkin_origem
    ))
    with pytest.raises(IntegrityError):
        await sessao.flush()


async def test_checkin_manual_exige_responsavel(sessao):
    """
    RN-43 — sem saber quem registrou, a distinção entre QR e manual perderia
    metade do valor.
    """
    from datetime import datetime, timezone
    ong = await _usuario(sessao, "ong")
    aluno = await _usuario(sessao)
    atividade = await _atividade(sessao, ong)

    sessao.add(Inscricao(
        atividade_id=atividade.id, usuario_id=aluno.id, situacao="confirmada",
        checkin_em=datetime.now(timezone.utc), checkin_origem="manual",
    ))
    with pytest.raises(IntegrityError):
        await sessao.flush()


async def test_checkin_por_qr_dispensa_responsavel(sessao):
    from datetime import datetime, timezone
    ong = await _usuario(sessao, "ong")
    aluno = await _usuario(sessao)
    atividade = await _atividade(sessao, ong)

    sessao.add(Inscricao(
        atividade_id=atividade.id, usuario_id=aluno.id, situacao="confirmada",
        checkin_em=datetime.now(timezone.utc), checkin_origem="qr",
    ))
    await sessao.flush()  # não levanta


# ===================== Certificado =====================


async def _inscricao_presente(sessao):
    ong = await _usuario(sessao, "ong")
    aluno = await _usuario(sessao)
    atividade = await _atividade(sessao, ong, situacao="finalizada")
    inscricao = Inscricao(atividade_id=atividade.id, usuario_id=aluno.id,
                          situacao="presente", carga_horaria_creditada=4)
    sessao.add(inscricao)
    await sessao.flush()
    return aluno, atividade, inscricao


def _certificado(aluno, atividade, inscricao, **extra):
    dados = dict(
        inscricao_id=inscricao.id, usuario_id=aluno.id, atividade_id=atividade.id,
        codigo_verificacao=uuid.uuid4().hex[:16], horas=4,
        nome_no_certificado="Maria Silva", nome_organizacao="ONG Verde Vida",
        titulo_atividade="Mutirão", data_atividade=date(2030, 6, 15),
        assinatura="assinatura-fake",
    )
    dados.update(extra)
    return Certificado(**dados)


async def test_um_certificado_por_inscricao(sessao):
    """RN-02."""
    aluno, atividade, inscricao = await _inscricao_presente(sessao)
    sessao.add(_certificado(aluno, atividade, inscricao))
    await sessao.flush()

    sessao.add(_certificado(aluno, atividade, inscricao))
    with pytest.raises(IntegrityError):
        await sessao.flush()


async def test_codigo_de_verificacao_e_unico(sessao):
    aluno, atividade, inscricao = await _inscricao_presente(sessao)
    sessao.add(_certificado(aluno, atividade, inscricao, codigo_verificacao="repetido"))
    await sessao.flush()

    outro_aluno, outra_atv, outra_insc = await _inscricao_presente(sessao)
    sessao.add(_certificado(outro_aluno, outra_atv, outra_insc,
                            codigo_verificacao="repetido"))
    with pytest.raises(IntegrityError):
        await sessao.flush()


async def test_revogacao_sem_motivo_e_recusada(sessao):
    """RN-19 — revogar desfaz documento que já circulou; exige justificativa."""
    from datetime import datetime, timezone
    aluno, atividade, inscricao = await _inscricao_presente(sessao)
    cert = _certificado(aluno, atividade, inscricao)
    cert.revogado_em = datetime.now(timezone.utc)
    sessao.add(cert)
    with pytest.raises(IntegrityError):
        await sessao.flush()


async def test_assinatura_e_obrigatoria(sessao):
    """
    Não existe certificado sem assinatura: os de teste anteriores a D4 não foram
    migrados justamente para que este campo pudesse nascer obrigatório.
    """
    aluno, atividade, inscricao = await _inscricao_presente(sessao)
    cert = _certificado(aluno, atividade, inscricao)
    cert.assinatura = None
    sessao.add(cert)
    with pytest.raises(IntegrityError):
        await sessao.flush()

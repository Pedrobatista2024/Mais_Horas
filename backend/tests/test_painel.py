"""
Painéis de entrada (Fatia 10): indicadores e destaque contextual.

O que se testa aqui é a **ordem de prioridade** do destaque — é ela que decide
o botão principal da tela. Os estados são montados direto no banco: o caminho
até cada situação já tem teste próprio nas fatias anteriores.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, time, timedelta, timezone

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.security import criar_access_token
from app.db.models import (
    Atividade, Certificado, Inscricao, Notificacao, PerfilOng, Usuario,
)
from app.db.session import obter_sessao
from app.main import app
from app.services import atividade_service

AGORA = datetime.now(timezone.utc)


@pytest.fixture
async def cliente(sessao):
    async def _sessao_de_teste():
        yield sessao

    app.dependency_overrides[obter_sessao] = _sessao_de_teste
    async with AsyncClient(transport=ASGITransport(app=app),
                           base_url="http://teste") as c:
        yield c
    app.dependency_overrides.clear()


async def _usuario(sessao, papel: str, nome: str) -> Usuario:
    usuario = Usuario(nome=nome, email=f"{uuid.uuid4().hex[:12]}@teste.com",
                      senha_hash="x", papel=papel)
    sessao.add(usuario)
    await sessao.flush()
    if papel == "ong":
        sessao.add(PerfilOng(usuario_id=usuario.id, nome_organizacao=nome))
        await sessao.flush()
    return usuario


def _como(usuario: Usuario) -> dict:
    token, _ = criar_access_token(usuario.id, usuario.papel)
    return {"Authorization": f"Bearer {token}"}


async def _atividade(sessao, ong: Usuario, *, situacao: str = "publicada",
                     dia: date | None = None, inicio: time = time(8),
                     fim: time = time(12), titulo: str = "Mutirão") -> Atividade:
    atividade = Atividade(
        ong_id=ong.id, titulo=titulo, descricao="Descrição da ação.",
        local="Praia do Futuro", cidade="Fortaleza", estado="CE",
        data=dia or (date.today() + timedelta(days=3)),
        hora_inicio=inicio, hora_fim=fim, carga_horaria=4,
        vagas_min=1, vagas_max=10, situacao=situacao,
    )
    sessao.add(atividade)
    await sessao.flush()
    return atividade


async def _inscrever(sessao, atividade: Atividade, aluno: Usuario, *,
                     situacao: str = "confirmada", checkin: bool = False) -> Inscricao:
    inscricao = Inscricao(atividade_id=atividade.id, usuario_id=aluno.id,
                          situacao=situacao,
                          checkin_em=AGORA if checkin else None,
                          checkin_origem="qr" if checkin else None)
    sessao.add(inscricao)
    await sessao.flush()
    return inscricao


async def _certificado(sessao, atividade: Atividade, aluno: Usuario, horas: int, *,
                       revogado: bool = False) -> Certificado:
    inscricao = await _inscrever(sessao, atividade, aluno, situacao="presente")
    cert = Certificado(
        inscricao_id=inscricao.id, usuario_id=aluno.id, atividade_id=atividade.id,
        codigo_verificacao=uuid.uuid4().hex[:16], horas=horas,
        nome_no_certificado=aluno.nome, nome_organizacao="ONG",
        titulo_atividade=atividade.titulo, data_atividade=atividade.data,
        assinatura="x",
        revogado_em=AGORA if revogado else None,
        motivo_revogacao="teste" if revogado else None,
    )
    sessao.add(cert)
    await sessao.flush()
    return cert


def _em_andamento() -> tuple[date, time, time]:
    """Hoje, com a atividade começada e ainda não terminada."""
    agora = atividade_service.agora()
    inicio = (agora - timedelta(hours=1)).time()
    fim = (agora + timedelta(hours=1)).time()
    return atividade_service.hoje(), inicio, fim


async def _painel_do_aluno(cliente, aluno: Usuario) -> dict:
    resposta = await cliente.get("/api/v1/painel/estudante", headers=_como(aluno))
    assert resposta.status_code == 200, resposta.text
    return resposta.json()


async def _painel_da_ong(cliente, ong: Usuario) -> dict:
    resposta = await cliente.get("/api/v1/painel/ong", headers=_como(ong))
    assert resposta.status_code == 200, resposta.text
    return resposta.json()


# ===================== Acesso =====================


async def test_cada_painel_e_do_seu_papel(cliente, sessao):
    aluno = await _usuario(sessao, "estudante", "Maria")
    ong = await _usuario(sessao, "ong", "Verde Vida")

    assert (await cliente.get("/api/v1/painel/ong",
                              headers=_como(aluno))).status_code == 403
    assert (await cliente.get("/api/v1/painel/estudante",
                              headers=_como(ong))).status_code == 403
    assert (await cliente.get("/api/v1/painel/estudante")).status_code == 401


# ===================== E1 — aluno =====================


async def test_painel_do_aluno_zerado(cliente, sessao):
    aluno = await _usuario(sessao, "estudante", "Maria")

    corpo = await _painel_do_aluno(cliente, aluno)

    assert corpo["horasValidadas"] == 0
    assert corpo["certificados"] == 0
    assert corpo["inscricoesAtivas"] == 0
    assert corpo["limiteInscricoes"] == 5
    assert corpo["proximaAtividade"] is None
    assert corpo["destaque"]["tipo"] == "nenhum"


async def test_horas_somam_so_certificado_valido(cliente, sessao):
    aluno = await _usuario(sessao, "estudante", "Maria")
    ong = await _usuario(sessao, "ong", "Verde Vida")
    # Uma atividade por certificado: o banco não deixa o mesmo aluno se
    # inscrever duas vezes na mesma (UNIQUE atividade+usuário).
    for horas, revogado in ((4, False), (3, False), (9, True)):
        feita = await _atividade(sessao, ong, situacao="finalizada",
                                 dia=date.today() - timedelta(days=5),
                                 titulo=f"Ação de {horas}h")
        await _certificado(sessao, feita, aluno, horas, revogado=revogado)

    corpo = await _painel_do_aluno(cliente, aluno)

    assert corpo["certificados"] == 2
    assert corpo["horasValidadas"] == 7


async def test_inscricoes_ativas_conta_so_o_que_vem_pela_frente(cliente, sessao):
    aluno = await _usuario(sessao, "estudante", "Maria")
    ong = await _usuario(sessao, "ong", "Verde Vida")
    await _inscrever(sessao, await _atividade(sessao, ong), aluno)
    await _inscrever(sessao, await _atividade(sessao, ong, titulo="Outra"), aluno,
                     situacao="pendente")
    passada = await _atividade(sessao, ong, situacao="finalizada",
                               dia=date.today() - timedelta(days=2), titulo="Antiga")
    await _inscrever(sessao, passada, aluno, situacao="presente")

    corpo = await _painel_do_aluno(cliente, aluno)

    assert corpo["inscricoesAtivas"] == 2
    assert corpo["proximaAtividade"]["titulo"] == "Mutirão"


async def test_destaque_do_aluno_e_o_checkin_quando_acontece_agora(cliente, sessao):
    aluno = await _usuario(sessao, "estudante", "Maria")
    ong = await _usuario(sessao, "ong", "Verde Vida")
    dia, inicio, fim = _em_andamento()
    rolando = await _atividade(sessao, ong, dia=dia, inicio=inicio, fim=fim,
                               titulo="Mutirão de limpeza")
    await _inscrever(sessao, rolando, aluno)
    # Mesmo com certificado novo esperando, o check-in vem primeiro.
    sessao.add(Notificacao(destinatario_id=aluno.id, tipo="certificado.emitido",
                           titulo="Certificado", mensagem="Saiu"))
    await sessao.flush()

    destaque = (await _painel_do_aluno(cliente, aluno))["destaque"]

    assert destaque["tipo"] == "checkin_disponivel"
    assert destaque["atividade"]["id"] == str(rolando.id)
    assert "acontecendo agora" in destaque["titulo"]


async def test_depois_do_checkin_o_destaque_deixa_de_cobrar(cliente, sessao):
    aluno = await _usuario(sessao, "estudante", "Maria")
    ong = await _usuario(sessao, "ong", "Verde Vida")
    dia, inicio, fim = _em_andamento()
    rolando = await _atividade(sessao, ong, dia=dia, inicio=inicio, fim=fim)
    await _inscrever(sessao, rolando, aluno, checkin=True)

    destaque = (await _painel_do_aluno(cliente, aluno))["destaque"]

    assert destaque["tipo"] == "evento_hoje"
    assert "presença já foi registrada" in destaque["mensagem"]


async def test_inscricao_pendente_nao_vira_destaque_de_checkin(cliente, sessao):
    aluno = await _usuario(sessao, "estudante", "Maria")
    ong = await _usuario(sessao, "ong", "Verde Vida")
    dia, inicio, fim = _em_andamento()
    rolando = await _atividade(sessao, ong, dia=dia, inicio=inicio, fim=fim)
    await _inscrever(sessao, rolando, aluno, situacao="pendente")

    destaque = (await _painel_do_aluno(cliente, aluno))["destaque"]

    assert destaque["tipo"] == "nenhum"


async def test_evento_de_hoje_antes_de_comecar(cliente, sessao):
    aluno = await _usuario(sessao, "estudante", "Maria")
    ong = await _usuario(sessao, "ong", "Verde Vida")
    agora = atividade_service.agora()
    if agora.hour >= 22:
        pytest.skip("perto da meia-noite não há horário futuro no mesmo dia")
    inicio = (agora + timedelta(hours=1)).time()
    fim = (agora + timedelta(hours=2)).time()
    hoje = await _atividade(sessao, ong, dia=atividade_service.hoje(),
                            inicio=inicio, fim=fim, titulo="Oficina de leitura")
    await _inscrever(sessao, hoje, aluno)

    destaque = (await _painel_do_aluno(cliente, aluno))["destaque"]

    assert destaque["tipo"] == "evento_hoje"
    assert destaque["titulo"] == "Oficina de leitura é hoje"
    assert "Praia do Futuro" in destaque["mensagem"]


async def test_certificado_novo_so_enquanto_o_aviso_nao_foi_lido(cliente, sessao):
    aluno = await _usuario(sessao, "estudante", "Maria")
    aviso = Notificacao(destinatario_id=aluno.id, tipo="certificado.emitido",
                        titulo="Certificado emitido", mensagem="Saiu")
    sessao.add(aviso)
    await sessao.flush()

    destaque = (await _painel_do_aluno(cliente, aluno))["destaque"]
    assert destaque["tipo"] == "certificado_novo"
    assert destaque["titulo"] == "Você tem 1 certificado novo"

    aviso.lida_em = AGORA
    await sessao.flush()

    assert (await _painel_do_aluno(cliente, aluno))["destaque"]["tipo"] == "nenhum"


# ===================== O1 — ONG =====================


async def test_painel_da_ong_zerado(cliente, sessao):
    ong = await _usuario(sessao, "ong", "Verde Vida")

    corpo = await _painel_da_ong(cliente, ong)

    assert corpo == {
        "atividadesPublicadas": 0, "voluntariosEngajados": 0,
        "certificadosEmitidos": 0, "inscricoesPendentes": 0, "rascunhos": 0,
        "aguardandoValidacao": 0,
        "destaque": {
            "tipo": "nenhum", "titulo": "Nada pendente por aqui",
            "mensagem": "Publique uma atividade para receber voluntários.",
            "atividade": None, "quantidade": None,
        },
    }


async def test_indicadores_da_ong_nao_contam_o_que_e_de_outra(cliente, sessao):
    ong = await _usuario(sessao, "ong", "Verde Vida")
    outra = await _usuario(sessao, "ong", "Outra ONG")
    aluno = await _usuario(sessao, "estudante", "Maria")
    dia, inicio, fim = _em_andamento()

    await _atividade(sessao, ong)                                   # vai acontecer
    await _atividade(sessao, ong, dia=dia, inicio=inicio, fim=fim)  # acontecendo
    await _atividade(sessao, ong, situacao="rascunho", titulo="Rascunho")
    terminada = await _atividade(sessao, ong, situacao="finalizada",
                                 dia=date.today() - timedelta(days=4))
    await _certificado(sessao, terminada, aluno, 4)
    da_outra = await _atividade(sessao, outra, titulo="Da outra")
    await _inscrever(sessao, da_outra, aluno)
    await _certificado(sessao, da_outra, await _usuario(sessao, "estudante", "João"), 3)

    corpo = await _painel_da_ong(cliente, ong)

    assert corpo["atividadesPublicadas"] == 2
    assert corpo["certificadosEmitidos"] == 1
    assert corpo["rascunhos"] == 1


async def test_voluntario_que_volta_conta_uma_vez(cliente, sessao):
    ong = await _usuario(sessao, "ong", "Verde Vida")
    maria = await _usuario(sessao, "estudante", "Maria")
    joao = await _usuario(sessao, "estudante", "João")
    primeira = await _atividade(sessao, ong, titulo="Primeira")
    segunda = await _atividade(sessao, ong, titulo="Segunda")
    await _inscrever(sessao, primeira, maria)
    await _inscrever(sessao, segunda, maria, situacao="presente")
    await _inscrever(sessao, primeira, joao)
    # Pendente e cancelada não são engajamento.
    await _inscrever(sessao, segunda, await _usuario(sessao, "estudante", "Ana"),
                     situacao="pendente")
    await _inscrever(sessao, primeira, await _usuario(sessao, "estudante", "Léo"),
                     situacao="cancelada")

    corpo = await _painel_da_ong(cliente, ong)

    assert corpo["voluntariosEngajados"] == 2
    assert corpo["inscricoesPendentes"] == 1


async def test_destaque_da_ong_segue_a_ordem_da_especificacao(cliente, sessao):
    ong = await _usuario(sessao, "ong", "Verde Vida")
    aluno = await _usuario(sessao, "estudante", "Maria")
    await _atividade(sessao, ong, situacao="rascunho", titulo="Rascunho")

    # Só rascunho parado.
    assert (await _painel_da_ong(cliente, ong))["destaque"]["tipo"] == "rascunho_parado"

    # Chega um pedido de inscrição: ele passa na frente.
    futura = await _atividade(sessao, ong, titulo="Futura")
    await _inscrever(sessao, futura, aluno, situacao="pendente")
    assert (await _painel_da_ong(cliente, ong))["destaque"]["tipo"] == "inscricoes_pendentes"

    # Uma atividade terminou sem validação: ela é mais urgente.
    ontem = date.today() - timedelta(days=1)
    await _atividade(sessao, ong, dia=ontem, titulo="Terminou ontem")
    destaque = (await _painel_da_ong(cliente, ong))["destaque"]
    assert destaque["tipo"] == "validar_presencas"
    assert destaque["atividade"]["titulo"] == "Terminou ontem"

    # E o que está acontecendo agora vem antes de tudo.
    dia, inicio, fim = _em_andamento()
    await _atividade(sessao, ong, dia=dia, inicio=inicio, fim=fim, titulo="Agora")
    destaque = (await _painel_da_ong(cliente, ong))["destaque"]
    assert destaque["tipo"] == "checkin_disponivel"
    assert destaque["atividade"]["titulo"] == "Agora"

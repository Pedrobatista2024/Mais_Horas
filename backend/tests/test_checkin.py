"""
Testes de check-in e presença — FE-05 e FO-07 a FO-09 de docs/fluxos.md.

O caso que mais importa aqui é o do print no WhatsApp: o código fotografado
precisa chegar vencido na mão de quem não foi ao evento.
"""

from __future__ import annotations

import time
import uuid
from datetime import date, time as hora_do_dia, timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core import rate_limit, security
from app.core.config import config
from app.db.models import Atividade, Inscricao, RegistroAuditoria
from app.db.session import obter_sessao
from app.main import app

SENHA = "senha-bem-longa-123"


@pytest.fixture(autouse=True)
def _sem_limite():
    rate_limit.zerar()
    yield
    rate_limit.zerar()


@pytest.fixture
async def cliente(sessao):
    async def _sessao_de_teste():
        yield sessao

    app.dependency_overrides[obter_sessao] = _sessao_de_teste
    async with AsyncClient(transport=ASGITransport(app=app),
                           base_url="http://teste") as c:
        yield c
    app.dependency_overrides.clear()


def _como(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _cadastrar(cliente, papel: str) -> tuple[str, str]:
    resposta = await cliente.post("/api/v1/auth/cadastro", json={
        "nome": "ONG Verde Vida" if papel == "ong" else "Maria Silva",
        "email": f"{uuid.uuid4().hex[:12]}@teste.com",
        "senha": SENHA, "papel": papel,
    })
    corpo = resposta.json()
    return corpo["usuario"]["id"], corpo["token"]


async def _aluno_pronto(cliente) -> tuple[str, str]:
    aluno_id, token = await _cadastrar(cliente, "estudante")
    await cliente.put("/api/v1/perfil", headers=_como(token), json={
        "nome_completo": "Maria da Silva Souza", "instituicao": "UniC",
        "curso": "Sistemas de Informação",
    })
    return aluno_id, token


async def _atividade_publicada(cliente, ong_token: str, **extra) -> dict:
    dados = {
        "titulo": "Mutirão de limpeza",
        "descricao": "Limpeza da praia com a comunidade.",
        "local": "Praia do Futuro", "cidade": "Fortaleza",
        "data": (date.today() + timedelta(days=1)).isoformat(),
        "hora_inicio": "08:00", "hora_fim": "12:00",
        "vagas_min": 1, "vagas_max": 10,
    }
    dados.update(extra)
    criada = await cliente.post("/api/v1/atividades", json=dados,
                                headers=_como(ong_token))
    assert criada.status_code == 201, criada.text
    publicada = await cliente.post(
        f"/api/v1/atividades/{criada.json()['id']}/publicar",
        headers=_como(ong_token))
    assert publicada.status_code == 200, publicada.text
    return publicada.json()


async def _colocar_em_andamento(sessao, atividade_id: str) -> None:
    """
    Empurra a atividade para a janela do relógio.

    `em_andamento` é derivada (RN-54), então não existe endpoint que a ligue: o
    jeito de chegar lá é a atividade ser hoje, agora.
    """
    atividade = await sessao.get(Atividade, uuid.UUID(atividade_id))
    atividade.data = date.today()
    atividade.hora_inicio = hora_do_dia(0, 0)
    atividade.hora_fim = hora_do_dia(23, 59)
    await sessao.commit()


async def _colocar_para_validar(sessao, atividade_id: str) -> None:
    atividade = await sessao.get(Atividade, uuid.UUID(atividade_id))
    atividade.data = date.today() - timedelta(days=1)
    await sessao.commit()


async def _cenario(cliente, sessao, *, em_andamento=True, **extra):
    """(ong_token, aluno_id, aluno_token, atividade, inscricao)."""
    _, ong = await _cadastrar(cliente, "ong")
    atividade = await _atividade_publicada(cliente, ong, **extra)
    aluno_id, aluno = await _aluno_pronto(cliente)
    inscricao = (await cliente.post("/api/v1/inscricoes",
                                    json={"atividadeId": atividade["id"]},
                                    headers=_como(aluno))).json()
    if em_andamento:
        await _colocar_em_andamento(sessao, atividade["id"])
    return ong, aluno_id, aluno, atividade, inscricao


# ===================== Painel da ONG (FO-07) =====================


async def test_painel_entrega_token_e_contagem(cliente, sessao):
    ong, _, _, atividade, _ = await _cenario(cliente, sessao)

    resposta = await cliente.get(
        f"/api/v1/atividades/{atividade['id']}/checkin/token", headers=_como(ong))
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["token"].startswith("MH1.")
    assert 0 < corpo["validoPor"] <= config.checkin_janela_segundos


async def test_painel_so_abre_com_atividade_em_andamento(cliente, sessao):
    ong, _, _, atividade, _ = await _cenario(cliente, sessao, em_andamento=False)

    resposta = await cliente.get(
        f"/api/v1/atividades/{atividade['id']}/checkin/token", headers=_como(ong))
    assert resposta.status_code == 403
    assert resposta.json()["codigo"] == "checkin_fora_da_janela"


async def test_ong_nao_abre_painel_alheio(cliente, sessao):
    _, _, _, atividade, _ = await _cenario(cliente, sessao)
    _, outra = await _cadastrar(cliente, "ong")

    resposta = await cliente.get(
        f"/api/v1/atividades/{atividade['id']}/checkin/token", headers=_como(outra))
    assert resposta.status_code == 403
    assert resposta.json()["codigo"] == "nao_e_dono"


async def test_aluno_nao_abre_painel(cliente, sessao):
    """Se o aluno pegasse o token, poderia repassá-lo sem estar no local."""
    _, _, aluno, atividade, _ = await _cenario(cliente, sessao)

    resposta = await cliente.get(
        f"/api/v1/atividades/{atividade['id']}/checkin/token", headers=_como(aluno))
    assert resposta.status_code == 403


async def test_abertura_do_painel_e_auditada_uma_vez(cliente, sessao):
    """O cliente rebusca o token a cada 30 s; auditar cada busca seria ruído."""
    ong, _, _, atividade, _ = await _cenario(cliente, sessao)

    for _ in range(3):
        await cliente.get(f"/api/v1/atividades/{atividade['id']}/checkin/token",
                          headers=_como(ong))

    registros = (await sessao.scalars(
        select(RegistroAuditoria)
        .where(RegistroAuditoria.acao == "checkin.painel_aberto"))).all()
    assert len(registros) == 1


async def test_painel_lista_quem_chegou(cliente, sessao):
    ong, _, aluno, atividade, _ = await _cenario(cliente, sessao)
    token = (await cliente.get(
        f"/api/v1/atividades/{atividade['id']}/checkin/token",
        headers=_como(ong))).json()["token"]
    await cliente.post("/api/v1/checkin", json={"token": token},
                       headers=_como(aluno))

    corpo = (await cliente.get(
        f"/api/v1/atividades/{atividade['id']}/checkin/painel",
        headers=_como(ong))).json()
    assert corpo["inscritos"] == 1
    assert corpo["presentes"] == 1
    assert corpo["itens"][0]["checkinOrigem"] == "qr"
    assert corpo["itens"][0]["aluno"]["nome"] == "Maria da Silva Souza"


# ===================== Check-in do aluno (FE-05) =====================


async def test_checkin_pelo_qr_registra(cliente, sessao):
    ong, _, aluno, atividade, inscricao = await _cenario(cliente, sessao)
    token = (await cliente.get(
        f"/api/v1/atividades/{atividade['id']}/checkin/token",
        headers=_como(ong))).json()["token"]

    resposta = await cliente.post("/api/v1/checkin", json={"token": token},
                                  headers=_como(aluno))
    assert resposta.status_code == 200, resposta.text
    assert resposta.json()["origem"] == "qr"
    assert resposta.json()["inscricaoId"] == inscricao["id"]


async def test_checkin_nao_decide_presenca(cliente, sessao):
    """RN-23 — o check-in é evidência; quem decide é a ONG em `O7`."""
    ong, _, aluno, atividade, inscricao = await _cenario(cliente, sessao)
    token = security.gerar_token_checkin(atividade["id"])
    await cliente.post("/api/v1/checkin", json={"token": token},
                       headers=_como(aluno))

    gravada = await sessao.get(Inscricao, uuid.UUID(inscricao["id"]))
    await sessao.refresh(gravada)
    assert gravada.situacao == "confirmada"
    assert gravada.checkin_em is not None


async def test_codigo_fotografado_chega_vencido(cliente, sessao):
    """
    O coração da proteção.

    O colega tira o print, manda no WhatsApp e o ausente tenta usar. Aqui o
    código tem 40 s de idade — além do máximo que qualquer token vive.
    """
    _, _, aluno, atividade, _ = await _cenario(cliente, sessao)
    duracao = config.checkin_janela_segundos
    janela_antiga = int((time.time() - 40) // duracao)
    antigo = security.gerar_token_checkin(atividade["id"], janela_antiga)

    resposta = await cliente.post("/api/v1/checkin", json={"token": antigo},
                                  headers=_como(aluno))
    assert resposta.status_code == 400
    assert resposta.json()["codigo"] == "token_expirado"


async def test_mensagem_de_vencido_e_convite_e_nao_bronca(cliente, sessao):
    """O QR roda a cada 30 s: vencer é o caso comum, não falha do aluno."""
    _, _, aluno, atividade, _ = await _cenario(cliente, sessao)
    janela = int(time.time() // config.checkin_janela_segundos)
    antigo = security.gerar_token_checkin(atividade["id"], janela - 10)

    mensagem = (await cliente.post("/api/v1/checkin", json={"token": antigo},
                                   headers=_como(aluno))).json()["mensagem"]
    assert "Aponte de novo" in mensagem


async def test_token_forjado_sem_o_segredo_e_recusado(cliente, sessao, monkeypatch):
    _, _, aluno, atividade, _ = await _cenario(cliente, sessao)
    monkeypatch.setattr(config, "checkin_secret", "segredo-do-atacante")
    forjado = security.gerar_token_checkin(atividade["id"])
    monkeypatch.undo()

    resposta = await cliente.post("/api/v1/checkin", json={"token": forjado},
                                  headers=_como(aluno))
    assert resposta.status_code == 400
    assert resposta.json()["codigo"] == "token_invalido"


async def test_token_de_outra_atividade_nao_serve(cliente, sessao):
    """Impede usar o QR de um evento para marcar presença em outro."""
    _, _, aluno, atividade, _ = await _cenario(cliente, sessao)
    _, outra_ong = await _cadastrar(cliente, "ong")
    outra = await _atividade_publicada(cliente, outra_ong)
    await _colocar_em_andamento(sessao, outra["id"])

    resposta = await cliente.post(
        "/api/v1/checkin", json={"token": security.gerar_token_checkin(outra["id"])},
        headers=_como(aluno))
    assert resposta.status_code == 403
    assert resposta.json()["codigo"] == "sem_inscricao_confirmada"


async def test_token_malformado_nao_derruba_a_api(cliente, sessao):
    _, _, aluno, _, _ = await _cenario(cliente, sessao)

    for lixo in ("", "abc", "MH1.x", "MH1.###.1.###"):
        resposta = await cliente.post("/api/v1/checkin", json={"token": lixo},
                                      headers=_como(aluno))
        assert resposta.status_code in (400, 422), lixo


async def test_nao_faz_checkin_duas_vezes(cliente, sessao):
    ong, _, aluno, atividade, _ = await _cenario(cliente, sessao)
    token = security.gerar_token_checkin(atividade["id"])
    await cliente.post("/api/v1/checkin", json={"token": token},
                       headers=_como(aluno))

    repetido = await cliente.post("/api/v1/checkin", json={"token": token},
                                  headers=_como(aluno))
    assert repetido.status_code == 409
    assert repetido.json()["codigo"] == "checkin_ja_registrado"


async def test_sem_inscricao_nao_faz_checkin(cliente, sessao):
    _, ong = await _cadastrar(cliente, "ong")
    atividade = await _atividade_publicada(cliente, ong)
    await _colocar_em_andamento(sessao, atividade["id"])
    _, estranho = await _aluno_pronto(cliente)

    resposta = await cliente.post(
        "/api/v1/checkin",
        json={"token": security.gerar_token_checkin(atividade["id"])},
        headers=_como(estranho))
    assert resposta.status_code == 403
    assert resposta.json()["codigo"] == "sem_inscricao_confirmada"


async def test_inscricao_pendente_nao_faz_checkin(cliente, sessao):
    """Quem a ONG ainda não aprovou não conta como participante."""
    _, _, aluno, atividade, _ = await _cenario(cliente, sessao,
                                               exige_aprovacao=True)

    resposta = await cliente.post(
        "/api/v1/checkin",
        json={"token": security.gerar_token_checkin(atividade["id"])},
        headers=_como(aluno))
    assert resposta.status_code == 403


async def test_checkin_fora_do_horario_da_atividade(cliente, sessao):
    """RN-21 — antes de começar, o check-in não está aberto."""
    _, _, aluno, atividade, _ = await _cenario(cliente, sessao, em_andamento=False)

    resposta = await cliente.post(
        "/api/v1/checkin",
        json={"token": security.gerar_token_checkin(atividade["id"])},
        headers=_como(aluno))
    assert resposta.status_code == 400
    assert resposta.json()["codigo"] == "checkin_fora_da_janela"


async def test_ong_nao_faz_checkin_de_si(cliente, sessao):
    ong, _, _, atividade, _ = await _cenario(cliente, sessao)

    resposta = await cliente.post(
        "/api/v1/checkin",
        json={"token": security.gerar_token_checkin(atividade["id"])},
        headers=_como(ong))
    assert resposta.status_code == 403


async def test_geolocalizacao_e_gravada_quando_enviada(cliente, sessao):
    ong, _, aluno, atividade, inscricao = await _cenario(cliente, sessao)

    await cliente.post("/api/v1/checkin", headers=_como(aluno), json={
        "token": security.gerar_token_checkin(atividade["id"]),
        "latitude": -3.7327, "longitude": -38.5270,
    })

    gravada = await sessao.get(Inscricao, uuid.UUID(inscricao["id"]))
    await sessao.refresh(gravada)
    assert float(gravada.checkin_latitude) == pytest.approx(-3.7327, abs=1e-4)


async def test_tentativa_com_token_invalido_e_auditada(cliente, sessao):
    """A trilha precisa registrar quem tentou entrar com código que não vale."""
    _, _, aluno, atividade, _ = await _cenario(cliente, sessao)
    janela = int(time.time() // config.checkin_janela_segundos)
    await cliente.post(
        "/api/v1/checkin",
        json={"token": security.gerar_token_checkin(atividade["id"], janela - 10)},
        headers=_como(aluno))

    registro = await sessao.scalar(
        select(RegistroAuditoria)
        .where(RegistroAuditoria.acao == "checkin.token_invalido"))
    assert registro is not None
    assert registro.depois["motivo"] == "expirado"


# ===================== Check-in manual (FO-08) =====================


async def test_ong_registra_quem_esta_sem_celular(cliente, sessao):
    ong, _, _, atividade, inscricao = await _cenario(cliente, sessao)

    resposta = await cliente.post(
        f"/api/v1/atividades/{atividade['id']}/checkin/manual",
        json={"inscricaoId": inscricao["id"]}, headers=_como(ong))
    assert resposta.status_code == 200, resposta.text
    assert resposta.json()["checkinOrigem"] == "manual"


async def test_manual_grava_quem_registrou(cliente, sessao):
    """RN-43 — sem responsável, a distinção de origem perderia metade do valor."""
    ong_id, ong = await _cadastrar(cliente, "ong")
    atividade = await _atividade_publicada(cliente, ong)
    _, aluno = await _aluno_pronto(cliente)
    inscricao = (await cliente.post("/api/v1/inscricoes",
                                    json={"atividadeId": atividade["id"]},
                                    headers=_como(aluno))).json()
    await _colocar_em_andamento(sessao, atividade["id"])

    await cliente.post(f"/api/v1/atividades/{atividade['id']}/checkin/manual",
                       json={"inscricaoId": inscricao["id"]}, headers=_como(ong))

    gravada = await sessao.get(Inscricao, uuid.UUID(inscricao["id"]))
    await sessao.refresh(gravada)
    assert str(gravada.checkin_registrado_por) == ong_id


async def test_manual_nao_repete(cliente, sessao):
    ong, _, aluno, atividade, inscricao = await _cenario(cliente, sessao)
    await cliente.post("/api/v1/checkin",
                       json={"token": security.gerar_token_checkin(atividade["id"])},
                       headers=_como(aluno))

    resposta = await cliente.post(
        f"/api/v1/atividades/{atividade['id']}/checkin/manual",
        json={"inscricaoId": inscricao["id"]}, headers=_como(ong))
    assert resposta.status_code == 409


async def test_ong_nao_registra_em_atividade_alheia(cliente, sessao):
    _, _, _, atividade, inscricao = await _cenario(cliente, sessao)
    _, outra = await _cadastrar(cliente, "ong")

    resposta = await cliente.post(
        f"/api/v1/atividades/{atividade['id']}/checkin/manual",
        json={"inscricaoId": inscricao["id"]}, headers=_como(outra))
    assert resposta.status_code == 403


async def test_aluno_nao_registra_manualmente(cliente, sessao):
    _, _, aluno, atividade, inscricao = await _cenario(cliente, sessao)

    resposta = await cliente.post(
        f"/api/v1/atividades/{atividade['id']}/checkin/manual",
        json={"inscricaoId": inscricao["id"]}, headers=_como(aluno))
    assert resposta.status_code == 403


# ===================== Validação de presença (FO-09) =====================


async def test_lista_de_validacao_vem_pre_preenchida(cliente, sessao):
    ong, _, aluno, atividade, _ = await _cenario(cliente, sessao)
    await cliente.post("/api/v1/checkin",
                       json={"token": security.gerar_token_checkin(atividade["id"])},
                       headers=_como(aluno))
    await _colocar_para_validar(sessao, atividade["id"])

    corpo = (await cliente.get(f"/api/v1/atividades/{atividade['id']}/presencas",
                               headers=_como(ong))).json()
    assert corpo["comCheckin"] == 1
    assert corpo["semDecisao"] == 1
    assert corpo["itens"][0]["sugestao"] == "presente"


async def test_sem_checkin_a_sugestao_e_ausente(cliente, sessao):
    ong, _, _, atividade, _ = await _cenario(cliente, sessao)
    await _colocar_para_validar(sessao, atividade["id"])

    corpo = (await cliente.get(f"/api/v1/atividades/{atividade['id']}/presencas",
                               headers=_como(ong))).json()
    assert corpo["itens"][0]["sugestao"] == "ausente"
    assert corpo["comCheckin"] == 0


async def test_marcar_presenca(cliente, sessao):
    ong, _, _, atividade, inscricao = await _cenario(cliente, sessao)
    await _colocar_para_validar(sessao, atividade["id"])

    resposta = await cliente.put(f"/api/v1/inscricoes/{inscricao['id']}/presenca",
                                 json={"situacao": "presente"}, headers=_como(ong))
    assert resposta.status_code == 200
    assert resposta.json()["situacao"] == "presente"
    assert resposta.json()["decidida"] is True


async def test_ong_pode_discordar_do_checkin(cliente, sessao):
    """
    FO-09 A3 — quem fez check-in e foi embora cedo pode ser marcado ausente.

    O check-in **continua gravado**: a divergência é o que se quer poder auditar.
    """
    ong, _, aluno, atividade, inscricao = await _cenario(cliente, sessao)
    await cliente.post("/api/v1/checkin",
                       json={"token": security.gerar_token_checkin(atividade["id"])},
                       headers=_como(aluno))
    await _colocar_para_validar(sessao, atividade["id"])

    resposta = await cliente.put(f"/api/v1/inscricoes/{inscricao['id']}/presenca",
                                 json={"situacao": "ausente"}, headers=_como(ong))
    assert resposta.json()["situacao"] == "ausente"
    assert resposta.json()["checkinEm"] is not None

    registro = await sessao.scalar(
        select(RegistroAuditoria)
        .where(RegistroAuditoria.acao == "presenca.validada"))
    assert registro.depois["teve_checkin"] is True
    assert registro.depois["situacao"] == "ausente"


async def test_ong_nao_marca_presenca_alheia(cliente, sessao):
    """A falha L2 de docs/requisitos.md: a checagem é do serviço, não do papel."""
    _, _, _, atividade, inscricao = await _cenario(cliente, sessao)
    await _colocar_para_validar(sessao, atividade["id"])
    _, outra = await _cadastrar(cliente, "ong")

    resposta = await cliente.put(f"/api/v1/inscricoes/{inscricao['id']}/presenca",
                                 json={"situacao": "presente"}, headers=_como(outra))
    assert resposta.status_code == 403
    assert resposta.json()["codigo"] == "nao_e_dono"


async def test_presenca_so_depois_que_a_atividade_termina(cliente, sessao):
    ong, _, _, atividade, inscricao = await _cenario(cliente, sessao)

    resposta = await cliente.put(f"/api/v1/inscricoes/{inscricao['id']}/presenca",
                                 json={"situacao": "presente"}, headers=_como(ong))
    assert resposta.status_code == 400
    assert resposta.json()["codigo"] == "situacao_invalida"


async def test_situacao_de_presenca_invalida_e_recusada(cliente, sessao):
    ong, _, _, atividade, inscricao = await _cenario(cliente, sessao)
    await _colocar_para_validar(sessao, atividade["id"])

    resposta = await cliente.put(f"/api/v1/inscricoes/{inscricao['id']}/presenca",
                                 json={"situacao": "talvez"}, headers=_como(ong))
    assert resposta.status_code == 400


async def test_lote_marca_varios_de_uma_vez(cliente, sessao):
    _, ong = await _cadastrar(cliente, "ong")
    atividade = await _atividade_publicada(cliente, ong)
    ids = []
    for _ in range(3):
        _, aluno = await _aluno_pronto(cliente)
        ids.append((await cliente.post("/api/v1/inscricoes",
                                       json={"atividadeId": atividade["id"]},
                                       headers=_como(aluno))).json()["id"])
    await _colocar_para_validar(sessao, atividade["id"])

    resposta = await cliente.put(
        f"/api/v1/atividades/{atividade['id']}/presencas", headers=_como(ong),
        json={"decisoes": [{"inscricaoId": i, "situacao": "presente"} for i in ids]})
    assert resposta.status_code == 200
    assert resposta.json()["alteradas"] == 3


# ===================== Finalização (FO-09) =====================


async def _validar_todos(cliente, ong: str, atividade_id: str, situacao: str) -> None:
    lista = (await cliente.get(f"/api/v1/atividades/{atividade_id}/presencas",
                               headers=_como(ong))).json()
    await cliente.put(
        f"/api/v1/atividades/{atividade_id}/presencas", headers=_como(ong),
        json={"decisoes": [{"inscricaoId": i["inscricaoId"], "situacao": situacao}
                           for i in lista["itens"]]})


async def test_finalizar_credita_as_horas_de_quem_esteve(cliente, sessao):
    ong, _, _, atividade, inscricao = await _cenario(cliente, sessao)
    await _colocar_para_validar(sessao, atividade["id"])
    await _validar_todos(cliente, ong, atividade["id"], "presente")

    resposta = await cliente.post(f"/api/v1/atividades/{atividade['id']}/finalizar",
                                  headers=_como(ong))
    assert resposta.status_code == 200, resposta.text
    assert resposta.json()["presentes"] == 1
    assert resposta.json()["situacao"] == "finalizada"

    gravada = await sessao.get(Inscricao, uuid.UUID(inscricao["id"]))
    await sessao.refresh(gravada)
    assert gravada.carga_horaria_creditada == atividade["cargaHoraria"]


async def test_ausente_nao_credita_hora(cliente, sessao):
    """RN-14 — presença dá a carga da atividade; ausência dá zero."""
    ong, _, _, atividade, inscricao = await _cenario(cliente, sessao)
    await _colocar_para_validar(sessao, atividade["id"])
    await _validar_todos(cliente, ong, atividade["id"], "ausente")
    await cliente.post(f"/api/v1/atividades/{atividade['id']}/finalizar",
                       headers=_como(ong))

    gravada = await sessao.get(Inscricao, uuid.UUID(inscricao["id"]))
    await sessao.refresh(gravada)
    assert gravada.carga_horaria_creditada == 0


async def test_nao_finaliza_com_alguem_sem_decisao(cliente, sessao):
    """RN-03 — finalizar deixaria a pessoa num limbo: sem certificado e sem aviso."""
    ong, _, _, atividade, _ = await _cenario(cliente, sessao)
    await _colocar_para_validar(sessao, atividade["id"])

    resposta = await cliente.post(f"/api/v1/atividades/{atividade['id']}/finalizar",
                                  headers=_como(ong))
    assert resposta.status_code == 400
    assert resposta.json()["codigo"] == "presencas_pendentes"
    assert len(resposta.json()["detalhes"]) == 1


async def test_finaliza_sem_ninguem_inscrito(cliente, sessao):
    """FO-09 A7 — evento que ninguém procurou também precisa poder encerrar."""
    _, ong = await _cadastrar(cliente, "ong")
    atividade = await _atividade_publicada(cliente, ong)
    await _colocar_para_validar(sessao, atividade["id"])

    resposta = await cliente.post(f"/api/v1/atividades/{atividade['id']}/finalizar",
                                  headers=_como(ong))
    assert resposta.status_code == 200
    assert resposta.json()["presentes"] == 0


async def test_nao_finaliza_duas_vezes(cliente, sessao):
    ong, _, _, atividade, _ = await _cenario(cliente, sessao)
    await _colocar_para_validar(sessao, atividade["id"])
    await _validar_todos(cliente, ong, atividade["id"], "presente")
    await cliente.post(f"/api/v1/atividades/{atividade['id']}/finalizar",
                       headers=_como(ong))

    resposta = await cliente.post(f"/api/v1/atividades/{atividade['id']}/finalizar",
                                  headers=_como(ong))
    assert resposta.status_code == 400
    assert resposta.json()["codigo"] == "situacao_invalida"


async def test_nao_finaliza_antes_de_terminar(cliente, sessao):
    ong, _, _, atividade, _ = await _cenario(cliente, sessao)

    resposta = await cliente.post(f"/api/v1/atividades/{atividade['id']}/finalizar",
                                  headers=_como(ong))
    assert resposta.status_code == 400


async def test_ong_nao_finaliza_atividade_alheia(cliente, sessao):
    _, _, _, atividade, _ = await _cenario(cliente, sessao)
    await _colocar_para_validar(sessao, atividade["id"])
    _, outra = await _cadastrar(cliente, "ong")

    resposta = await cliente.post(f"/api/v1/atividades/{atividade['id']}/finalizar",
                                  headers=_como(outra))
    assert resposta.status_code == 403


async def test_finalizada_aparece_na_aba_certa(cliente, sessao):
    ong, _, _, atividade, _ = await _cenario(cliente, sessao)
    await _colocar_para_validar(sessao, atividade["id"])
    await _validar_todos(cliente, ong, atividade["id"], "presente")
    await cliente.post(f"/api/v1/atividades/{atividade['id']}/finalizar",
                       headers=_como(ong))

    corpo = (await cliente.get("/api/v1/atividades/minhas?situacao=finalizada",
                               headers=_como(ong))).json()
    assert [i["id"] for i in corpo["itens"]] == [atividade["id"]]


async def test_finalizacao_e_auditada(cliente, sessao):
    ong, _, _, atividade, _ = await _cenario(cliente, sessao)
    await _colocar_para_validar(sessao, atividade["id"])
    await _validar_todos(cliente, ong, atividade["id"], "presente")
    await cliente.post(f"/api/v1/atividades/{atividade['id']}/finalizar",
                       headers=_como(ong))

    registro = await sessao.scalar(
        select(RegistroAuditoria)
        .where(RegistroAuditoria.acao == "atividade.finalizada"))
    assert registro.depois["presentes"] == 1


async def test_inscricao_de_finalizada_cai_no_historico(cliente, sessao):
    ong, _, aluno, atividade, _ = await _cenario(cliente, sessao)
    await _colocar_para_validar(sessao, atividade["id"])
    await _validar_todos(cliente, ong, atividade["id"], "presente")
    await cliente.post(f"/api/v1/atividades/{atividade['id']}/finalizar",
                       headers=_como(ong))

    corpo = (await cliente.get("/api/v1/inscricoes/minhas?grupo=historico",
                               headers=_como(aluno))).json()
    assert corpo["total"] == 1
    assert corpo["itens"][0]["situacao"] == "presente"

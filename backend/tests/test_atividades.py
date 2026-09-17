"""
Testes de atividade — FO-01 a FO-07 de docs/fluxos.md.

O foco está nas regras que o formulário sozinho não garante: quem é dono do quê
(RN-11), o que trava depois que alguém se inscreve (RN-12), e a situação que sai
do relógio em vez do banco (RN-54).
"""

from __future__ import annotations

import json
import uuid
from datetime import date, datetime, time, timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core import rate_limit
from app.db.models import Atividade, Inscricao, RegistroAuditoria
from app.db.session import obter_sessao
from app.main import app
from app.services import atividade_service

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


async def _cadastrar(cliente, papel: str) -> tuple[str, str]:
    """Devolve (id do usuário, token). Não fixa o header — o teste escolhe."""
    resposta = await cliente.post("/api/v1/auth/cadastro", json={
        "nome": "ONG Verde Vida" if papel == "ong" else "Maria Silva",
        "email": f"{uuid.uuid4().hex[:12]}@teste.com",
        "senha": SENHA, "papel": papel,
    })
    corpo = resposta.json()
    return corpo["usuario"]["id"], corpo["token"]


def _como(cliente, token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _em_texto(corpo: dict) -> str:
    return json.dumps(corpo, ensure_ascii=False)


def _amanha() -> str:
    return (date.today() + timedelta(days=1)).isoformat()


def _dados(**extra) -> dict:
    base = {
        "titulo": "Mutirão de limpeza",
        "descricao": "Limpeza da praia do Futuro com a comunidade.",
        "local": "Praia do Futuro",
        "cidade": "Fortaleza",
        "estado": "CE",
        "data": _amanha(),
        "hora_inicio": "08:00",
        "hora_fim": "12:00",
        "vagas_min": 2,
        "vagas_max": 10,
    }
    base.update(extra)
    return base


async def _criar(cliente, token: str, **extra) -> dict:
    resposta = await cliente.post("/api/v1/atividades", json=_dados(**extra),
                                  headers=_como(cliente, token))
    assert resposta.status_code == 201, resposta.text
    return resposta.json()


async def _publicar(cliente, token: str, atividade_id: str) -> dict:
    resposta = await cliente.post(f"/api/v1/atividades/{atividade_id}/publicar",
                                  headers=_como(cliente, token))
    assert resposta.status_code == 200, resposta.text
    return resposta.json()


async def _inscrever(sessao, atividade_id: str, usuario_id: str,
                     situacao: str = "confirmada") -> Inscricao:
    """
    Insere a inscrição direto no banco.

    A Fatia 4 ainda não existe, mas as regras de edição e de vaga dependem de
    haver inscrito — então o estado é montado na mão.
    """
    inscricao = Inscricao(
        atividade_id=uuid.UUID(atividade_id), usuario_id=uuid.UUID(usuario_id),
        situacao=situacao,
    )
    sessao.add(inscricao)
    await sessao.commit()
    return inscricao


# ===================== Carga horária sugerida (RN-48) =====================


def test_carga_sai_do_horario_quando_omitida():
    from app.schemas.atividade import AtividadeEntrada

    entrada = AtividadeEntrada(**_dados())
    assert entrada.carga_horaria == 4


def test_carga_arredonda_para_baixo():
    """3h40 sugere 3 horas: o padrão nunca infla a carga."""
    from app.schemas.atividade import AtividadeEntrada

    entrada = AtividadeEntrada(**_dados(hora_inicio="08:00", hora_fim="11:40"))
    assert entrada.carga_horaria == 3


def test_carga_informada_prevalece():
    from app.schemas.atividade import AtividadeEntrada

    entrada = AtividadeEntrada(**_dados(carga_horaria=6))
    assert entrada.carga_horaria == 6


def test_evento_curto_ainda_vale_uma_hora():
    from app.schemas.atividade import AtividadeEntrada

    entrada = AtividadeEntrada(**_dados(hora_inicio="08:00", hora_fim="08:30"))
    assert entrada.carga_horaria == 1


# ===================== Situação derivada do relógio (RN-54) =====================


def _atividade_falsa(situacao="publicada", inicio="08:00", fim="12:00") -> Atividade:
    return Atividade(
        titulo="x", descricao="x", local="x", situacao=situacao,
        data=date(2030, 6, 10),
        hora_inicio=time.fromisoformat(inicio), hora_fim=time.fromisoformat(fim),
        carga_horaria=4, vagas_min=1, vagas_max=10,
    )


def _momento(hora: str, dia=10) -> datetime:
    return datetime.combine(date(2030, 6, dia), time.fromisoformat(hora),
                            tzinfo=atividade_service.TZ)


def test_antes_do_inicio_continua_publicada():
    atividade = _atividade_falsa()
    assert atividade_service.situacao_real(atividade, _momento("07:59")) == "publicada"


def test_durante_o_evento_fica_em_andamento():
    atividade = _atividade_falsa()
    assert atividade_service.situacao_real(atividade, _momento("10:00")) == "em_andamento"


def test_depois_do_fim_aguarda_validacao():
    atividade = _atividade_falsa()
    situacao = atividade_service.situacao_real(atividade, _momento("12:01"))
    assert situacao == "aguardando_validacao"


def test_rascunho_ignora_o_relogio():
    """Só `publicada` deriva. Rascunho de ontem não vira 'aguardando validação'."""
    atividade = _atividade_falsa(situacao="rascunho")
    assert atividade_service.situacao_real(atividade, _momento("23:59")) == "rascunho"


def test_cancelada_ignora_o_relogio():
    atividade = _atividade_falsa(situacao="cancelada")
    assert atividade_service.situacao_real(atividade, _momento("10:00")) == "cancelada"


# ===================== Criação =====================


async def test_atividade_nasce_como_rascunho(cliente):
    _, token = await _cadastrar(cliente, "ong")
    corpo = await _criar(cliente, token)

    assert corpo["situacao"] == "rascunho"
    assert corpo["vagasOcupadas"] == 0
    assert corpo["vagasRestantes"] == 10
    assert corpo["lotada"] is False


async def test_criacao_registra_auditoria(cliente, sessao):
    _, token = await _cadastrar(cliente, "ong")
    await _criar(cliente, token)

    acao = await sessao.scalar(
        select(RegistroAuditoria.acao)
        .where(RegistroAuditoria.acao == "atividade.rascunho_criado")
    )
    assert acao == "atividade.rascunho_criado"


async def test_estudante_nao_cria_atividade(cliente):
    _, token = await _cadastrar(cliente, "estudante")
    resposta = await cliente.post("/api/v1/atividades", json=_dados(),
                                  headers=_como(cliente, token))
    assert resposta.status_code == 403


async def test_visitante_nao_cria_atividade(cliente):
    resposta = await cliente.post("/api/v1/atividades", json=_dados())
    assert resposta.status_code == 401


async def test_data_no_passado_e_recusada(cliente):
    _, token = await _cadastrar(cliente, "ong")
    ontem = (date.today() - timedelta(days=1)).isoformat()
    resposta = await cliente.post("/api/v1/atividades", json=_dados(data=ontem),
                                  headers=_como(cliente, token))

    assert resposta.status_code == 400
    assert resposta.json()["codigo"] == "data_no_passado"


async def test_hora_fim_antes_do_inicio_e_recusada(cliente):
    _, token = await _cadastrar(cliente, "ong")
    resposta = await cliente.post(
        "/api/v1/atividades", json=_dados(hora_inicio="14:00", hora_fim="09:00"),
        headers=_como(cliente, token),
    )
    assert resposta.status_code == 400
    assert resposta.json()["codigo"] == "dados_invalidos"


async def test_vagas_max_menor_que_min_e_recusada(cliente):
    _, token = await _cadastrar(cliente, "ong")
    resposta = await cliente.post(
        "/api/v1/atividades", json=_dados(vagas_min=10, vagas_max=3),
        headers=_como(cliente, token),
    )
    assert resposta.status_code == 400
    assert resposta.json()["codigo"] == "dados_invalidos"


async def test_campo_desconhecido_e_recusado(cliente):
    """`extra="forbid"`: campo a mais é erro, não silêncio.

    Sem isso, um cliente mandando `situacao: "publicada"` seria ignorado em
    silêncio e a ONG acharia que publicou.
    """
    _, token = await _cadastrar(cliente, "ong")
    resposta = await cliente.post(
        "/api/v1/atividades", json=_dados(situacao="publicada"),
        headers=_como(cliente, token),
    )
    assert resposta.status_code == 400
    assert resposta.json()["detalhes"][0]["campo"] == "situacao"


# ===================== Publicação =====================


async def test_publicar_muda_a_situacao(cliente):
    _, token = await _cadastrar(cliente, "ong")
    atividade = await _criar(cliente, token)
    corpo = await _publicar(cliente, token, atividade["id"])

    assert corpo["situacao"] == "publicada"


async def test_publicar_duas_vezes_falha(cliente):
    _, token = await _cadastrar(cliente, "ong")
    atividade = await _criar(cliente, token)
    await _publicar(cliente, token, atividade["id"])

    resposta = await cliente.post(f"/api/v1/atividades/{atividade['id']}/publicar",
                                  headers=_como(cliente, token))
    assert resposta.status_code == 400
    assert resposta.json()["codigo"] == "situacao_invalida"


async def test_ong_nao_publica_atividade_alheia(cliente):
    _, dona = await _cadastrar(cliente, "ong")
    atividade = await _criar(cliente, dona)
    _, outra = await _cadastrar(cliente, "ong")

    resposta = await cliente.post(f"/api/v1/atividades/{atividade['id']}/publicar",
                                  headers=_como(cliente, outra))
    assert resposta.status_code == 403
    assert resposta.json()["codigo"] == "nao_e_dono"


# ===================== Edição (RN-12) =====================


async def test_editar_rascunho_livremente(cliente):
    _, token = await _cadastrar(cliente, "ong")
    atividade = await _criar(cliente, token)

    resposta = await cliente.put(
        f"/api/v1/atividades/{atividade['id']}",
        json={"titulo": "Mutirão no mangue", "local": "Mangue do Cocó"},
        headers=_como(cliente, token),
    )
    assert resposta.status_code == 200
    assert resposta.json()["titulo"] == "Mutirão no mangue"


async def test_com_inscrito_so_as_vagas_mudam(cliente, sessao):
    _, ong = await _cadastrar(cliente, "ong")
    aluno_id, _ = await _cadastrar(cliente, "estudante")
    atividade = await _criar(cliente, ong)
    await _publicar(cliente, ong, atividade["id"])
    await _inscrever(sessao, atividade["id"], aluno_id)

    bloqueado = await cliente.put(
        f"/api/v1/atividades/{atividade['id']}", json={"data": _amanha(),
                                                       "local": "Outro lugar"},
        headers=_como(cliente, ong),
    )
    assert bloqueado.status_code == 400
    assert bloqueado.json()["codigo"] == "edicao_bloqueada_com_inscritos"
    # O erro precisa dizer *quais* campos travaram, não só que travou.
    campos = {d["campo"] for d in bloqueado.json()["detalhes"]}
    assert campos == {"data", "local"}

    permitido = await cliente.put(
        f"/api/v1/atividades/{atividade['id']}", json={"vagas_max": 30},
        headers=_como(cliente, ong),
    )
    assert permitido.status_code == 200
    assert permitido.json()["vagasMax"] == 30


async def test_vagas_max_nao_cai_abaixo_dos_inscritos(cliente, sessao):
    _, ong = await _cadastrar(cliente, "ong")
    atividade = await _criar(cliente, ong)
    await _publicar(cliente, ong, atividade["id"])
    for _ in range(3):
        aluno_id, _t = await _cadastrar(cliente, "estudante")
        await _inscrever(sessao, atividade["id"], aluno_id)

    resposta = await cliente.put(
        f"/api/v1/atividades/{atividade['id']}", json={"vagas_max": 2},
        headers=_como(cliente, ong),
    )
    assert resposta.status_code == 400
    assert resposta.json()["codigo"] == "vagas_abaixo_dos_inscritos"


async def test_inscricao_cancelada_devolve_a_vaga(cliente, sessao):
    """Cancelada e recusada não ocupam — a atividade volta a poder ser editada."""
    _, ong = await _cadastrar(cliente, "ong")
    aluno_id, _ = await _cadastrar(cliente, "estudante")
    atividade = await _criar(cliente, ong)
    await _inscrever(sessao, atividade["id"], aluno_id, situacao="cancelada")

    resposta = await cliente.put(
        f"/api/v1/atividades/{atividade['id']}", json={"local": "Outro lugar"},
        headers=_como(cliente, ong),
    )
    assert resposta.status_code == 200
    assert resposta.json()["vagasOcupadas"] == 0


async def test_edicao_para_o_passado_e_recusada(cliente):
    _, token = await _cadastrar(cliente, "ong")
    atividade = await _criar(cliente, token)
    ontem = (date.today() - timedelta(days=1)).isoformat()

    resposta = await cliente.put(f"/api/v1/atividades/{atividade['id']}",
                                 json={"data": ontem}, headers=_como(cliente, token))
    assert resposta.status_code == 400
    assert resposta.json()["codigo"] == "data_no_passado"


async def test_edicao_com_horario_invertido_e_recusada(cliente):
    """A coerência é verificada contra o valor gravado, não só contra o payload."""
    _, token = await _cadastrar(cliente, "ong")
    atividade = await _criar(cliente, token)  # 08:00–12:00

    resposta = await cliente.put(f"/api/v1/atividades/{atividade['id']}",
                                 json={"hora_inicio": "13:00"},
                                 headers=_como(cliente, token))
    assert resposta.status_code == 400
    assert resposta.json()["codigo"] == "horario_invalido"


async def test_ong_nao_edita_atividade_alheia(cliente):
    _, dona = await _cadastrar(cliente, "ong")
    atividade = await _criar(cliente, dona)
    _, outra = await _cadastrar(cliente, "ong")

    resposta = await cliente.put(f"/api/v1/atividades/{atividade['id']}",
                                 json={"titulo": "Sequestrada"},
                                 headers=_como(cliente, outra))
    assert resposta.status_code == 403


async def test_edicao_sem_mudanca_nao_audita(cliente, sessao):
    """Salvar sem alterar nada não deve poluir a trilha."""
    _, token = await _cadastrar(cliente, "ong")
    atividade = await _criar(cliente, token)

    await cliente.put(f"/api/v1/atividades/{atividade['id']}",
                      json={"titulo": atividade["titulo"]},
                      headers=_como(cliente, token))

    total = len((await sessao.scalars(
        select(RegistroAuditoria).where(RegistroAuditoria.acao == "atividade.editada")
    )).all())
    assert total == 0


# ===================== Cancelamento =====================


async def test_cancelar_derruba_as_inscricoes_ativas(cliente, sessao):
    _, ong = await _cadastrar(cliente, "ong")
    aluno_id, _ = await _cadastrar(cliente, "estudante")
    atividade = await _criar(cliente, ong)
    await _publicar(cliente, ong, atividade["id"])
    await _inscrever(sessao, atividade["id"], aluno_id)

    resposta = await cliente.post(f"/api/v1/atividades/{atividade['id']}/cancelar",
                                  json={"motivo": "Chuva forte"},
                                  headers=_como(cliente, ong))
    assert resposta.status_code == 200
    assert resposta.json()["situacao"] == "cancelada"

    inscricao = await sessao.scalar(
        select(Inscricao).where(Inscricao.atividade_id == uuid.UUID(atividade["id"]))
    )
    await sessao.refresh(inscricao)
    assert inscricao.situacao == "cancelada"


async def test_cancelar_duas_vezes_falha(cliente):
    _, ong = await _cadastrar(cliente, "ong")
    atividade = await _criar(cliente, ong)
    await _publicar(cliente, ong, atividade["id"])
    await cliente.post(f"/api/v1/atividades/{atividade['id']}/cancelar",
                       json={}, headers=_como(cliente, ong))

    resposta = await cliente.post(f"/api/v1/atividades/{atividade['id']}/cancelar",
                                  json={}, headers=_como(cliente, ong))
    assert resposta.status_code == 400


async def test_cancelada_nao_pode_ser_editada(cliente):
    _, ong = await _cadastrar(cliente, "ong")
    atividade = await _criar(cliente, ong)
    await _publicar(cliente, ong, atividade["id"])
    await cliente.post(f"/api/v1/atividades/{atividade['id']}/cancelar",
                       json={}, headers=_como(cliente, ong))

    resposta = await cliente.put(f"/api/v1/atividades/{atividade['id']}",
                                 json={"titulo": "Ressuscitada"},
                                 headers=_como(cliente, ong))
    assert resposta.status_code == 403
    assert resposta.json()["codigo"] == "atividade_encerrada"


async def test_motivo_do_cancelamento_vai_para_a_auditoria(cliente, sessao):
    """O aluno não vê o motivo (D10), mas a trilha guarda."""
    _, ong = await _cadastrar(cliente, "ong")
    atividade = await _criar(cliente, ong)
    await _publicar(cliente, ong, atividade["id"])
    await cliente.post(f"/api/v1/atividades/{atividade['id']}/cancelar",
                       json={"motivo": "Chuva forte"}, headers=_como(cliente, ong))

    registro = await sessao.scalar(
        select(RegistroAuditoria).where(RegistroAuditoria.acao == "atividade.cancelada")
    )
    assert registro.depois["motivo"] == "Chuva forte"


# ===================== Exclusão (RN-20) =====================


async def test_rascunho_e_apagado(cliente, sessao):
    _, ong = await _cadastrar(cliente, "ong")
    atividade = await _criar(cliente, ong)

    resposta = await cliente.delete(f"/api/v1/atividades/{atividade['id']}",
                                    headers=_como(cliente, ong))
    assert resposta.status_code == 204
    assert await sessao.get(Atividade, uuid.UUID(atividade["id"])) is None


async def test_publicada_nao_e_apagada(cliente):
    _, ong = await _cadastrar(cliente, "ong")
    atividade = await _criar(cliente, ong)
    await _publicar(cliente, ong, atividade["id"])

    resposta = await cliente.delete(f"/api/v1/atividades/{atividade['id']}",
                                    headers=_como(cliente, ong))
    assert resposta.status_code == 403
    assert resposta.json()["codigo"] == "so_rascunho_pode_ser_excluido"


# ===================== Vitrine =====================


async def test_vitrine_e_publica(cliente):
    _, ong = await _cadastrar(cliente, "ong")
    atividade = await _criar(cliente, ong)
    await _publicar(cliente, ong, atividade["id"])

    resposta = await cliente.get("/api/v1/atividades")
    assert resposta.status_code == 200
    assert any(i["id"] == atividade["id"] for i in resposta.json()["itens"])


async def test_rascunho_nao_aparece_na_vitrine(cliente):
    _, ong = await _cadastrar(cliente, "ong")
    atividade = await _criar(cliente, ong)

    resposta = await cliente.get("/api/v1/atividades")
    assert all(i["id"] != atividade["id"] for i in resposta.json()["itens"])


async def test_cancelada_some_da_vitrine(cliente):
    _, ong = await _cadastrar(cliente, "ong")
    atividade = await _criar(cliente, ong)
    await _publicar(cliente, ong, atividade["id"])
    await cliente.post(f"/api/v1/atividades/{atividade['id']}/cancelar",
                       json={}, headers=_como(cliente, ong))

    resposta = await cliente.get("/api/v1/atividades")
    assert all(i["id"] != atividade["id"] for i in resposta.json()["itens"])


async def test_lotada_continua_na_vitrine(cliente, sessao):
    """D7 — encher não tira da vitrine; só o dia passar tira."""
    _, ong = await _cadastrar(cliente, "ong")
    atividade = await _criar(cliente, ong, vagas_min=1, vagas_max=1)
    await _publicar(cliente, ong, atividade["id"])
    aluno_id, _ = await _cadastrar(cliente, "estudante")
    await _inscrever(sessao, atividade["id"], aluno_id)

    resposta = await cliente.get("/api/v1/atividades")
    item = next(i for i in resposta.json()["itens"] if i["id"] == atividade["id"])
    assert item["lotada"] is True
    assert item["vagasRestantes"] == 0


async def test_filtro_com_vaga_esconde_a_lotada(cliente, sessao):
    _, ong = await _cadastrar(cliente, "ong")
    atividade = await _criar(cliente, ong, vagas_min=1, vagas_max=1)
    await _publicar(cliente, ong, atividade["id"])
    aluno_id, _ = await _cadastrar(cliente, "estudante")
    await _inscrever(sessao, atividade["id"], aluno_id)

    resposta = await cliente.get("/api/v1/atividades?comVaga=true")
    assert all(i["id"] != atividade["id"] for i in resposta.json()["itens"])


async def test_filtro_com_vaga_acerta_total_e_paginas(cliente, sessao):
    """O filtro é do SQL: a página vem cheia e o total conta só as com vaga."""
    _, ong = await _cadastrar(cliente, "ong")
    aluno_id, _ = await _cadastrar(cliente, "estudante")
    for _ in range(3):
        lotada = await _criar(cliente, ong, vagas_min=1, vagas_max=1)
        await _publicar(cliente, ong, lotada["id"])
        await _inscrever(sessao, lotada["id"], aluno_id)
    livres = []
    for _ in range(3):
        livre = await _criar(cliente, ong, vagas_min=1, vagas_max=5)
        await _publicar(cliente, ong, livre["id"])
        livres.append(livre["id"])

    corpo = (await cliente.get("/api/v1/atividades",
                               params={"comVaga": "true", "tamanho": 2})).json()

    assert corpo["total"] == 3
    assert corpo["paginas"] == 2
    assert len(corpo["itens"]) == 2
    assert {i["id"] for i in corpo["itens"]} <= set(livres)


async def test_busca_filtra_por_titulo(cliente):
    _, ong = await _cadastrar(cliente, "ong")
    achavel = await _criar(cliente, ong, titulo="Plantio de mudas")
    outra = await _criar(cliente, ong, titulo="Aula de reforço")
    await _publicar(cliente, ong, achavel["id"])
    await _publicar(cliente, ong, outra["id"])

    corpo = (await cliente.get("/api/v1/atividades?busca=mudas")).json()
    ids = {i["id"] for i in corpo["itens"]}
    assert achavel["id"] in ids
    assert outra["id"] not in ids


async def test_filtro_de_carga_horaria(cliente):
    _, ong = await _cadastrar(cliente, "ong")
    curta = await _criar(cliente, ong, hora_inicio="08:00", hora_fim="10:00")
    longa = await _criar(cliente, ong, hora_inicio="08:00", hora_fim="18:00")
    await _publicar(cliente, ong, curta["id"])
    await _publicar(cliente, ong, longa["id"])

    corpo = (await cliente.get("/api/v1/atividades?cargaMin=5")).json()
    ids = {i["id"] for i in corpo["itens"]}
    assert longa["id"] in ids
    assert curta["id"] not in ids


async def test_vitrine_pagina(cliente):
    _, ong = await _cadastrar(cliente, "ong")
    for i in range(3):
        atividade = await _criar(cliente, ong, titulo=f"Paginada {i}")
        await _publicar(cliente, ong, atividade["id"])

    corpo = (await cliente.get("/api/v1/atividades?tamanho=2&pagina=1")).json()
    assert len(corpo["itens"]) == 2
    assert corpo["total"] >= 3
    assert corpo["pagina"] == 1


async def test_visitante_nao_recebe_minha_inscricao(cliente, sessao):
    _, ong = await _cadastrar(cliente, "ong")
    aluno_id, aluno = await _cadastrar(cliente, "estudante")
    atividade = await _criar(cliente, ong)
    await _publicar(cliente, ong, atividade["id"])
    await _inscrever(sessao, atividade["id"], aluno_id)

    anonimo = (await cliente.get("/api/v1/atividades")).json()
    item = next(i for i in anonimo["itens"] if i["id"] == atividade["id"])
    assert item["minhaInscricao"] is None

    logado = (await cliente.get("/api/v1/atividades",
                                headers=_como(cliente, aluno))).json()
    item = next(i for i in logado["itens"] if i["id"] == atividade["id"])
    assert item["minhaInscricao"]["situacao"] == "confirmada"


async def test_vitrine_nunca_lista_nomes_de_inscritos(cliente, sessao):
    """RN-47 — o cartão traz contagem, jamais quem se inscreveu."""
    _, ong = await _cadastrar(cliente, "ong")
    aluno_id, _ = await _cadastrar(cliente, "estudante")
    atividade = await _criar(cliente, ong)
    await _publicar(cliente, ong, atividade["id"])
    await _inscrever(sessao, atividade["id"], aluno_id)

    corpo = (await cliente.get("/api/v1/atividades")).json()
    item = next(i for i in corpo["itens"] if i["id"] == atividade["id"])
    assert item["vagasOcupadas"] == 1
    assert "inscritos" not in item
    assert "Maria Silva" not in _em_texto(item)


# ===================== Detalhe =====================


async def test_detalhe_de_publicada_e_publico(cliente):
    _, ong = await _cadastrar(cliente, "ong")
    atividade = await _criar(cliente, ong)
    await _publicar(cliente, ong, atividade["id"])

    resposta = await cliente.get(f"/api/v1/atividades/{atividade['id']}")
    assert resposta.status_code == 200
    assert resposta.json()["ong"]["nome"]


async def test_rascunho_e_404_para_terceiros(cliente):
    """404, não 403: quem não é dono nem deve saber que o rascunho existe."""
    _, dona = await _cadastrar(cliente, "ong")
    atividade = await _criar(cliente, dona)
    _, outra = await _cadastrar(cliente, "ong")

    anonimo = await cliente.get(f"/api/v1/atividades/{atividade['id']}")
    assert anonimo.status_code == 404

    alheio = await cliente.get(f"/api/v1/atividades/{atividade['id']}",
                               headers=_como(cliente, outra))
    assert alheio.status_code == 404

    dono = await cliente.get(f"/api/v1/atividades/{atividade['id']}",
                             headers=_como(cliente, dona))
    assert dono.status_code == 200


async def test_detalhe_de_id_inexistente(cliente):
    resposta = await cliente.get(f"/api/v1/atividades/{uuid.uuid4()}")
    assert resposta.status_code == 404


async def test_id_malformado_vira_dados_invalidos(cliente):
    """
    O 422 do FastAPI é normalizado para 400 `dados_invalidos` (D34): o 422 fica
    reservado a erro semântico, como `perfil_incompleto`.
    """
    resposta = await cliente.get("/api/v1/atividades/nao-e-uuid")
    assert resposta.status_code == 400
    assert resposta.json()["codigo"] == "dados_invalidos"


# ===================== Minhas atividades =====================


async def test_minhas_traz_so_as_da_ong(cliente):
    _, uma = await _cadastrar(cliente, "ong")
    minha = await _criar(cliente, uma)
    _, outra = await _cadastrar(cliente, "ong")
    alheia = await _criar(cliente, outra)

    corpo = (await cliente.get("/api/v1/atividades/minhas",
                               headers=_como(cliente, uma))).json()
    ids = {i["id"] for i in corpo["itens"]}
    assert minha["id"] in ids
    assert alheia["id"] not in ids


async def test_minhas_inclui_rascunho(cliente):
    _, ong = await _cadastrar(cliente, "ong")
    rascunho = await _criar(cliente, ong)

    corpo = (await cliente.get("/api/v1/atividades/minhas?situacao=rascunho",
                               headers=_como(cliente, ong))).json()
    assert [i["id"] for i in corpo["itens"]] == [rascunho["id"]]


async def test_minhas_exige_papel_ong(cliente):
    _, aluno = await _cadastrar(cliente, "estudante")
    resposta = await cliente.get("/api/v1/atividades/minhas",
                                 headers=_como(cliente, aluno))
    assert resposta.status_code == 403


async def test_token_invalido_na_vitrine_nao_derruba(cliente):
    """A vitrine é pública: token podre vira visitante, não 401."""
    resposta = await cliente.get("/api/v1/atividades",
                                 headers={"Authorization": "Bearer lixo.lixo.lixo"})
    assert resposta.status_code == 200


# ===================== Abas derivadas de O2 =====================


async def _publicar_no_banco(sessao, atividade_id: str, dia: date,
                             inicio: str, fim: str) -> None:
    """
    Força data e horário de uma atividade já publicada.

    A API recusa data no passado — é justamente o que se quer para produzir
    `aguardando_validacao`, então o estado é montado direto no banco.
    """
    atividade = await sessao.get(Atividade, uuid.UUID(atividade_id))
    atividade.situacao = "publicada"
    atividade.data = dia
    atividade.hora_inicio = time.fromisoformat(inicio)
    atividade.hora_fim = time.fromisoformat(fim)
    await sessao.commit()


async def test_aba_publicada_traz_so_o_que_nao_comecou(cliente, sessao):
    _, ong = await _cadastrar(cliente, "ong")
    futura = await _criar(cliente, ong, titulo="Ainda vai acontecer")
    await _publicar(cliente, ong, futura["id"])
    passada = await _criar(cliente, ong, titulo="Já aconteceu")
    await _publicar_no_banco(sessao, passada["id"],
                             date.today() - timedelta(days=2), "08:00", "12:00")

    corpo = (await cliente.get("/api/v1/atividades/minhas?situacao=publicada",
                               headers=_como(cliente, ong))).json()
    ids = {i["id"] for i in corpo["itens"]}
    assert futura["id"] in ids
    assert passada["id"] not in ids


async def test_aba_a_validar_traz_a_que_ja_terminou(cliente, sessao):
    _, ong = await _cadastrar(cliente, "ong")
    futura = await _criar(cliente, ong)
    await _publicar(cliente, ong, futura["id"])
    passada = await _criar(cliente, ong)
    await _publicar_no_banco(sessao, passada["id"],
                             date.today() - timedelta(days=2), "08:00", "12:00")

    corpo = (await cliente.get(
        "/api/v1/atividades/minhas?situacao=aguardando_validacao",
        headers=_como(cliente, ong))).json()
    ids = {i["id"] for i in corpo["itens"]}
    assert passada["id"] in ids
    assert futura["id"] not in ids
    # A situação calculada acompanha o filtro.
    assert all(i["situacao"] == "aguardando_validacao" for i in corpo["itens"])


async def test_aba_acontecendo_pega_a_de_agora(cliente, sessao):
    _, ong = await _cadastrar(cliente, "ong")
    agora = atividade_service.agora()
    rolando = await _criar(cliente, ong)
    await _publicar_no_banco(sessao, rolando["id"], agora.date(), "00:00", "23:59")

    corpo = (await cliente.get("/api/v1/atividades/minhas?situacao=em_andamento",
                               headers=_como(cliente, ong))).json()
    assert [i["id"] for i in corpo["itens"]] == [rolando["id"]]
    assert corpo["itens"][0]["situacao"] == "em_andamento"


async def test_total_da_aba_conta_so_a_propria_aba(cliente, sessao):
    """A paginação depende disso: contar tudo e filtrar depois daria total errado."""
    _, ong = await _cadastrar(cliente, "ong")
    for _ in range(2):
        atividade = await _criar(cliente, ong)
        await _publicar(cliente, ong, atividade["id"])
    rascunho = await _criar(cliente, ong)

    publicadas = (await cliente.get("/api/v1/atividades/minhas?situacao=publicada",
                                    headers=_como(cliente, ong))).json()
    rascunhos = (await cliente.get("/api/v1/atividades/minhas?situacao=rascunho",
                                   headers=_como(cliente, ong))).json()
    assert publicadas["total"] == 2
    assert rascunhos["total"] == 1
    assert [i["id"] for i in rascunhos["itens"]] == [rascunho["id"]]


async def test_situacao_desconhecida_nao_filtra_nada(cliente):
    """Aba inventada não pode virar lista vazia silenciosa nem erro 500."""
    _, ong = await _cadastrar(cliente, "ong")
    atividade = await _criar(cliente, ong)

    corpo = (await cliente.get("/api/v1/atividades/minhas?situacao=inventada",
                               headers=_como(cliente, ong))).json()
    assert [i["id"] for i in corpo["itens"]] == [atividade["id"]]

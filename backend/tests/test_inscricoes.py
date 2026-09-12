"""
Testes de inscrição — FE-02 a FE-04, FE-06, FO-05 e FO-06 de docs/fluxos.md.

O foco está no que o formulário não garante: a vaga que precisa voltar quando
alguém desiste (RN-19), o teto de cinco inscrições (RN-46), e a decisão que só
cabe a quem criou a atividade (RN-11).
"""

from __future__ import annotations

import uuid
from datetime import date, time, timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core import rate_limit
from app.db.models import Atividade, Inscricao, RegistroAuditoria
from app.db.session import obter_sessao
from app.main import app
from app.services import inscricao_service

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
    """Estudante com o perfil completo — sem isso a RN-45 barra a inscrição."""
    aluno_id, token = await _cadastrar(cliente, "estudante")
    await cliente.put("/api/v1/perfil", headers=_como(token), json={
        "nome_completo": "Maria da Silva Souza",
        "instituicao": "UniC",
        "curso": "Sistemas de Informação",
    })
    return aluno_id, token


def _amanha() -> str:
    return (date.today() + timedelta(days=1)).isoformat()


async def _atividade_publicada(cliente, ong_token: str, **extra) -> dict:
    dados = {
        "titulo": "Mutirão de limpeza",
        "descricao": "Limpeza da praia com a comunidade.",
        "local": "Praia do Futuro",
        "cidade": "Fortaleza",
        "data": _amanha(),
        "hora_inicio": "08:00",
        "hora_fim": "12:00",
        "vagas_min": 1,
        "vagas_max": 10,
    }
    dados.update(extra)
    criada = await cliente.post("/api/v1/atividades", json=dados,
                                headers=_como(ong_token))
    assert criada.status_code == 201, criada.text
    atividade_id = criada.json()["id"]
    publicada = await cliente.post(f"/api/v1/atividades/{atividade_id}/publicar",
                                   headers=_como(ong_token))
    assert publicada.status_code == 200, publicada.text
    return publicada.json()


async def _inscrever(cliente, token: str, atividade_id: str):
    return await cliente.post("/api/v1/inscricoes",
                              json={"atividadeId": atividade_id},
                              headers=_como(token))


async def _cenario(cliente, **extra) -> tuple[str, str, str, dict]:
    """(ong_token, aluno_id, aluno_token, atividade) — o arranjo mais comum."""
    _, ong = await _cadastrar(cliente, "ong")
    atividade = await _atividade_publicada(cliente, ong, **extra)
    aluno_id, aluno = await _aluno_pronto(cliente)
    return ong, aluno_id, aluno, atividade


# ===================== Inscrever (FE-02) =====================


async def test_sem_aprovacao_ja_nasce_confirmada(cliente):
    _, _, aluno, atividade = await _cenario(cliente)

    resposta = await _inscrever(cliente, aluno, atividade["id"])
    assert resposta.status_code == 201, resposta.text
    assert resposta.json()["situacao"] == "confirmada"
    assert resposta.json()["podeCancelar"] is True


async def test_com_aprovacao_nasce_pendente(cliente):
    _, _, aluno, atividade = await _cenario(cliente, exige_aprovacao=True)

    resposta = await _inscrever(cliente, aluno, atividade["id"])
    assert resposta.json()["situacao"] == "pendente"


async def test_inscricao_ocupa_vaga(cliente):
    _, _, aluno, atividade = await _cenario(cliente)
    await _inscrever(cliente, aluno, atividade["id"])

    corpo = (await cliente.get(f"/api/v1/atividades/{atividade['id']}")).json()
    assert corpo["vagasOcupadas"] == 1
    assert corpo["vagasRestantes"] == 9


async def test_pendente_tambem_ocupa_vaga(cliente):
    """A vaga fica reservada já na pendência — senão o aprovado ficaria sem lugar."""
    _, _, aluno, atividade = await _cenario(cliente, exige_aprovacao=True,
                                            vagas_max=1)
    await _inscrever(cliente, aluno, atividade["id"])

    corpo = (await cliente.get(f"/api/v1/atividades/{atividade['id']}")).json()
    assert corpo["vagasOcupadas"] == 1
    assert corpo["lotada"] is True


async def test_inscricao_registra_auditoria(cliente, sessao):
    _, _, aluno, atividade = await _cenario(cliente)
    await _inscrever(cliente, aluno, atividade["id"])

    acao = await sessao.scalar(
        select(RegistroAuditoria.acao)
        .where(RegistroAuditoria.acao == "inscricao.criada"))
    assert acao == "inscricao.criada"


async def test_minha_inscricao_aparece_na_vitrine(cliente):
    """É o que decide qual botão o cartão mostra."""
    _, _, aluno, atividade = await _cenario(cliente)
    await _inscrever(cliente, aluno, atividade["id"])

    corpo = (await cliente.get("/api/v1/atividades", headers=_como(aluno))).json()
    item = next(i for i in corpo["itens"] if i["id"] == atividade["id"])
    assert item["minhaInscricao"]["situacao"] == "confirmada"


# ===================== Exceções de FE-02 =====================


async def test_nao_inscreve_duas_vezes(cliente):
    _, _, aluno, atividade = await _cenario(cliente)
    await _inscrever(cliente, aluno, atividade["id"])

    repetida = await _inscrever(cliente, aluno, atividade["id"])
    assert repetida.status_code == 409
    assert repetida.json()["codigo"] == "ja_inscrito"


async def test_atividade_lotada_recusa(cliente):
    ong, _, primeiro, atividade = await _cenario(cliente, vagas_max=1)
    await _inscrever(cliente, primeiro, atividade["id"])
    _, segundo = await _aluno_pronto(cliente)

    resposta = await _inscrever(cliente, segundo, atividade["id"])
    assert resposta.status_code == 400
    assert resposta.json()["codigo"] == "vagas_esgotadas"


async def test_rascunho_nao_aceita_inscricao(cliente):
    _, ong = await _cadastrar(cliente, "ong")
    rascunho = await cliente.post("/api/v1/atividades", headers=_como(ong), json={
        "titulo": "Ainda rascunho", "descricao": "x", "local": "y",
        "data": _amanha(), "hora_inicio": "08:00", "hora_fim": "12:00",
    })
    _, aluno = await _aluno_pronto(cliente)

    resposta = await _inscrever(cliente, aluno, rascunho.json()["id"])
    assert resposta.status_code == 400
    assert resposta.json()["codigo"] == "inscricoes_encerradas"


async def test_atividade_cancelada_recusa(cliente):
    ong, _, aluno, atividade = await _cenario(cliente)
    await cliente.post(f"/api/v1/atividades/{atividade['id']}/cancelar",
                       json={}, headers=_como(ong))

    resposta = await _inscrever(cliente, aluno, atividade["id"])
    assert resposta.status_code == 400
    assert resposta.json()["codigo"] == "atividade_cancelada"


async def test_atividade_ja_comecada_recusa(cliente, sessao):
    ong, _, aluno, atividade = await _cenario(cliente)
    gravada = await sessao.get(Atividade, uuid.UUID(atividade["id"]))
    gravada.data = date.today() - timedelta(days=1)
    await sessao.commit()

    resposta = await _inscrever(cliente, aluno, atividade["id"])
    assert resposta.status_code == 400
    assert resposta.json()["codigo"] == "inscricoes_encerradas"


async def test_ong_nao_se_inscreve(cliente):
    ong, _, _, atividade = await _cenario(cliente)

    resposta = await _inscrever(cliente, ong, atividade["id"])
    assert resposta.status_code == 403


async def test_visitante_nao_se_inscreve(cliente):
    _, _, _, atividade = await _cenario(cliente)

    resposta = await cliente.post("/api/v1/inscricoes",
                                  json={"atividadeId": atividade["id"]})
    assert resposta.status_code == 401


async def test_atividade_inexistente(cliente):
    _, aluno = await _aluno_pronto(cliente)

    resposta = await _inscrever(cliente, aluno, str(uuid.uuid4()))
    assert resposta.status_code == 404


# ===================== Perfil incompleto (RN-45) =====================


async def test_perfil_incompleto_barra_a_inscricao(cliente):
    _, ong = await _cadastrar(cliente, "ong")
    atividade = await _atividade_publicada(cliente, ong)
    _, aluno = await _cadastrar(cliente, "estudante")  # sem preencher o perfil

    resposta = await _inscrever(cliente, aluno, atividade["id"])
    assert resposta.status_code == 422
    assert resposta.json()["codigo"] == "perfil_incompleto"


async def test_erro_de_perfil_diz_quais_campos_faltam(cliente):
    """A tela precisa destacar os campos — "complete seu perfil" sozinho não ajuda."""
    _, ong = await _cadastrar(cliente, "ong")
    atividade = await _atividade_publicada(cliente, ong)
    _, aluno = await _cadastrar(cliente, "estudante")
    await cliente.put("/api/v1/perfil", headers=_como(aluno),
                      json={"nome_completo": "Maria da Silva"})

    resposta = await _inscrever(cliente, aluno, atividade["id"])
    campos = {d["campo"] for d in resposta.json()["detalhes"]}
    assert campos == {"instituicao", "curso"}


async def test_perfil_so_com_espacos_nao_conta(cliente):
    _, ong = await _cadastrar(cliente, "ong")
    atividade = await _atividade_publicada(cliente, ong)
    _, aluno = await _cadastrar(cliente, "estudante")
    await cliente.put("/api/v1/perfil", headers=_como(aluno), json={
        "nome_completo": "   ", "instituicao": "   ", "curso": "   ",
    })

    resposta = await _inscrever(cliente, aluno, atividade["id"])
    assert resposta.status_code == 422
    assert resposta.json()["codigo"] == "perfil_incompleto"


# ===================== Teto de inscrições (RN-46) =====================


async def test_sexta_inscricao_e_barrada(cliente):
    _, ong = await _cadastrar(cliente, "ong")
    _, aluno = await _aluno_pronto(cliente)

    for _ in range(inscricao_service.LIMITE_DE_INSCRICOES_ATIVAS):
        atividade = await _atividade_publicada(cliente, ong)
        assert (await _inscrever(cliente, aluno, atividade["id"])).status_code == 201

    excedente = await _atividade_publicada(cliente, ong)
    resposta = await _inscrever(cliente, aluno, excedente["id"])
    assert resposta.status_code == 422
    assert resposta.json()["codigo"] == "limite_de_inscricoes"


async def test_cancelar_libera_espaco_no_teto(cliente):
    _, ong = await _cadastrar(cliente, "ong")
    _, aluno = await _aluno_pronto(cliente)

    ids = []
    for _ in range(inscricao_service.LIMITE_DE_INSCRICOES_ATIVAS):
        atividade = await _atividade_publicada(cliente, ong)
        ids.append((await _inscrever(cliente, aluno, atividade["id"])).json()["id"])

    await cliente.post(f"/api/v1/inscricoes/{ids[0]}/cancelar", headers=_como(aluno))

    nova = await _atividade_publicada(cliente, ong)
    assert (await _inscrever(cliente, aluno, nova["id"])).status_code == 201


async def test_atividade_passada_nao_conta_no_teto(cliente, sessao):
    """O teto é de inscrições *ativas*: o que já aconteceu não pode travar o aluno."""
    _, ong = await _cadastrar(cliente, "ong")
    _, aluno = await _aluno_pronto(cliente)

    for _ in range(inscricao_service.LIMITE_DE_INSCRICOES_ATIVAS):
        atividade = await _atividade_publicada(cliente, ong)
        await _inscrever(cliente, aluno, atividade["id"])
        gravada = await sessao.get(Atividade, uuid.UUID(atividade["id"]))
        gravada.data = date.today() - timedelta(days=10)
    await sessao.commit()

    nova = await _atividade_publicada(cliente, ong)
    assert (await _inscrever(cliente, aluno, nova["id"])).status_code == 201


# ===================== Cancelar (FE-04) =====================


async def test_cancelar_devolve_a_vaga(cliente):
    _, _, aluno, atividade = await _cenario(cliente)
    inscricao = (await _inscrever(cliente, aluno, atividade["id"])).json()

    resposta = await cliente.post(f"/api/v1/inscricoes/{inscricao['id']}/cancelar",
                                  headers=_como(aluno))
    assert resposta.status_code == 200
    assert resposta.json()["situacao"] == "cancelada"

    corpo = (await cliente.get(f"/api/v1/atividades/{atividade['id']}")).json()
    assert corpo["vagasOcupadas"] == 0


async def test_pode_se_inscrever_de_novo_depois_de_cancelar(cliente):
    """FE-04 A3. A linha é reaproveitada: o par (atividade, aluno) é único."""
    _, _, aluno, atividade = await _cenario(cliente)
    primeira = (await _inscrever(cliente, aluno, atividade["id"])).json()
    await cliente.post(f"/api/v1/inscricoes/{primeira['id']}/cancelar",
                       headers=_como(aluno))

    segunda = await _inscrever(cliente, aluno, atividade["id"])
    assert segunda.status_code == 201
    assert segunda.json()["situacao"] == "confirmada"
    assert segunda.json()["id"] == primeira["id"]
    assert segunda.json()["canceladaEm"] is None


async def test_cancelar_pendente_funciona(cliente):
    _, _, aluno, atividade = await _cenario(cliente, exige_aprovacao=True)
    inscricao = (await _inscrever(cliente, aluno, atividade["id"])).json()

    resposta = await cliente.post(f"/api/v1/inscricoes/{inscricao['id']}/cancelar",
                                  headers=_como(aluno))
    assert resposta.status_code == 200


async def test_nao_cancela_depois_do_inicio(cliente, sessao):
    _, _, aluno, atividade = await _cenario(cliente)
    inscricao = (await _inscrever(cliente, aluno, atividade["id"])).json()

    gravada = await sessao.get(Atividade, uuid.UUID(atividade["id"]))
    gravada.data = date.today() - timedelta(days=1)
    await sessao.commit()

    resposta = await cliente.post(f"/api/v1/inscricoes/{inscricao['id']}/cancelar",
                                  headers=_como(aluno))
    assert resposta.status_code == 400
    assert resposta.json()["codigo"] == "cancelamento_fora_do_prazo"


async def test_nao_cancela_duas_vezes(cliente):
    _, _, aluno, atividade = await _cenario(cliente)
    inscricao = (await _inscrever(cliente, aluno, atividade["id"])).json()
    await cliente.post(f"/api/v1/inscricoes/{inscricao['id']}/cancelar",
                       headers=_como(aluno))

    resposta = await cliente.post(f"/api/v1/inscricoes/{inscricao['id']}/cancelar",
                                  headers=_como(aluno))
    assert resposta.status_code == 400


async def test_aluno_nao_cancela_inscricao_alheia(cliente):
    """404, não 403: ele não deve nem confirmar que a inscrição existe."""
    _, _, dono, atividade = await _cenario(cliente)
    inscricao = (await _inscrever(cliente, dono, atividade["id"])).json()
    _, intruso = await _aluno_pronto(cliente)

    resposta = await cliente.post(f"/api/v1/inscricoes/{inscricao['id']}/cancelar",
                                  headers=_como(intruso))
    assert resposta.status_code == 404


async def test_cancelar_atividade_derruba_as_inscricoes(cliente):
    ong, _, aluno, atividade = await _cenario(cliente)
    await _inscrever(cliente, aluno, atividade["id"])
    await cliente.post(f"/api/v1/atividades/{atividade['id']}/cancelar",
                       json={"motivo": "Chuva"}, headers=_como(ong))

    corpo = (await cliente.get("/api/v1/inscricoes/minhas",
                               headers=_como(aluno))).json()
    assert corpo["itens"][0]["situacao"] == "cancelada"


# ===================== Aprovar e recusar (FO-05, FO-06) =====================


async def test_aprovar_confirma_a_inscricao(cliente):
    ong, _, aluno, atividade = await _cenario(cliente, exige_aprovacao=True)
    inscricao = (await _inscrever(cliente, aluno, atividade["id"])).json()

    resposta = await cliente.post(f"/api/v1/inscricoes/{inscricao['id']}/aprovar",
                                  headers=_como(ong))
    assert resposta.status_code == 200
    assert resposta.json()["situacao"] == "confirmada"
    assert resposta.json()["respondidaEm"] is not None


async def test_recusar_devolve_a_vaga(cliente):
    ong, _, aluno, atividade = await _cenario(cliente, exige_aprovacao=True,
                                              vagas_max=1)
    inscricao = (await _inscrever(cliente, aluno, atividade["id"])).json()

    resposta = await cliente.post(f"/api/v1/inscricoes/{inscricao['id']}/recusar",
                                  headers=_como(ong))
    assert resposta.json()["situacao"] == "recusada"

    corpo = (await cliente.get(f"/api/v1/atividades/{atividade['id']}")).json()
    assert corpo["vagasOcupadas"] == 0
    assert corpo["lotada"] is False


async def test_recusa_nao_guarda_motivo(cliente, sessao):
    """D8 — a recusa não registra nem exibe motivo, nem na auditoria."""
    ong, _, aluno, atividade = await _cenario(cliente, exige_aprovacao=True)
    inscricao = (await _inscrever(cliente, aluno, atividade["id"])).json()
    await cliente.post(f"/api/v1/inscricoes/{inscricao['id']}/recusar",
                       headers=_como(ong))

    registro = await sessao.scalar(
        select(RegistroAuditoria)
        .where(RegistroAuditoria.acao == "inscricao.recusada"))
    assert registro.depois == {"situacao": "recusada"}
    assert "motivo" not in (registro.depois or {})


async def test_ong_nao_decide_inscricao_alheia(cliente):
    """A checagem de dono é do serviço, não do papel — é a correção da falha L2."""
    _, _, aluno, atividade = await _cenario(cliente, exige_aprovacao=True)
    inscricao = (await _inscrever(cliente, aluno, atividade["id"])).json()
    _, outra_ong = await _cadastrar(cliente, "ong")

    resposta = await cliente.post(f"/api/v1/inscricoes/{inscricao['id']}/aprovar",
                                  headers=_como(outra_ong))
    assert resposta.status_code == 403
    assert resposta.json()["codigo"] == "nao_e_dono"


async def test_nao_responde_duas_vezes(cliente):
    ong, _, aluno, atividade = await _cenario(cliente, exige_aprovacao=True)
    inscricao = (await _inscrever(cliente, aluno, atividade["id"])).json()
    await cliente.post(f"/api/v1/inscricoes/{inscricao['id']}/aprovar",
                       headers=_como(ong))

    resposta = await cliente.post(f"/api/v1/inscricoes/{inscricao['id']}/recusar",
                                  headers=_como(ong))
    assert resposta.status_code == 400
    assert resposta.json()["codigo"] == "situacao_invalida"


async def test_nao_responde_inscricao_cancelada(cliente):
    ong, _, aluno, atividade = await _cenario(cliente, exige_aprovacao=True)
    inscricao = (await _inscrever(cliente, aluno, atividade["id"])).json()
    await cliente.post(f"/api/v1/inscricoes/{inscricao['id']}/cancelar",
                       headers=_como(aluno))

    resposta = await cliente.post(f"/api/v1/inscricoes/{inscricao['id']}/aprovar",
                                  headers=_como(ong))
    assert resposta.status_code == 400


async def test_aluno_nao_aprova(cliente):
    _, _, aluno, atividade = await _cenario(cliente, exige_aprovacao=True)
    inscricao = (await _inscrever(cliente, aluno, atividade["id"])).json()

    resposta = await cliente.post(f"/api/v1/inscricoes/{inscricao['id']}/aprovar",
                                  headers=_como(aluno))
    assert resposta.status_code == 403


# ===================== Aprovação em lote =====================


async def test_lote_aprova_todas(cliente):
    _, ong = await _cadastrar(cliente, "ong")
    atividade = await _atividade_publicada(cliente, ong, exige_aprovacao=True)

    ids = []
    for _ in range(3):
        _, aluno = await _aluno_pronto(cliente)
        ids.append((await _inscrever(cliente, aluno, atividade["id"])).json()["id"])

    resposta = await cliente.post("/api/v1/inscricoes/aprovar-lote",
                                  json={"ids": ids}, headers=_como(ong))
    assert resposta.status_code == 200
    assert resposta.json()["aprovadas"] == 3
    assert resposta.json()["ignoradas"] == []


async def test_lote_ignora_a_que_nao_pode_e_aprova_o_resto(cliente):
    """Uma cancelada no meio do caminho não pode derrubar as outras aprovações."""
    _, ong = await _cadastrar(cliente, "ong")
    atividade = await _atividade_publicada(cliente, ong, exige_aprovacao=True)

    ids = []
    for _ in range(3):
        _, aluno = await _aluno_pronto(cliente)
        inscricao = (await _inscrever(cliente, aluno, atividade["id"])).json()
        ids.append(inscricao["id"])
        if len(ids) == 2:
            await cliente.post(f"/api/v1/inscricoes/{inscricao['id']}/cancelar",
                               headers=_como(aluno))

    resposta = await cliente.post("/api/v1/inscricoes/aprovar-lote",
                                  json={"ids": ids}, headers=_como(ong))
    corpo = resposta.json()
    assert corpo["aprovadas"] == 2
    assert len(corpo["ignoradas"]) == 1
    assert corpo["ignoradas"][0]["id"] == ids[1]


async def test_lote_de_outra_ong_nao_passa(cliente):
    _, ong = await _cadastrar(cliente, "ong")
    atividade = await _atividade_publicada(cliente, ong, exige_aprovacao=True)
    _, aluno = await _aluno_pronto(cliente)
    inscricao = (await _inscrever(cliente, aluno, atividade["id"])).json()
    _, outra_ong = await _cadastrar(cliente, "ong")

    resposta = await cliente.post("/api/v1/inscricoes/aprovar-lote",
                                  json={"ids": [inscricao["id"]]},
                                  headers=_como(outra_ong))
    assert resposta.json()["aprovadas"] == 0
    assert len(resposta.json()["ignoradas"]) == 1


async def test_lote_vazio_e_recusado(cliente):
    _, ong = await _cadastrar(cliente, "ong")

    resposta = await cliente.post("/api/v1/inscricoes/aprovar-lote",
                                  json={"ids": []}, headers=_como(ong))
    assert resposta.status_code == 400


# ===================== Minhas inscrições (FE-06) =====================


async def test_grupo_aguardando_traz_so_pendentes(cliente):
    _, ong = await _cadastrar(cliente, "ong")
    _, aluno = await _aluno_pronto(cliente)
    com_aprovacao = await _atividade_publicada(cliente, ong, exige_aprovacao=True)
    direta = await _atividade_publicada(cliente, ong)
    await _inscrever(cliente, aluno, com_aprovacao["id"])
    await _inscrever(cliente, aluno, direta["id"])

    corpo = (await cliente.get("/api/v1/inscricoes/minhas?grupo=aguardando",
                               headers=_como(aluno))).json()
    assert corpo["total"] == 1
    assert corpo["itens"][0]["atividade"]["id"] == com_aprovacao["id"]


async def test_grupo_proximas_traz_so_confirmadas_futuras(cliente):
    _, ong = await _cadastrar(cliente, "ong")
    _, aluno = await _aluno_pronto(cliente)
    futura = await _atividade_publicada(cliente, ong)
    pendente = await _atividade_publicada(cliente, ong, exige_aprovacao=True)
    await _inscrever(cliente, aluno, futura["id"])
    await _inscrever(cliente, aluno, pendente["id"])

    corpo = (await cliente.get("/api/v1/inscricoes/minhas?grupo=proximas",
                               headers=_como(aluno))).json()
    assert [i["atividade"]["id"] for i in corpo["itens"]] == [futura["id"]]


async def test_grupo_historico_pega_a_cancelada(cliente):
    _, _, aluno, atividade = await _cenario(cliente)
    inscricao = (await _inscrever(cliente, aluno, atividade["id"])).json()
    await cliente.post(f"/api/v1/inscricoes/{inscricao['id']}/cancelar",
                       headers=_como(aluno))

    corpo = (await cliente.get("/api/v1/inscricoes/minhas?grupo=historico",
                               headers=_como(aluno))).json()
    assert corpo["total"] == 1
    assert corpo["itens"][0]["situacao"] == "cancelada"


async def test_confirmada_que_ja_passou_cai_no_historico(cliente, sessao):
    """Deixá-la em "próximas" mostraria um evento de ontem como se fosse amanhã."""
    _, _, aluno, atividade = await _cenario(cliente)
    await _inscrever(cliente, aluno, atividade["id"])
    gravada = await sessao.get(Atividade, uuid.UUID(atividade["id"]))
    gravada.data = date.today() - timedelta(days=3)
    await sessao.commit()

    proximas = (await cliente.get("/api/v1/inscricoes/minhas?grupo=proximas",
                                  headers=_como(aluno))).json()
    historico = (await cliente.get("/api/v1/inscricoes/minhas?grupo=historico",
                                   headers=_como(aluno))).json()
    assert proximas["total"] == 0
    assert historico["total"] == 1


async def test_total_do_grupo_conta_so_o_grupo(cliente):
    """A paginação depende disso — contar tudo e filtrar depois daria total errado."""
    _, ong = await _cadastrar(cliente, "ong")
    _, aluno = await _aluno_pronto(cliente)
    for _ in range(2):
        atividade = await _atividade_publicada(cliente, ong)
        await _inscrever(cliente, aluno, atividade["id"])
    pendente = await _atividade_publicada(cliente, ong, exige_aprovacao=True)
    await _inscrever(cliente, aluno, pendente["id"])

    proximas = (await cliente.get("/api/v1/inscricoes/minhas?grupo=proximas",
                                  headers=_como(aluno))).json()
    aguardando = (await cliente.get("/api/v1/inscricoes/minhas?grupo=aguardando",
                                    headers=_como(aluno))).json()
    assert proximas["total"] == 2
    assert aguardando["total"] == 1


async def test_minhas_so_traz_as_proprias(cliente):
    _, ong = await _cadastrar(cliente, "ong")
    atividade = await _atividade_publicada(cliente, ong)
    _, um = await _aluno_pronto(cliente)
    _, outro = await _aluno_pronto(cliente)
    await _inscrever(cliente, um, atividade["id"])

    corpo = (await cliente.get("/api/v1/inscricoes/minhas",
                               headers=_como(outro))).json()
    assert corpo["total"] == 0


async def test_minhas_exige_papel_estudante(cliente):
    _, ong = await _cadastrar(cliente, "ong")

    resposta = await cliente.get("/api/v1/inscricoes/minhas", headers=_como(ong))
    assert resposta.status_code == 403


async def test_minhas_nunca_traz_dados_de_outro_aluno(cliente):
    """RN-47 ao contrário: o bloco `aluno` é da ONG, não do colega."""
    _, _, aluno, atividade = await _cenario(cliente)
    await _inscrever(cliente, aluno, atividade["id"])

    corpo = (await cliente.get("/api/v1/inscricoes/minhas",
                               headers=_como(aluno))).json()
    assert corpo["itens"][0]["aluno"] is None


# ===================== Lista da ONG (O5) =====================


async def test_ong_ve_nome_curso_e_instituicao(cliente):
    ong, _, aluno, atividade = await _cenario(cliente, exige_aprovacao=True)
    await _inscrever(cliente, aluno, atividade["id"])

    corpo = (await cliente.get(f"/api/v1/atividades/{atividade['id']}/inscricoes",
                               headers=_como(ong))).json()
    assert corpo["total"] == 1
    dados = corpo["itens"][0]["aluno"]
    assert dados["nome"] == "Maria da Silva Souza"
    assert dados["curso"] == "Sistemas de Informação"
    assert dados["instituicao"] == "UniC"


async def test_lista_da_ong_filtra_por_situacao(cliente):
    _, ong = await _cadastrar(cliente, "ong")
    atividade = await _atividade_publicada(cliente, ong, exige_aprovacao=True)
    _, um = await _aluno_pronto(cliente)
    _, outro = await _aluno_pronto(cliente)
    primeira = (await _inscrever(cliente, um, atividade["id"])).json()
    await _inscrever(cliente, outro, atividade["id"])
    await cliente.post(f"/api/v1/inscricoes/{primeira['id']}/aprovar",
                       headers=_como(ong))

    pendentes = (await cliente.get(
        f"/api/v1/atividades/{atividade['id']}/inscricoes?situacao=pendente",
        headers=_como(ong))).json()
    confirmadas = (await cliente.get(
        f"/api/v1/atividades/{atividade['id']}/inscricoes?situacao=confirmada",
        headers=_como(ong))).json()
    assert pendentes["total"] == 1
    assert confirmadas["total"] == 1


async def test_ong_nao_ve_inscritos_de_atividade_alheia(cliente):
    ong, _, aluno, atividade = await _cenario(cliente)
    await _inscrever(cliente, aluno, atividade["id"])
    _, outra_ong = await _cadastrar(cliente, "ong")

    resposta = await cliente.get(f"/api/v1/atividades/{atividade['id']}/inscricoes",
                                 headers=_como(outra_ong))
    assert resposta.status_code == 403


async def test_aluno_nao_lista_inscritos(cliente):
    """O nome dos colegas é da ONG. O aluno vê só a contagem (RN-47)."""
    _, _, aluno, atividade = await _cenario(cliente)
    await _inscrever(cliente, aluno, atividade["id"])

    resposta = await cliente.get(f"/api/v1/atividades/{atividade['id']}/inscricoes",
                                 headers=_como(aluno))
    assert resposta.status_code == 403

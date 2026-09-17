"""
Testes do modo "entrar como" — FS-04, D13, RN-29 a RN-31.

É a diferença entre **observar** e **se disfarçar**: o admin vê o que a
pessoa vê, não altera nada, e a trilha registra que foi ele.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, time, timedelta, timezone

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select, update

from app.core import rate_limit, security
from app.db.models import (
    Atividade, Inscricao, PerfilEstudante, RegistroAuditoria, TokenSessao, Usuario,
)
from app.db.session import obter_sessao
from app.main import app

SENHA = "senha-bem-longa-123"


@pytest.fixture(autouse=True)
def _limites():
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


async def _admin(sessao) -> tuple[Usuario, str]:
    admin = Usuario(nome="Admin Suporte", email=f"{uuid.uuid4().hex[:10]}@admin.com",
                    senha_hash=security.gerar_hash_senha(SENHA), papel="superadmin")
    sessao.add(admin)
    await sessao.commit()
    token, _ = security.criar_access_token(admin.id, admin.papel)
    return admin, token


async def _entrar_como(cliente, admin_token: str, alvo_id: str):
    return await cliente.post(f"/api/v1/admin/usuarios/{alvo_id}/entrar-como",
                              headers=_como(admin_token))


async def _espelho(cliente, sessao, papel="estudante"):
    """(admin, alvo_id, token espelho, token próprio do alvo)."""
    admin, admin_token = await _admin(sessao)
    alvo_id, alvo_token = await _cadastrar(cliente, papel)
    resposta = await _entrar_como(cliente, admin_token, alvo_id)
    assert resposta.status_code == 200, resposta.text
    return admin, alvo_id, resposta.json()["token"], alvo_token


async def _acoes(sessao, acao: str) -> list[RegistroAuditoria]:
    return list(await sessao.scalars(
        select(RegistroAuditoria).where(RegistroAuditoria.acao == acao)))


# ===================== Entrada =====================


async def test_espelho_mostra_o_que_a_pessoa_ve(cliente, sessao):
    _, alvo_id, espelho, _ = await _espelho(cliente, sessao)

    perfil = await cliente.get("/api/v1/perfil", headers=_como(espelho))
    assert perfil.status_code == 200
    assert perfil.json()["id"] == alvo_id


async def test_entrada_e_auditada_com_admin_como_ator(cliente, sessao):
    admin, alvo_id, _, _ = await _espelho(cliente, sessao)

    registro = (await _acoes(sessao, "admin.entrou_como"))[0]
    assert registro.ator_id == admin.id
    assert str(registro.em_nome_de_id) == alvo_id


async def test_espelho_nao_abre_sessao_renovavel(cliente, sessao):
    """RN-31 — nada de cookie de refresh: em 30 minutos acabou."""
    admin, admin_token = await _admin(sessao)
    alvo_id, _ = await _cadastrar(cliente, "estudante")
    cliente.cookies.clear()

    resposta = await _entrar_como(cliente, admin_token, alvo_id)
    assert "set-cookie" not in resposta.headers
    assert "refresh" not in resposta.text.lower()


async def test_espelho_dura_trinta_minutos(cliente, sessao):
    _, _, espelho, _ = await _espelho(cliente, sessao)
    payload = security.ler_access_token(espelho)
    duracao = payload["exp"] - payload["iat"]
    assert 29 * 60 <= duracao <= 30 * 60 + 5


async def test_nao_espelha_outro_admin(cliente, sessao):
    """RN-30 — admin não observa admin."""
    _, token = await _admin(sessao)
    outro, _ = await _admin(sessao)

    resposta = await _entrar_como(cliente, token, str(outro.id))
    assert resposta.status_code == 403
    assert resposta.json()["codigo"] == "nao_pode_espelhar_admin"


async def test_nao_espelha_conta_suspensa(cliente, sessao):
    _, token = await _admin(sessao)
    alvo_id, _ = await _cadastrar(cliente, "estudante")
    await cliente.post(f"/api/v1/admin/usuarios/{alvo_id}/suspender",
                       json={"motivo": "Suspensa para o teste"}, headers=_como(token))

    resposta = await _entrar_como(cliente, token, alvo_id)
    assert resposta.status_code == 403


async def test_so_admin_entra_como(cliente, sessao):
    alvo_id, _ = await _cadastrar(cliente, "estudante")
    _, ong_token = await _cadastrar(cliente, "ong")
    resposta = await _entrar_como(cliente, ong_token, alvo_id)
    assert resposta.status_code == 403


# ===================== Somente leitura (RN-29) =====================


@pytest.mark.parametrize("metodo,rota,corpo", [
    ("PUT", "/api/v1/perfil", {"nome_completo": "Nome trocado pelo admin"}),
    ("POST", "/api/v1/notificacoes/lidas", None),
    ("POST", "/api/v1/perfil/foto", None),
])
async def test_espelho_nao_escreve(cliente, sessao, metodo, rota, corpo):
    _, _, espelho, _ = await _espelho(cliente, sessao)

    resposta = await cliente.request(metodo, rota, headers=_como(espelho), json=corpo)
    assert resposta.status_code == 403, resposta.text
    assert resposta.json()["codigo"] == "modo_somente_leitura"


async def test_escrita_recusada_nao_muda_nada(cliente, sessao):
    _, alvo_id, espelho, _ = await _espelho(cliente, sessao)

    await cliente.put("/api/v1/perfil", headers=_como(espelho),
                      json={"nome_completo": "Nome trocado pelo admin"})

    perfil = await sessao.get(PerfilEstudante, uuid.UUID(alvo_id))
    assert perfil is None or perfil.nome_completo != "Nome trocado pelo admin"


async def test_espelho_de_aluno_nao_se_inscreve(cliente, sessao):
    _, ong = await _cadastrar(cliente, "ong")
    atividade = (await cliente.post("/api/v1/atividades", headers=_como(ong), json={
        "titulo": "Plantio", "descricao": "x", "local": "Parque",
        "data": (date.today() + timedelta(days=2)).isoformat(),
        "hora_inicio": "08:00", "hora_fim": "10:00"})).json()["id"]
    await cliente.post(f"/api/v1/atividades/{atividade}/publicar", headers=_como(ong))
    _, alvo_id, espelho, _ = await _espelho(cliente, sessao)

    resposta = await cliente.post("/api/v1/inscricoes", headers=_como(espelho),
                                  json={"atividadeId": atividade})
    assert resposta.status_code == 403
    assert (await sessao.scalar(select(Inscricao).where(
        Inscricao.usuario_id == uuid.UUID(alvo_id)))) is None


async def test_espelho_de_ong_nao_ve_o_qr_de_checkin(cliente, sessao):
    """O código vivo registra presença; mostrá-lo seria entregar a fraude."""
    admin, admin_token = await _admin(sessao)
    ong_id, ong = await _cadastrar(cliente, "ong")
    atividade = (await cliente.post("/api/v1/atividades", headers=_como(ong), json={
        "titulo": "Mutirão", "descricao": "x", "local": "Praia",
        "data": (date.today() + timedelta(days=2)).isoformat(),
        "hora_inicio": "08:00", "hora_fim": "10:00"})).json()["id"]
    await cliente.post(f"/api/v1/atividades/{atividade}/publicar", headers=_como(ong))
    await sessao.execute(update(Atividade).where(Atividade.id == uuid.UUID(atividade))
                         .values(data=date.today(), hora_inicio=time(0, 0),
                                 hora_fim=time(23, 59)))
    await sessao.commit()

    # A própria ONG vê o QR…
    assert (await cliente.get(f"/api/v1/atividades/{atividade}/checkin/token",
                              headers=_como(ong))).status_code == 200
    # …o admin observando a ONG, não.
    espelho = (await _entrar_como(cliente, admin_token, ong_id)).json()["token"]
    resposta = await cliente.get(f"/api/v1/atividades/{atividade}/checkin/token",
                                 headers=_como(espelho))
    assert resposta.status_code == 403
    assert resposta.json()["codigo"] == "modo_somente_leitura"


async def test_espelho_nao_usa_o_console(cliente, sessao):
    """O token espelho tem o papel do alvo: o console fica fora de alcance."""
    _, _, espelho, _ = await _espelho(cliente, sessao)
    resposta = await cliente.get("/api/v1/admin/visao-geral", headers=_como(espelho))
    assert resposta.status_code == 403


# ===================== Trilha =====================


async def test_cada_leitura_vira_registro_de_navegacao(cliente, sessao):
    admin, alvo_id, espelho, _ = await _espelho(cliente, sessao)

    await cliente.get("/api/v1/perfil", headers=_como(espelho))
    await cliente.get("/api/v1/inscricoes/minhas", headers=_como(espelho),
                      params={"grupo": "historico"})

    registros = await _acoes(sessao, "admin.navegou_como")
    rotas = [r.depois["rota"] for r in registros]
    assert rotas == ["/api/v1/perfil", "/api/v1/inscricoes/minhas"]
    assert all(r.ator_id == admin.id for r in registros)
    assert all(str(r.em_nome_de_id) == alvo_id for r in registros)
    assert registros[1].depois["consulta"] == "grupo=historico"


async def test_contador_do_sino_nao_polui_a_trilha(cliente, sessao):
    _, _, espelho, _ = await _espelho(cliente, sessao)
    for _ in range(3):
        await cliente.get("/api/v1/notificacoes/contador", headers=_como(espelho))
    assert await _acoes(sessao, "admin.navegou_como") == []


async def test_uso_normal_nao_gera_registro_de_espelho(cliente, sessao):
    _, _, _, alvo_token = await _espelho(cliente, sessao)
    await cliente.get("/api/v1/perfil", headers=_como(alvo_token))
    assert await _acoes(sessao, "admin.navegou_como") == []


async def test_filtro_da_auditoria_acha_o_espelho(cliente, sessao):
    admin, admin_token = await _admin(sessao)
    alvo_id, _ = await _cadastrar(cliente, "estudante")
    espelho = (await _entrar_como(cliente, admin_token, alvo_id)).json()["token"]
    await cliente.get("/api/v1/perfil", headers=_como(espelho))

    corpo = (await cliente.get("/api/v1/admin/auditoria",
                               params={"apenasEmNomeDe": "true"},
                               headers=_como(admin_token))).json()
    acoes = {r["acao"] for r in corpo["itens"]}
    assert {"admin.entrou_como", "admin.navegou_como"} <= acoes
    assert all(r["emNomeDeId"] == alvo_id for r in corpo["itens"])


# ===================== Saída e expiração =====================


async def test_sair_do_modo_encerra_o_token(cliente, sessao):
    admin, _, espelho, _ = await _espelho(cliente, sessao)

    resposta = await cliente.post("/api/v1/admin/sair-do-modo", headers=_como(espelho))
    assert resposta.status_code == 200

    depois = await cliente.get("/api/v1/perfil", headers=_como(espelho))
    assert depois.status_code == 401
    assert depois.json()["codigo"] == "espelho_expirado"
    registro = (await _acoes(sessao, "admin.saiu_do_modo"))[0]
    assert registro.ator_id == admin.id


async def test_sair_do_modo_exige_estar_nele(cliente, sessao):
    _, token = await _admin(sessao)
    resposta = await cliente.post("/api/v1/admin/sair-do-modo", headers=_como(token))
    assert resposta.status_code == 400


async def test_espelho_vencido_e_recusado(cliente, sessao):
    """RN-31 — mesmo com o JWT ainda válido, a sessão vencida manda."""
    _, alvo_id, espelho, _ = await _espelho(cliente, sessao)
    sid = uuid.UUID(security.ler_access_token(espelho)["sid"])
    await sessao.execute(update(TokenSessao).where(TokenSessao.id == sid)
                         .values(expira_em=datetime.now(timezone.utc) - timedelta(seconds=1)))
    await sessao.commit()

    resposta = await cliente.get("/api/v1/perfil", headers=_como(espelho))
    assert resposta.status_code == 401
    assert resposta.json()["codigo"] == "espelho_expirado"


async def test_encerrar_sessoes_do_alvo_derruba_o_espelho(cliente, sessao):
    admin, alvo_id, espelho, _ = await _espelho(cliente, sessao)
    admin_token, _ = security.criar_access_token(admin.id, admin.papel)
    await cliente.post(f"/api/v1/admin/usuarios/{alvo_id}/encerrar-sessoes",
                       headers=_como(admin_token))

    assert (await cliente.get("/api/v1/perfil",
                              headers=_como(espelho))).status_code == 401


async def test_admin_suspenso_perde_o_espelho(cliente, sessao):
    admin, _, espelho, _ = await _espelho(cliente, sessao)
    admin.situacao = "suspensa"
    admin.suspenso_em = datetime.now(timezone.utc)
    admin.motivo_suspensao = "saiu da equipe"
    await sessao.commit()

    assert (await cliente.get("/api/v1/perfil",
                              headers=_como(espelho))).status_code == 401


async def test_sessao_trocada_nao_serve(cliente, sessao):
    """Um token espelho apontando para a sessão de outra pessoa é recusado."""
    admin, admin_token = await _admin(sessao)
    alvo_a, _ = await _cadastrar(cliente, "estudante")
    alvo_b, _ = await _cadastrar(cliente, "estudante")
    token_a = (await _entrar_como(cliente, admin_token, alvo_a)).json()["token"]
    sid_a = uuid.UUID(security.ler_access_token(token_a)["sid"])

    forjado = security.criar_token_espelho(
        uuid.UUID(alvo_b), "estudante", admin.id, sid_a,
        datetime.now(timezone.utc) + timedelta(minutes=10))
    resposta = await cliente.get("/api/v1/perfil", headers=_como(forjado))
    assert resposta.status_code == 401


async def test_espelho_aparece_nas_sessoes_do_alvo(cliente, sessao):
    admin, alvo_id, _, _ = await _espelho(cliente, sessao)
    admin_token, _ = security.criar_access_token(admin.id, admin.papel)
    corpo = (await cliente.get(f"/api/v1/admin/usuarios/{alvo_id}",
                               headers=_como(admin_token))).json()
    assert any(s["espelho"] for s in corpo["sessoesAtivas"])

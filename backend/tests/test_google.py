"""
Entrada pelo Google (Fatia 12).

Nenhum teste fala com o Google: o que se substitui é só a função que troca o
código pela identidade. O resto — estado, cookies, vínculo, papel, selo
institucional — é o nosso código de verdade.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core import rate_limit
from app.core.config import config
from app.db.models import IdentidadeExterna, PerfilEstudante, RegistroAuditoria, Usuario
from app.db.session import obter_sessao
from app.main import app
from app.services import oauth_service

SENHA = "senha-bem-longa-123"
INSTITUCIONAL = "unicearense.edu.br"


@pytest.fixture(autouse=True)
def _ambiente(monkeypatch):
    monkeypatch.setattr(config, "google_client_id", "id-de-teste")
    monkeypatch.setattr(config, "google_client_secret", "segredo-de-teste")
    monkeypatch.setattr(config, "dominio_institucional", INSTITUCIONAL)
    rate_limit.zerar()
    yield
    rate_limit.zerar()


@pytest.fixture
async def cliente(sessao):
    async def _sessao_de_teste():
        yield sessao

    app.dependency_overrides[obter_sessao] = _sessao_de_teste
    async with AsyncClient(transport=ASGITransport(app=app),
                           base_url="http://teste", follow_redirects=False) as c:
        yield c
    app.dependency_overrides.clear()


def _identidade(email: str, *, sub: str | None = None, nome: str = "Maria Silva",
                dominio: str | None = None) -> oauth_service.Identidade:
    return oauth_service.Identidade(
        sub=sub or uuid.uuid4().hex, email=email, nome=nome, dominio=dominio)


def _do_google(monkeypatch, identidade: oauth_service.Identidade) -> None:
    """Substitui só a conversa com o Google."""
    async def falso(codigo: str, verificador: str) -> oauth_service.Identidade:
        assert codigo and verificador
        return identidade

    monkeypatch.setattr(oauth_service, "identidade_do_codigo", falso)


async def _ida(cliente) -> tuple[str, str]:
    """Começa o fluxo e devolve (state, cookie de ida)."""
    resposta = await cliente.get("/api/v1/auth/google/inicio")
    assert resposta.status_code == 307
    destino = resposta.headers["location"]
    estado = destino.split("state=")[1].split("&")[0]
    return estado, resposta.cookies["mh_google"]


async def _entrar(cliente, monkeypatch, identidade) -> object:
    _do_google(monkeypatch, identidade)
    estado, cookie = await _ida(cliente)
    return await cliente.get("/api/v1/auth/google/retorno",
                             params={"code": "codigo-do-google", "state": estado},
                             cookies={"mh_google": cookie})


# ===================== A ida =====================


async def test_ida_leva_ao_google_com_pkce(cliente):
    resposta = await cliente.get("/api/v1/auth/google/inicio")

    destino = resposta.headers["location"]
    assert destino.startswith("https://accounts.google.com/o/oauth2/v2/auth?")
    assert "code_challenge_method=S256" in destino
    assert "client_id=id-de-teste" in destino
    assert "scope=openid+email+profile" in destino
    # O segredo do cliente nunca sai daqui.
    assert "segredo-de-teste" not in destino
    assert resposta.cookies["mh_google"]


async def test_sem_configuracao_a_rota_avisa(cliente, monkeypatch):
    monkeypatch.setattr(config, "google_client_id", "")

    resposta = await cliente.get("/api/v1/auth/google/inicio")

    assert resposta.status_code == 503
    assert resposta.json()["codigo"] == "google_indisponivel"
    assert (await cliente.get("/api/v1/auth/provedores")).json() == {"google": False}


# ===================== O retorno =====================


async def test_estado_trocado_nao_passa(cliente, monkeypatch):
    _do_google(monkeypatch, _identidade("maria@gmail.com"))
    _, cookie = await _ida(cliente)

    resposta = await cliente.get("/api/v1/auth/google/retorno",
                                 params={"code": "x", "state": "outro-estado"},
                                 cookies={"mh_google": cookie})

    assert resposta.status_code == 303
    assert "google=google_estado_invalido" in resposta.headers["location"]


async def test_retorno_sem_cookie_nao_passa(cliente, monkeypatch):
    _do_google(monkeypatch, _identidade("maria@gmail.com"))
    estado, _ = await _ida(cliente)

    resposta = await cliente.get("/api/v1/auth/google/retorno",
                                 params={"code": "x", "state": estado})

    assert "google=google_estado_invalido" in resposta.headers["location"]


async def test_desistencia_no_google_volta_sem_barulho(cliente):
    resposta = await cliente.get("/api/v1/auth/google/retorno",
                                 params={"error": "access_denied"})

    assert resposta.status_code == 303
    assert resposta.headers["location"].endswith("/entrar?google=cancelado")


# ===================== Conta nova =====================


async def test_conta_nova_pede_o_papel_antes_de_existir(cliente, sessao, monkeypatch):
    resposta = await _entrar(cliente, monkeypatch, _identidade("nova@gmail.com"))

    assert resposta.headers["location"].endswith("/entrar/google?novo=1")
    assert resposta.cookies["mh_google_cadastro"]
    # Nada foi criado ainda: a pessoa ainda pode desistir na tela seguinte.
    assert await sessao.scalar(
        select(Usuario).where(Usuario.email == "nova@gmail.com")) is None


async def test_concluir_cria_a_conta_com_o_papel_escolhido(cliente, sessao, monkeypatch):
    retorno = await _entrar(cliente, monkeypatch,
                            _identidade("nova@gmail.com", nome="Verde Vida"))

    criada = await cliente.post(
        "/api/v1/auth/google/concluir", json={"papel": "ong"},
        cookies={"mh_google_cadastro": retorno.cookies["mh_google_cadastro"]})

    assert criada.status_code == 201
    corpo = criada.json()
    assert corpo["usuario"]["papel"] == "ong"
    assert corpo["usuario"]["email"] == "nova@gmail.com"
    assert corpo["token"]
    assert criada.cookies["mh_refresh"]

    usuario = await sessao.scalar(
        select(Usuario).where(Usuario.email == "nova@gmail.com"))
    assert usuario.senha_hash is None
    identidade = await sessao.scalar(
        select(IdentidadeExterna).where(IdentidadeExterna.usuario_id == usuario.id))
    assert identidade.provedor == "google"


async def test_conta_sem_senha_nao_entra_por_senha(cliente, monkeypatch):
    retorno = await _entrar(cliente, monkeypatch, _identidade("nova@gmail.com"))
    await cliente.post("/api/v1/auth/google/concluir", json={"papel": "estudante"},
                       cookies={"mh_google_cadastro": retorno.cookies["mh_google_cadastro"]})

    resposta = await cliente.post("/api/v1/auth/entrar",
                                  json={"email": "nova@gmail.com", "senha": SENHA})

    assert resposta.status_code == 400
    assert resposta.json()["codigo"] == "credenciais_invalidas"


async def test_papel_de_admin_e_recusado(cliente, monkeypatch):
    retorno = await _entrar(cliente, monkeypatch, _identidade("nova@gmail.com"))

    resposta = await cliente.post(
        "/api/v1/auth/google/concluir", json={"papel": "superadmin"},
        cookies={"mh_google_cadastro": retorno.cookies["mh_google_cadastro"]})

    assert resposta.status_code == 400


async def test_concluir_sem_cadastro_pendente(cliente):
    resposta = await cliente.post("/api/v1/auth/google/concluir",
                                  json={"papel": "estudante"})

    assert resposta.status_code == 400
    assert resposta.json()["codigo"] == "google_estado_invalido"


# ===================== Conta conhecida =====================


async def test_segunda_entrada_reaproveita_a_conta(cliente, sessao, monkeypatch):
    identidade = _identidade("maria@gmail.com")
    retorno = await _entrar(cliente, monkeypatch, identidade)
    await cliente.post("/api/v1/auth/google/concluir", json={"papel": "estudante"},
                       cookies={"mh_google_cadastro": retorno.cookies["mh_google_cadastro"]})

    de_novo = await _entrar(cliente, monkeypatch, identidade)

    assert de_novo.headers["location"].endswith("/entrar/google")
    assert de_novo.cookies["mh_refresh"]
    contas = (await sessao.execute(
        select(Usuario).where(Usuario.email == "maria@gmail.com"))).scalars().all()
    assert len(contas) == 1


async def test_email_ja_cadastrado_com_senha_e_vinculado(cliente, sessao, monkeypatch):
    """A mesma pessoa: o Google acabou de provar que o e-mail é dela."""
    await cliente.post("/api/v1/auth/cadastro", json={
        "nome": "Maria Silva", "email": "maria@gmail.com",
        "senha": SENHA, "papel": "estudante"})

    resposta = await _entrar(cliente, monkeypatch, _identidade("maria@gmail.com"))

    assert resposta.headers["location"].endswith("/entrar/google")
    usuario = await sessao.scalar(
        select(Usuario).where(Usuario.email == "maria@gmail.com"))
    assert usuario.senha_hash is not None  # continua entrando pelos dois caminhos
    assert await sessao.scalar(
        select(IdentidadeExterna).where(IdentidadeExterna.usuario_id == usuario.id))
    registros = (await sessao.execute(
        select(RegistroAuditoria).where(
            RegistroAuditoria.acao == "conta.vinculada_google"))).scalars().all()
    assert len(registros) == 1


async def test_conta_suspensa_nao_entra_pelo_google(cliente, sessao, monkeypatch):
    cadastro = await cliente.post("/api/v1/auth/cadastro", json={
        "nome": "Maria Silva", "email": "maria@gmail.com",
        "senha": SENHA, "papel": "estudante"})
    usuario = await sessao.get(Usuario, uuid.UUID(cadastro.json()["usuario"]["id"]))
    usuario.situacao = "suspensa"
    usuario.suspenso_em = datetime.now(timezone.utc)
    usuario.motivo_suspensao = "teste"
    await sessao.commit()

    resposta = await _entrar(cliente, monkeypatch, _identidade("maria@gmail.com"))

    assert "google=conta_suspensa" in resposta.headers["location"]


# ===================== Selo institucional =====================


async def test_dominio_da_faculdade_vira_vinculo_verificado(cliente, sessao, monkeypatch):
    retorno = await _entrar(cliente, monkeypatch, _identidade(
        f"maria@{INSTITUCIONAL}", dominio=INSTITUCIONAL))
    criada = await cliente.post(
        "/api/v1/auth/google/concluir", json={"papel": "estudante"},
        cookies={"mh_google_cadastro": retorno.cookies["mh_google_cadastro"]})

    usuario_id = uuid.UUID(criada.json()["usuario"]["id"])
    assert await oauth_service.vinculo_institucional(sessao, usuario_id) == INSTITUCIONAL

    perfil = await cliente.get(
        "/api/v1/perfil",
        headers={"Authorization": f"Bearer {criada.json()['token']}"})
    assert perfil.json()["vinculoInstitucional"] == INSTITUCIONAL


async def test_conta_pessoal_nao_ganha_selo(cliente, sessao, monkeypatch):
    retorno = await _entrar(cliente, monkeypatch, _identidade("maria@gmail.com"))
    criada = await cliente.post(
        "/api/v1/auth/google/concluir", json={"papel": "estudante"},
        cookies={"mh_google_cadastro": retorno.cookies["mh_google_cadastro"]})

    usuario_id = uuid.UUID(criada.json()["usuario"]["id"])

    assert await oauth_service.vinculo_institucional(sessao, usuario_id) is None
    perfil = await cliente.get(
        "/api/v1/perfil",
        headers={"Authorization": f"Bearer {criada.json()['token']}"})
    assert perfil.json()["vinculoInstitucional"] is None


async def test_perfil_do_aluno_nasce_junto(cliente, sessao, monkeypatch):
    retorno = await _entrar(cliente, monkeypatch, _identidade("maria@gmail.com"))
    criada = await cliente.post(
        "/api/v1/auth/google/concluir", json={"papel": "estudante"},
        cookies={"mh_google_cadastro": retorno.cookies["mh_google_cadastro"]})

    usuario_id = uuid.UUID(criada.json()["usuario"]["id"])

    assert await sessao.get(PerfilEstudante, usuario_id) is not None

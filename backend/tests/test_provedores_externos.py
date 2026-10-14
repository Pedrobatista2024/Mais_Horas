"""
Entrada pela Microsoft e pelo GitHub, e o que vale para todos os provedores.

O fluxo comum (estado, cookies, papel, vínculo) já é coberto em
`test_google.py`. Aqui fica o que muda de provedor para provedor — **como a
identidade é lida e quando o e-mail merece confiança** — e as garantias de que
um provedor não serve para fechar o fluxo de outro.

Nenhum teste fala com a internet: a identidade é montada direto, ou a conversa
HTTP é respondida por um transporte falso.
"""

from __future__ import annotations

import uuid

import httpx
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core import rate_limit
from app.core.config import config
from app.core.errors import ErroDeNegocio
from app.db.models import IdentidadeExterna, RegistroAuditoria, Usuario
from app.db.session import obter_sessao
from app.main import app
from app.services import oauth_service

INSTITUCIONAL = "unicearense.edu.br"
TENANT_DA_FACULDADE = "11111111-2222-3333-4444-555555555555"


@pytest.fixture(autouse=True)
def _ambiente(monkeypatch):
    for chave in oauth_service.PROVEDORES:
        monkeypatch.setattr(config, f"{chave}_client_id", f"id-{chave}")
        monkeypatch.setattr(config, f"{chave}_client_secret", f"segredo-{chave}")
    monkeypatch.setattr(config, "microsoft_tenant", "common")
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


def _identidade(provedor: str, email: str, *, dominio: str | None = None,
                nome: str = "Maria Silva") -> oauth_service.Identidade:
    return oauth_service.Identidade(provedor=provedor, sub=uuid.uuid4().hex,
                                    email=email, nome=nome, dominio=dominio)


def _provedor_responde(monkeypatch, identidade: oauth_service.Identidade) -> None:
    async def falso(p, codigo: str, verificador: str) -> oauth_service.Identidade:
        assert p.chave == identidade.provedor and codigo and verificador
        return identidade

    monkeypatch.setattr(oauth_service, "identidade_do_codigo", falso)


async def _ida(cliente, provedor: str) -> tuple[str, str]:
    resposta = await cliente.get(f"/api/v1/auth/{provedor}/inicio")
    assert resposta.status_code == 307, resposta.text
    estado = resposta.headers["location"].split("state=")[1].split("&")[0]
    return estado, resposta.cookies["mh_externo"]


async def _entrar(cliente, monkeypatch, identidade) -> httpx.Response:
    _provedor_responde(monkeypatch, identidade)
    estado, cookie = await _ida(cliente, identidade.provedor)
    return await cliente.get(f"/api/v1/auth/{identidade.provedor}/retorno",
                             params={"code": "codigo", "state": estado},
                             cookies={"mh_externo": cookie})


async def _criar_conta(cliente, monkeypatch, identidade, papel="estudante"):
    retorno = await _entrar(cliente, monkeypatch, identidade)
    assert retorno.headers["location"].endswith(
        f"/entrar/{identidade.provedor}?novo=1")
    return await cliente.post(
        f"/api/v1/auth/{identidade.provedor}/concluir", json={"papel": papel},
        cookies={"mh_externo_cadastro": retorno.cookies["mh_externo_cadastro"]})


def _codigo_do_erro(acao) -> str:
    with pytest.raises(ErroDeNegocio) as erro:
        acao()
    return erro.value.codigo


# ===================== Quais provedores existem =====================


async def test_cada_provedor_so_aparece_com_a_sua_credencial(cliente, monkeypatch):
    monkeypatch.setattr(config, "github_client_secret", "")

    assert (await cliente.get("/api/v1/auth/provedores")).json() == {
        "google": True, "microsoft": True, "github": False}
    resposta = await cliente.get("/api/v1/auth/github/inicio")
    assert resposta.status_code == 503
    assert resposta.json()["codigo"] == "externo_indisponivel"


async def test_provedor_desconhecido_nao_tem_rota(cliente):
    resposta = await cliente.get("/api/v1/auth/facebook/inicio")
    assert resposta.status_code == 400
    assert resposta.json()["codigo"] == "dados_invalidos"


# ===================== A ida =====================


async def test_ida_a_microsoft_aceita_conta_pessoal_e_de_escola(cliente):
    resposta = await cliente.get("/api/v1/auth/microsoft/inicio")

    destino = resposta.headers["location"]
    assert destino.startswith(
        "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?")
    assert "client_id=id-microsoft" in destino
    assert "code_challenge_method=S256" in destino
    assert "scope=openid+email+profile" in destino
    assert "auth%2Fmicrosoft%2Fretorno" in destino
    assert "segredo-microsoft" not in destino


async def test_tenant_restrito_muda_o_endereco(cliente, monkeypatch):
    monkeypatch.setattr(config, "microsoft_tenant", "organizations")
    resposta = await cliente.get("/api/v1/auth/microsoft/inicio")
    assert resposta.headers["location"].startswith(
        "https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize?")


async def test_ida_ao_github_pede_so_perfil_e_emails(cliente):
    resposta = await cliente.get("/api/v1/auth/github/inicio")

    destino = resposta.headers["location"]
    assert destino.startswith("https://github.com/login/oauth/authorize?")
    assert "scope=read%3Auser+user%3Aemail" in destino
    assert "state=" in destino
    assert "code_challenge_method=S256" in destino
    assert "segredo-github" not in destino


# ===================== Um provedor não fecha o fluxo de outro =====================


async def test_cookie_de_ida_ao_google_nao_vale_na_volta_da_microsoft(cliente, monkeypatch):
    _provedor_responde(monkeypatch, _identidade("microsoft", "maria@outlook.com"))
    estado, cookie = await _ida(cliente, "google")

    resposta = await cliente.get("/api/v1/auth/microsoft/retorno",
                                 params={"code": "codigo", "state": estado},
                                 cookies={"mh_externo": cookie})

    assert resposta.headers["location"].endswith(
        "/entrar?externo=externo_estado_invalido&provedor=microsoft")


async def test_cadastro_pendente_do_github_nao_conclui_pelo_google(cliente, monkeypatch):
    retorno = await _entrar(cliente, monkeypatch, _identidade("github", "maria@gmail.com"))

    resposta = await cliente.post(
        "/api/v1/auth/google/concluir", json={"papel": "estudante"},
        cookies={"mh_externo_cadastro": retorno.cookies["mh_externo_cadastro"]})

    assert resposta.status_code == 400
    assert resposta.json()["codigo"] == "externo_estado_invalido"


# ===================== Conta nova e vínculo entre provedores =====================


async def test_conta_criada_pelo_github_guarda_a_origem(cliente, sessao, monkeypatch):
    criada = await _criar_conta(cliente, monkeypatch,
                                _identidade("github", "dev@gmail.com"), papel="ong")

    assert criada.status_code == 201, criada.text
    usuario = await sessao.scalar(select(Usuario).where(Usuario.email == "dev@gmail.com"))
    identidade = await sessao.scalar(
        select(IdentidadeExterna).where(IdentidadeExterna.usuario_id == usuario.id))
    assert usuario.papel == "ong" and usuario.senha_hash is None
    assert identidade.provedor == "github"
    criacao = await sessao.scalar(select(RegistroAuditoria).where(
        RegistroAuditoria.acao == "conta.criada",
        RegistroAuditoria.entidade_id == usuario.id))
    assert criacao.depois["origem"] == "github"


async def test_mesmo_email_em_dois_provedores_e_uma_pessoa_so(cliente, sessao, monkeypatch):
    await _criar_conta(cliente, monkeypatch, _identidade("google", "maria@gmail.com"))

    pelo_github = await _entrar(cliente, monkeypatch,
                                _identidade("github", "maria@gmail.com"))

    assert pelo_github.headers["location"].endswith("/entrar/github")
    assert pelo_github.cookies["mh_refresh"]
    contas = (await sessao.execute(
        select(Usuario).where(Usuario.email == "maria@gmail.com"))).scalars().all()
    assert len(contas) == 1
    provedores = (await sessao.scalars(select(IdentidadeExterna.provedor).where(
        IdentidadeExterna.usuario_id == contas[0].id))).all()
    assert sorted(provedores) == ["github", "google"]
    assert await sessao.scalar(select(RegistroAuditoria).where(
        RegistroAuditoria.acao == "conta.vinculada_github"))


async def test_selo_institucional_vem_de_qualquer_provedor(cliente, sessao, monkeypatch):
    await _criar_conta(cliente, monkeypatch,
                       _identidade("microsoft", f"ana@{INSTITUCIONAL}",
                                   dominio=INSTITUCIONAL))
    usuario = await sessao.scalar(
        select(Usuario).where(Usuario.email == f"ana@{INSTITUCIONAL}"))

    assert await oauth_service.vinculo_institucional(sessao, usuario.id) == INSTITUCIONAL


# ===================== Microsoft: quando o e-mail merece confiança =====================


def _claims_microsoft(tid: str, email: str, **extras) -> dict:
    return {"iss": f"https://login.microsoftonline.com/{tid}/v2.0", "tid": tid,
            "sub": "sub-ms", "email": email, "name": "Ana Souza", **extras}


def test_conta_pessoal_da_microsoft_entra():
    identidade = oauth_service.identidade_microsoft(_claims_microsoft(
        oauth_service.TENANT_PESSOAL_MICROSOFT, "Ana@Outlook.com"))

    assert identidade.email == "ana@outlook.com"
    assert identidade.dominio is None  # conta pessoal nunca ganha selo


def test_conta_de_escola_sem_dominio_verificado_e_recusada():
    """
    A defesa contra o "nOAuth": num tenant qualquer, o administrador escreve o
    e-mail que quiser no campo `email`. Sem prova de que ele é dono do domínio,
    esse e-mail não pode abrir — nem vincular — conta nenhuma aqui.
    """
    claims = _claims_microsoft("tenant-de-um-desconhecido", f"reitor@{INSTITUCIONAL}")

    codigo = _codigo_do_erro(lambda: oauth_service.identidade_microsoft(claims))

    assert codigo == "externo_email_nao_verificado"


@pytest.mark.parametrize("edov", [True, "true", "1"])
def test_conta_de_escola_com_dominio_verificado_ganha_o_selo(edov):
    identidade = oauth_service.identidade_microsoft(_claims_microsoft(
        TENANT_DA_FACULDADE, f"ana@{INSTITUCIONAL}", xms_edov=edov))

    assert identidade.dominio == INSTITUCIONAL
    assert identidade.sub == "sub-ms"


def test_emissor_de_outro_tenant_e_recusado():
    claims = _claims_microsoft(TENANT_DA_FACULDADE, "ana@outlook.com")
    claims["iss"] = "https://login.microsoftonline.com/outro-tenant/v2.0"

    codigo = _codigo_do_erro(lambda: oauth_service.identidade_microsoft(claims))

    assert codigo == "externo_recusou"


def test_google_continua_exigindo_email_verificado():
    claims = {"iss": "https://accounts.google.com", "sub": "1",
              "email": "maria@gmail.com", "email_verified": False}

    codigo = _codigo_do_erro(lambda: oauth_service.identidade_google(claims))

    assert codigo == "externo_email_nao_verificado"


# ===================== GitHub: identidade vem da API =====================


def _usuario_github(**extras) -> dict:
    return {"id": 4242, "login": "maria-dev", "name": "Maria Dev", **extras}


def test_github_entra_pelo_email_principal_verificado():
    identidade = oauth_service.identidade_github(_usuario_github(), [
        {"email": "outro@gmail.com", "primary": False, "verified": True},
        {"email": "Maria@Gmail.com", "primary": True, "verified": True},
    ])

    assert identidade.sub == "4242"  # o id, que não muda; o login muda
    assert identidade.email == "maria@gmail.com"
    assert identidade.nome == "Maria Dev"
    assert identidade.dominio is None


def test_github_sem_principal_verificado_e_recusado():
    codigo = _codigo_do_erro(lambda: oauth_service.identidade_github(
        _usuario_github(), [{"email": "maria@gmail.com", "primary": True,
                             "verified": False}]))

    assert codigo == "externo_email_nao_verificado"


def test_github_da_selo_so_com_email_institucional_verificado():
    verificado = oauth_service.identidade_github(_usuario_github(), [
        {"email": "maria@gmail.com", "primary": True, "verified": True},
        {"email": f"maria@{INSTITUCIONAL}", "primary": False, "verified": True},
    ])
    so_declarado = oauth_service.identidade_github(_usuario_github(), [
        {"email": "maria@gmail.com", "primary": True, "verified": True},
        {"email": f"maria@{INSTITUCIONAL}", "primary": False, "verified": False},
    ])

    assert verificado.dominio == INSTITUCIONAL
    assert verificado.email == "maria@gmail.com"  # a conta usa o principal
    assert so_declarado.dominio is None


def test_github_sem_nome_usa_o_login():
    identidade = oauth_service.identidade_github(
        _usuario_github(name=None),
        [{"email": "maria@gmail.com", "primary": True, "verified": True}])

    assert identidade.nome == "maria-dev"


def _github_falso(monkeypatch, resposta_do_token: dict) -> list[httpx.Request]:
    """Responde a troca do código e a API do GitHub sem sair da máquina."""
    pedidos: list[httpx.Request] = []

    def responder(pedido: httpx.Request) -> httpx.Response:
        pedidos.append(pedido)
        if pedido.url.path == "/login/oauth/access_token":
            return httpx.Response(200, json=resposta_do_token)
        if pedido.url.path == "/user":
            return httpx.Response(200, json=_usuario_github())
        if pedido.url.path == "/user/emails":
            return httpx.Response(200, json=[
                {"email": "maria@gmail.com", "primary": True, "verified": True}])
        return httpx.Response(404)

    original = httpx.AsyncClient
    monkeypatch.setattr(oauth_service.httpx, "AsyncClient",
                        lambda **kw: original(transport=httpx.MockTransport(responder), **kw))
    return pedidos


async def test_troca_com_o_github_usa_o_verificador_e_o_token(monkeypatch):
    pedidos = _github_falso(monkeypatch, {"access_token": "token-do-github"})

    identidade = await oauth_service.identidade_do_codigo(
        oauth_service.PROVEDORES["github"], "codigo", "verificador-pkce")

    assert identidade.provedor == "github" and identidade.sub == "4242"
    troca, perfil, emails = pedidos
    assert b"code_verifier=verificador-pkce" in troca.content
    assert b"client_secret=segredo-github" in troca.content
    assert troca.headers["accept"] == "application/json"
    assert perfil.headers["authorization"] == "Bearer token-do-github"
    assert emails.url.path == "/user/emails"


async def test_erro_do_github_vem_com_200_e_mesmo_assim_e_recusado(monkeypatch):
    _github_falso(monkeypatch, {"error": "bad_verification_code"})

    with pytest.raises(ErroDeNegocio) as erro:
        await oauth_service.identidade_do_codigo(
            oauth_service.PROVEDORES["github"], "codigo-velho", "verificador")

    assert erro.value.codigo == "externo_recusou"

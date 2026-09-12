"""
Testes dos fluxos de acesso — FA-01 a FA-05 de docs/fluxos.md.

Exercitam a API de ponta a ponta, incluindo as exceções descritas nos fluxos.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core import rate_limit
from app.core.config import config
from app.core.security import hash_refresh_token
from app.db.models import RegistroAuditoria, TokenRedefinicaoSenha, TokenSessao, Usuario
from app.db.session import obter_sessao
from app.main import app

SENHA = "senha-bem-longa-123"
COOKIE = "mh_refresh"


@pytest.fixture(autouse=True)
def _sem_limite():
    """O limite de tentativas tem alvo próprio; nos demais testes atrapalha."""
    rate_limit.zerar()
    yield
    rate_limit.zerar()


@pytest.fixture
async def cliente(sessao):
    """Cliente com a sessão de teste injetada — tudo some no rollback."""
    async def _sessao_de_teste():
        yield sessao

    app.dependency_overrides[obter_sessao] = _sessao_de_teste
    transporte = ASGITransport(app=app)
    async with AsyncClient(transport=transporte, base_url="http://teste") as c:
        yield c
    app.dependency_overrides.clear()


def _email() -> str:
    return f"{uuid.uuid4().hex[:12]}@teste.com"


async def _cadastrar(cliente, papel="estudante", email=None, senha=SENHA):
    return await cliente.post("/api/v1/auth/cadastro", json={
        "nome": "Maria Silva", "email": email or _email(),
        "senha": senha, "papel": papel,
    })


# ===================== FA-01 Criar conta =====================


async def test_cadastro_cria_conta_e_abre_sessao(cliente):
    resposta = await _cadastrar(cliente)

    assert resposta.status_code == 201
    corpo = resposta.json()
    assert corpo["token"]
    assert corpo["expiraEm"] == config.access_token_minutos * 60
    assert corpo["usuario"]["papel"] == "estudante"


async def test_cadastro_nao_devolve_id_no_formato_antigo(cliente):
    """D29 — o alias `_id` saiu."""
    corpo = (await _cadastrar(cliente)).json()
    assert "id" in corpo["usuario"]
    assert "_id" not in corpo["usuario"]


async def test_cadastro_nao_vaza_senha(cliente):
    texto = (await _cadastrar(cliente)).text
    assert SENHA not in texto
    assert "senha" not in texto.lower()


async def test_refresh_vai_no_cookie_e_nao_no_corpo(cliente):
    """RNF-05 — fora do alcance de qualquer script da página."""
    resposta = await _cadastrar(cliente)
    assert COOKIE in resposta.cookies
    assert resposta.cookies[COOKIE] not in resposta.text


async def test_cookie_e_httponly_com_caminho_restrito(cliente):
    resposta = await _cadastrar(cliente)
    bruto = resposta.headers["set-cookie"]
    assert "httponly" in bruto.lower()
    assert "path=/api/v1/auth" in bruto.lower()


async def test_email_duplicado_e_recusado(cliente):
    email = _email()
    await _cadastrar(cliente, email=email)
    resposta = await _cadastrar(cliente, email=email)

    assert resposta.status_code == 409
    assert resposta.json()["codigo"] == "email_em_uso"


async def test_papel_superadmin_nao_pode_ser_criado_pela_api(cliente):
    """RN-27 — admin só nasce por comando no servidor."""
    resposta = await cliente.post("/api/v1/auth/cadastro", json={
        "nome": "Invasor", "email": _email(), "senha": SENHA, "papel": "superadmin",
    })
    assert resposta.status_code == 400


async def test_senha_curta_e_recusada_com_campo_apontado(cliente):
    resposta = await cliente.post("/api/v1/auth/cadastro", json={
        "nome": "Maria", "email": _email(), "senha": "1234", "papel": "estudante",
    })
    assert resposta.status_code == 400
    corpo = resposta.json()
    assert corpo["codigo"] == "dados_invalidos"
    assert any(d["campo"] == "senha" for d in corpo["detalhes"])


async def test_email_invalido_e_recusado(cliente):
    resposta = await cliente.post("/api/v1/auth/cadastro", json={
        "nome": "Maria", "email": "nao-eh-email", "senha": SENHA, "papel": "estudante",
    })
    assert resposta.status_code == 400


async def test_cadastro_cria_perfil_vazio(cliente, sessao):
    """O perfil nasce junto; a exigência de preenchimento é só na 1ª inscrição."""
    email = _email()
    await _cadastrar(cliente, email=email)

    usuario = await sessao.scalar(select(Usuario).where(Usuario.email == email))
    await sessao.refresh(usuario, ["perfil_estudante"])
    assert usuario.perfil_estudante is not None
    assert not usuario.perfil_estudante.completo


async def test_cadastro_fica_na_auditoria(cliente, sessao):
    email = _email()
    await _cadastrar(cliente, email=email)

    acoes = (await sessao.scalars(
        select(RegistroAuditoria.acao).order_by(RegistroAuditoria.id)
    )).all()
    assert "conta.criada" in acoes


# ===================== FA-02 Entrar =====================


async def test_login_com_credenciais_corretas(cliente):
    email = _email()
    await _cadastrar(cliente, email=email)

    resposta = await cliente.post("/api/v1/auth/entrar",
                                  json={"email": email, "senha": SENHA})
    assert resposta.status_code == 200
    assert resposta.json()["token"]


async def test_email_inexistente_e_senha_errada_dao_a_mesma_resposta(cliente):
    """
    RN-22 — a diferença transformaria a tela de login num verificador de quais
    contas existem.
    """
    email = _email()
    await _cadastrar(cliente, email=email)

    inexistente = await cliente.post("/api/v1/auth/entrar",
                                     json={"email": _email(), "senha": SENHA})
    senha_errada = await cliente.post("/api/v1/auth/entrar",
                                      json={"email": email, "senha": "outra-senha-aqui"})

    assert inexistente.status_code == senha_errada.status_code == 400
    assert inexistente.json() == senha_errada.json()


async def test_login_normaliza_email(cliente):
    email = _email()
    await _cadastrar(cliente, email=email)
    resposta = await cliente.post("/api/v1/auth/entrar",
                                  json={"email": f"  {email.upper()} ", "senha": SENHA})
    assert resposta.status_code == 200


async def test_conta_suspensa_e_barrada(cliente, sessao):
    email = _email()
    await _cadastrar(cliente, email=email)

    usuario = await sessao.scalar(select(Usuario).where(Usuario.email == email))
    usuario.situacao = "suspensa"
    usuario.suspenso_em = datetime.now(timezone.utc)
    usuario.motivo_suspensao = "teste"
    await sessao.flush()

    resposta = await cliente.post("/api/v1/auth/entrar",
                                  json={"email": email, "senha": SENHA})
    assert resposta.status_code == 403
    assert resposta.json()["codigo"] == "conta_suspensa"


async def test_falha_de_login_e_auditada(cliente, sessao):
    """RN-42 — sem registro não há como detectar força bruta depois."""
    email = _email()
    await _cadastrar(cliente, email=email)
    await cliente.post("/api/v1/auth/entrar",
                       json={"email": email, "senha": "errada-mesmo-assim"})

    acoes = (await sessao.scalars(select(RegistroAuditoria.acao))).all()
    assert "sessao.falha" in acoes


async def test_login_bem_sucedido_e_auditado(cliente, sessao):
    email = _email()
    await _cadastrar(cliente, email=email)
    await cliente.post("/api/v1/auth/entrar", json={"email": email, "senha": SENHA})

    acoes = (await sessao.scalars(select(RegistroAuditoria.acao))).all()
    assert "sessao.iniciada" in acoes


# ===================== FA-03 Renovar sessão =====================


async def test_renovacao_devolve_token_novo_e_rotaciona_o_cookie(cliente):
    await _cadastrar(cliente)
    antigo = cliente.cookies[COOKIE]

    resposta = await cliente.post("/api/v1/auth/renovar")

    assert resposta.status_code == 200
    assert resposta.json()["token"]
    assert cliente.cookies[COOKIE] != antigo


async def test_renovacao_sem_cookie_e_recusada(cliente):
    resposta = await cliente.post("/api/v1/auth/renovar")
    assert resposta.status_code == 401
    assert resposta.json()["codigo"] == "sessao_invalida"


async def test_corrida_dentro_da_janela_nao_derruba_a_sessao(cliente):
    """
    Duas abas, retry de rede ou o StrictMode do React reapresentam o mesmo
    cookie em sequência. Isso não pode custar a sessão de quem não fez nada.
    """
    await _cadastrar(cliente)
    antigo = cliente.cookies[COOKIE]

    await cliente.post("/api/v1/auth/renovar")
    cliente.cookies.set(COOKIE, antigo)
    repetida = await cliente.post("/api/v1/auth/renovar")

    assert repetida.status_code == 200


async def test_reuso_fora_da_janela_derruba_a_familia(cliente, sessao, monkeypatch):
    """Token consumido reaparecendo muito depois é sinal de roubo."""
    await _cadastrar(cliente)
    antigo = cliente.cookies[COOKIE]
    await cliente.post("/api/v1/auth/renovar")
    vivo = cliente.cookies[COOKIE]

    monkeypatch.setattr(config, "refresh_graca_segundos", -1)

    cliente.cookies.set(COOKIE, antigo)
    roubo = await cliente.post("/api/v1/auth/renovar")
    assert roubo.status_code == 401

    # A família inteira cai: nem o token legítimo serve mais.
    cliente.cookies.set(COOKIE, vivo)
    depois = await cliente.post("/api/v1/auth/renovar")
    assert depois.status_code == 401

    acoes = (await sessao.scalars(select(RegistroAuditoria.acao))).all()
    assert "sessao.reuso_detectado" in acoes


async def test_refresh_expirado_e_recusado(cliente, sessao):
    await _cadastrar(cliente)
    registro = await sessao.scalar(
        select(TokenSessao).where(
            TokenSessao.token_hash == hash_refresh_token(cliente.cookies[COOKIE]))
    )
    registro.expira_em = datetime.now(timezone.utc) - timedelta(seconds=1)
    await sessao.flush()

    resposta = await cliente.post("/api/v1/auth/renovar")
    assert resposta.status_code == 401
    assert resposta.json()["codigo"] == "sessao_expirada"


async def test_refresh_e_guardado_apenas_como_resumo(cliente, sessao):
    """O token em claro nunca vai para o banco."""
    await _cadastrar(cliente)
    bruto = cliente.cookies[COOKIE]

    guardados = (await sessao.scalars(select(TokenSessao.token_hash))).all()
    assert bruto not in guardados
    assert hash_refresh_token(bruto) in guardados


# ===================== FA-05 Sair =====================


async def test_logout_revoga_a_sessao(cliente):
    await _cadastrar(cliente)
    assert (await cliente.post("/api/v1/auth/sair")).status_code == 200

    cliente.cookies.clear()
    assert (await cliente.post("/api/v1/auth/renovar")).status_code == 401


async def test_logout_sem_cookie_nao_quebra(cliente):
    assert (await cliente.post("/api/v1/auth/sair")).status_code == 200


# ===================== FA-04 Redefinir senha =====================


async def test_pedido_responde_igual_exista_ou_nao_a_conta(cliente):
    """FA-04 E1 — não revela quais e-mails estão cadastrados."""
    email = _email()
    await _cadastrar(cliente, email=email)

    existe = await cliente.post("/api/v1/auth/senha/esqueci", json={"email": email})
    nao_existe = await cliente.post("/api/v1/auth/senha/esqueci",
                                    json={"email": _email()})

    assert existe.status_code == nao_existe.status_code == 200
    assert existe.json() == nao_existe.json()


async def _token_de_redefinicao(cliente, sessao, email) -> str:
    """Recupera o token bruto interceptando o e-mail no modo console."""
    import app.core.email as modulo_email

    capturado: dict[str, str] = {}

    def _falso(destinatario, nome, token):
        capturado["token"] = token

    original = modulo_email.enviar_redefinicao_senha
    modulo_email.enviar_redefinicao_senha = _falso
    try:
        await cliente.post("/api/v1/auth/senha/esqueci", json={"email": email})
    finally:
        modulo_email.enviar_redefinicao_senha = original
    return capturado["token"]


async def test_redefinicao_troca_a_senha(cliente, sessao, monkeypatch):
    import app.services.auth_service as servico

    email = _email()
    await _cadastrar(cliente, email=email)

    capturado: dict[str, str] = {}
    monkeypatch.setattr(servico.email, "enviar_redefinicao_senha",
                        lambda d, n, t: capturado.update(token=t))
    await cliente.post("/api/v1/auth/senha/esqueci", json={"email": email})

    nova = "senha-nova-bem-longa"
    resposta = await cliente.post("/api/v1/auth/senha/redefinir",
                                  json={"token": capturado["token"], "senha": nova})
    assert resposta.status_code == 200

    assert (await cliente.post("/api/v1/auth/entrar",
                               json={"email": email, "senha": nova})).status_code == 200
    assert (await cliente.post("/api/v1/auth/entrar",
                               json={"email": email, "senha": SENHA})).status_code == 400


async def test_redefinicao_revoga_todas_as_sessoes(cliente, sessao, monkeypatch):
    """
    RN-38 — quem redefine costuma reagir a suspeita de invasão; deixar a sessão
    do invasor viva anularia a troca.
    """
    import app.services.auth_service as servico

    email = _email()
    await _cadastrar(cliente, email=email)

    capturado: dict[str, str] = {}
    monkeypatch.setattr(servico.email, "enviar_redefinicao_senha",
                        lambda d, n, t: capturado.update(token=t))
    await cliente.post("/api/v1/auth/senha/esqueci", json={"email": email})
    await cliente.post("/api/v1/auth/senha/redefinir",
                       json={"token": capturado["token"], "senha": "outra-senha-longa"})

    assert (await cliente.post("/api/v1/auth/renovar")).status_code == 401


async def test_token_de_redefinicao_vale_uma_vez(cliente, sessao, monkeypatch):
    import app.services.auth_service as servico

    email = _email()
    await _cadastrar(cliente, email=email)

    capturado: dict[str, str] = {}
    monkeypatch.setattr(servico.email, "enviar_redefinicao_senha",
                        lambda d, n, t: capturado.update(token=t))
    await cliente.post("/api/v1/auth/senha/esqueci", json={"email": email})

    corpo = {"token": capturado["token"], "senha": "senha-nova-bem-longa"}
    assert (await cliente.post("/api/v1/auth/senha/redefinir", json=corpo)).status_code == 200

    repetido = await cliente.post("/api/v1/auth/senha/redefinir", json=corpo)
    assert repetido.status_code == 400
    assert repetido.json()["codigo"] == "token_expirado"


async def test_pedir_de_novo_invalida_o_link_anterior(cliente, sessao, monkeypatch):
    import app.services.auth_service as servico

    email = _email()
    await _cadastrar(cliente, email=email)

    tokens: list[str] = []
    monkeypatch.setattr(servico.email, "enviar_redefinicao_senha",
                        lambda d, n, t: tokens.append(t))
    await cliente.post("/api/v1/auth/senha/esqueci", json={"email": email})
    await cliente.post("/api/v1/auth/senha/esqueci", json={"email": email})

    primeiro = await cliente.post("/api/v1/auth/senha/redefinir",
                                  json={"token": tokens[0], "senha": "senha-nova-longa"})
    assert primeiro.status_code == 400

    segundo = await cliente.post("/api/v1/auth/senha/redefinir",
                                 json={"token": tokens[1], "senha": "senha-nova-longa"})
    assert segundo.status_code == 200


async def test_token_inventado_e_recusado(cliente):
    resposta = await cliente.post("/api/v1/auth/senha/redefinir",
                                  json={"token": "nao-existe", "senha": "senha-longa-ok"})
    assert resposta.status_code == 400
    assert resposta.json()["codigo"] == "token_expirado"


# ===================== Limite de tentativas =====================


async def test_excesso_de_tentativas_e_barrado(cliente, monkeypatch):
    monkeypatch.setattr(config, "rate_limit_tentativas", 3)
    rate_limit.zerar()

    for _ in range(3):
        await cliente.post("/api/v1/auth/entrar",
                           json={"email": _email(), "senha": SENHA})

    excedente = await cliente.post("/api/v1/auth/entrar",
                                   json={"email": _email(), "senha": SENHA})
    assert excedente.status_code == 429
    assert excedente.json()["codigo"] == "muitas_tentativas"

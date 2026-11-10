"""
Testes das métricas do Prometheus (docs/monitoramento.md).

Os contadores são globais ao processo e não voltam a zero entre testes, então
cada teste compara o valor antes e depois do que provoca.
"""

from __future__ import annotations

import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from prometheus_client import REGISTRY

from app.core import rate_limit
from app.core.config import config
from app.db.session import obter_sessao
from app.main import app


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
    transporte = ASGITransport(app=app)
    async with AsyncClient(transport=transporte, base_url="http://teste") as c:
        yield c
    app.dependency_overrides.clear()


def _valor(nome: str, **rotulos: str) -> float:
    return REGISTRY.get_sample_value(nome, rotulos) or 0.0


async def test_requisicao_e_contada_pelo_molde_da_rota(cliente):
    """Um id na URL não pode virar uma série nova: o rótulo é o molde."""
    rotulos = {"metodo": "GET", "rota": "/api/v1/atividades/{atividade_id}",
               "status": "404"}
    antes = _valor("maishoras_http_requisicoes_total", **rotulos)

    await cliente.get(f"/api/v1/atividades/{uuid.uuid4()}")
    await cliente.get(f"/api/v1/atividades/{uuid.uuid4()}")

    assert _valor("maishoras_http_requisicoes_total", **rotulos) == antes + 2
    assert _valor("maishoras_http_duracao_segundos_count", metodo="GET",
                  rota="/api/v1/atividades/{atividade_id}") >= 2


async def test_caminho_sem_rota_vira_um_rotulo_so(cliente):
    rotulos = {"metodo": "GET", "rota": "nao_encontrada", "status": "404"}
    antes = _valor("maishoras_http_requisicoes_total", **rotulos)

    await cliente.get("/wp-login.php")
    await cliente.get("/.env")

    assert _valor("maishoras_http_requisicoes_total", **rotulos) == antes + 2


async def test_metrics_responde_na_rede_interna(cliente):
    resposta = await cliente.get("/metrics")

    assert resposta.status_code == 200
    assert resposta.headers["content-type"].startswith("text/plain")
    assert "maishoras_eventos_total" in resposta.text
    assert "maishoras_banco_conexoes" in resposta.text


async def test_metrics_recusa_quem_passou_por_proxy(cliente):
    """O Caddy não repassa /metrics, e quem chega com X-Forwarded-For veio por ele."""
    resposta = await cliente.get("/metrics", headers={"X-Forwarded-For": "203.0.113.9"})

    assert resposta.status_code == 404
    assert "maishoras_" not in resposta.text


async def test_login_errado_conta_como_evento_de_falha(cliente):
    antes = _valor("maishoras_eventos_total", acao="sessao.falha")

    resposta = await cliente.post("/api/v1/auth/entrar", json={
        "email": f"{uuid.uuid4().hex[:10]}@teste.com", "senha": "nao-e-esta"})

    assert resposta.status_code == 400
    assert _valor("maishoras_eventos_total", acao="sessao.falha") == antes + 1


async def test_toda_acao_do_catalogo_comeca_em_zero(cliente):
    """Sem a série criada, "nenhum reuso de token" vira "sem dado" no painel."""
    resposta = await cliente.get("/metrics")

    assert 'maishoras_eventos_total{acao="sessao.reuso_detectado"}' in resposta.text


async def test_bloqueio_por_excesso_de_tentativas_e_contado(cliente, monkeypatch):
    monkeypatch.setattr(config, "rate_limit_tentativas", 2)
    antes = _valor("maishoras_limite_excedido_total", balde="auth")

    for _ in range(4):
        await cliente.post("/api/v1/auth/entrar", json={
            "email": "alguem@teste.com", "senha": "chute"})

    assert _valor("maishoras_limite_excedido_total", balde="auth") == antes + 2


async def test_verificacao_publica_conta_o_desfecho(cliente):
    antes = _valor("maishoras_certificado_verificacoes_total", desfecho="inexistente")

    resposta = await cliente.get("/api/v1/certificados/verificar/0000000000000000")

    assert resposta.status_code == 404
    assert _valor("maishoras_certificado_verificacoes_total",
                  desfecho="inexistente") == antes + 1

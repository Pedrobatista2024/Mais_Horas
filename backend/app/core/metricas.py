"""
Métricas para o Prometheus (docs/monitoramento.md).

A API conta o que só ela enxerga: quanto cada rota demora, quantas respostas
de erro saem e o que acontece com login, check-in e certificado. O resto — CPU,
memória, banco — os exportadores do monitoramento leem de fora.

Três cuidados guiam o arquivo:

- **A rota é o molde, nunca o caminho.** `/atividades/{atividade_id}` é uma
  série só; usar o caminho real criaria uma série por id e derrubaria o
  Prometheus. Caminho que não casa com rota nenhuma vira `nao_encontrada`.
- **Eventos de negócio saem da auditoria.** Toda ação relevante já passa por
  `auditoria.registrar()`, com catálogo fechado; contar ali dá as métricas de
  login, check-in e certificado sem espalhar contador pelo código, e o número
  de séries fica limitado ao catálogo.
- **`/metrics` não é público.** O Caddy só repassa `/api`, `/uploads` e
  `/saude`; a rota ainda recusa quem chega com `X-Forwarded-For`, que é o sinal
  de ter passado por um proxy.
"""

from __future__ import annotations

import time

from prometheus_client import Counter, Gauge, Histogram
from prometheus_client.core import GaugeMetricFamily
from prometheus_client.registry import REGISTRY

REQUISICOES = Counter(
    "maishoras_http_requisicoes_total",
    "Requisições respondidas pela API, por rota e status.",
    ["metodo", "rota", "status"],
)

# Faixas pensadas para uma API de formulário: a maioria responde em dezenas de
# milissegundos; login (Argon2) e PDF ficam entre 100 ms e 1 s.
DURACAO = Histogram(
    "maishoras_http_duracao_segundos",
    "Tempo de resposta da API, por rota.",
    ["metodo", "rota"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
)

EM_ANDAMENTO = Gauge(
    "maishoras_http_em_andamento",
    "Requisições sendo atendidas neste instante.",
)

EVENTOS = Counter(
    "maishoras_eventos_total",
    "Ações gravadas na trilha de auditoria (catálogo de docs/contrato-api.md).",
    ["acao"],
)

LIMITE_EXCEDIDO = Counter(
    "maishoras_limite_excedido_total",
    "Requisições barradas pelo limite de tentativas (RNF-08, RN-52).",
    ["balde"],
)

VERIFICACOES = Counter(
    "maishoras_certificado_verificacoes_total",
    "Verificações públicas de certificado, por desfecho.",
    ["desfecho"],
)

# Começam em zero: sem isso, "nenhum bloqueio" aparece no painel como "sem
# dado", que é outra coisa.
for _balde in ("auth", "verificacao"):
    LIMITE_EXCEDIDO.labels(_balde)
for _desfecho in ("valido", "revogado", "adulterado", "inexistente"):
    VERIFICACOES.labels(_desfecho)


def contar_evento(acao: str) -> None:
    EVENTOS.labels(acao).inc()


def iniciar_eventos(acoes: set[str]) -> None:
    """Cria a série de cada ação do catálogo com zero."""
    for acao in acoes:
        EVENTOS.labels(acao)


class _ColetorDoPool:
    """Conexões do pool do SQLAlchemy, lidas na hora da coleta."""

    def collect(self):
        from app.db.session import engine

        pool = engine.sync_engine.pool
        familia = GaugeMetricFamily(
            "maishoras_banco_conexoes",
            "Conexões do pool da API com o Postgres.",
            labels=["estado"],
        )
        # NullPool (usado em alguns testes) não tem contagem.
        if hasattr(pool, "checkedout"):
            familia.add_metric(["em_uso"], pool.checkedout())
            familia.add_metric(["livres"], pool.checkedin())
        yield familia


REGISTRY.register(_ColetorDoPool())


def _rota(escopo: dict) -> str:
    """O molde da rota que atendeu, ou um rótulo fixo quando nenhuma atendeu."""
    rota = escopo.get("route")
    if rota is not None and getattr(rota, "path", None):
        return rota.path
    if escopo["path"].startswith("/uploads/"):
        return "/uploads"
    return "nao_encontrada"


class MedirRequisicoes:
    """
    Middleware ASGI que mede cada requisição HTTP.

    É ASGI puro, e não `BaseHTTPMiddleware`, para enxergar também a resposta
    500 de uma exceção não tratada: ela sobe por aqui antes de virar resposta.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, escopo, receber, enviar):
        if escopo["type"] != "http" or escopo["path"] == "/metrics":
            await self.app(escopo, receber, enviar)
            return

        inicio = time.perf_counter()
        situacao = 500

        async def enviar_medindo(mensagem):
            nonlocal situacao
            if mensagem["type"] == "http.response.start":
                situacao = mensagem["status"]
            await enviar(mensagem)

        EM_ANDAMENTO.inc()
        try:
            await self.app(escopo, receber, enviar_medindo)
        finally:
            EM_ANDAMENTO.dec()
            metodo, rota = escopo["method"], _rota(escopo)
            REQUISICOES.labels(metodo, rota, str(situacao)).inc()
            DURACAO.labels(metodo, rota).observe(time.perf_counter() - inicio)

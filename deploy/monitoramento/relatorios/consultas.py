"""
De onde vêm os números do relatório: o Prometheus (séries) e o banco do Mais
Horas (detalhe da trilha de auditoria), com o papel `painel`, que só lê.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import datetime, timedelta

import asyncpg
import httpx

from indicadores import INDICADORES, Indicador, nivel

PROMETHEUS = os.environ.get("PROMETHEUS_URL", "http://prometheus:9090")
BANCO = os.environ.get("BANCO_URL", "")

# Período: rótulo, duração e o passo dos gráficos (cerca de 300 pontos cada).
PERIODOS = {
    "24h": ("Últimas 24 horas", timedelta(hours=24), "5m"),
    "7d": ("Últimos 7 dias", timedelta(days=7), "30m"),
    "30d": ("Últimos 30 dias", timedelta(days=30), "2h"),
}


@dataclass
class Linha:
    indicador: Indicador
    atual: float | None
    anterior: float | None
    nivel: str


@dataclass
class Dados:
    rotulo: str
    inicio: datetime
    fim: datetime
    cobertura_atual: float
    cobertura_anterior: float
    linhas: list[Linha] = field(default_factory=list)
    series: dict[str, list] = field(default_factory=dict)
    rotas: list[dict] = field(default_factory=list)
    alertas: list[dict] = field(default_factory=list)
    ips: list[dict] = field(default_factory=list)
    contas: list[dict] = field(default_factory=list)
    consultas: list[dict] = field(default_factory=list)
    erro_banco: str | None = None


class Prometheus:
    def __init__(self, http: httpx.AsyncClient):
        self.http = http

    async def instantanea(self, expr: str, quando: datetime) -> list[dict]:
        resposta = await self.http.post(f"{PROMETHEUS}/api/v1/query",
                                        data={"query": expr, "time": quando.timestamp()})
        resposta.raise_for_status()
        return resposta.json()["data"]["result"]

    async def valor(self, expr: str, quando: datetime) -> float | None:
        resultado = await self.instantanea(expr, quando)
        if not resultado:
            return None
        valor = float(resultado[0]["value"][1])
        return None if valor != valor else valor  # NaN = sem dado

    async def intervalo(self, expr: str, inicio: datetime, fim: datetime,
                        passo: str) -> list[tuple[float, float]]:
        resposta = await self.http.post(f"{PROMETHEUS}/api/v1/query_range", data={
            "query": expr, "start": inicio.timestamp(), "end": fim.timestamp(),
            "step": passo})
        resposta.raise_for_status()
        resultado = resposta.json()["data"]["result"]
        if not resultado:
            return []
        return [(float(t), float(v)) for t, v in resultado[0]["values"] if v != "NaN"]


async def _cobertura(prom: Prometheus, fim: datetime, duracao: timedelta, r: str) -> float:
    """Fração do período em que a API foi coletada (uma amostra a cada 15 s)."""
    amostras = await prom.valor(f'count_over_time(up{{job="api"}}[{r}])', fim)
    if not amostras:
        return 0.0
    return min(1.0, amostras * 15 / duracao.total_seconds())


async def coletar(chave: str, agora: datetime) -> Dados:
    rotulo, duracao, passo = PERIODOS[chave]
    r = chave
    fim, inicio = agora, agora - duracao
    dias = duracao.total_seconds() / 86400

    async with httpx.AsyncClient(timeout=60) as http:
        prom = Prometheus(http)
        dados = Dados(rotulo, inicio, fim,
                      await _cobertura(prom, fim, duracao, r),
                      await _cobertura(prom, inicio, duracao, r))

        for ind in INDICADORES:
            expr = ind.expr.format(r=r)
            atual = await prom.valor(expr, fim) if dados.cobertura_atual else None
            anterior = (await prom.valor(expr, inicio)
                        if dados.cobertura_anterior else None)
            dados.linhas.append(Linha(ind, atual, anterior, nivel(ind, atual, dias)))

        req = "sum(rate(maishoras_http_requisicoes_total[5m])) * 60"
        p95 = ('histogram_quantile(0.95, sum by (le) (rate('
               'maishoras_http_duracao_segundos_bucket{rota!="nao_encontrada"}[5m])))')
        aceitos = 'sum(increase(maishoras_eventos_total{acao="sessao.iniciada"}[1h]))'
        recusados = 'sum(increase(maishoras_eventos_total{acao="sessao.falha"}[1h]))'
        cpu = '100 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100'
        mem = "(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100"
        for nome, expr in (("req", req), ("p95", p95), ("aceitos", aceitos),
                           ("recusados", recusados), ("cpu", cpu), ("mem", mem)):
            dados.series[nome] = await prom.intervalo(expr, inicio, fim, passo)
            dados.series[nome + "_anterior"] = [
                (t + duracao.total_seconds(), v)
                for t, v in await prom.intervalo(expr, inicio - duracao, inicio, passo)]

        chamadas = await prom.instantanea(
            f"sum by (metodo, rota) (increase(maishoras_http_requisicoes_total"
            f'{{rota!="nao_encontrada"}}[{r}]))', fim)
        lentidao = await prom.instantanea(
            f"histogram_quantile(0.95, sum by (le, metodo, rota) "
            f"(increase(maishoras_http_duracao_segundos_bucket[{r}])))", fim)
        erros = await prom.instantanea(
            f"sum by (metodo, rota) (increase(maishoras_http_requisicoes_total"
            f'{{status=~"5.."}}[{r}]))', fim)
        dados.rotas = _rotas(chamadas, lentidao, erros)

        disparos = await prom.instantanea(
            f'count_over_time(ALERTS{{alertstate="firing"}}[{r}:1m])', fim)
        dados.alertas = sorted(
            ({"titulo": a["metric"].get("titulo", a["metric"].get("alertname")),
              "nivel": a["metric"].get("nivel", ""), "area": a["metric"].get("area", ""),
              "minutos": int(float(a["value"][1]))} for a in disparos),
            key=lambda a: (a["nivel"] != "critico", -a["minutos"]))

    await _do_banco(dados)
    return dados


def _rotas(chamadas: list, lentidao: list, erros: list) -> list[dict]:
    def chave(item):
        return item["metric"].get("metodo", ""), item["metric"].get("rota", "")

    p95 = {chave(i): float(i["value"][1]) for i in lentidao}
    e5 = {chave(i): float(i["value"][1]) for i in erros}
    rotas = []
    for item in chamadas:
        total = float(item["value"][1])
        if total < 1:
            continue
        k = chave(item)
        tempo = p95.get(k)
        rotas.append({"metodo": k[0], "rota": k[1], "chamadas": round(total),
                      "p95": None if tempo is None or tempo != tempo else tempo,
                      "erros": e5.get(k, 0) / total * 100})
    return sorted(rotas, key=lambda r: r["p95"] or 0, reverse=True)[:10]


async def _do_banco(dados: Dados) -> None:
    if not BANCO:
        dados.erro_banco = "Banco não configurado (BANCO_URL)."
        return
    try:
        conexao = await asyncpg.connect(BANCO, timeout=10)
    except Exception as erro:  # o relatório sai sem a seção, dizendo o porquê
        dados.erro_banco = f"Não foi possível ler o banco: {erro.__class__.__name__}."
        return
    try:
        dados.ips = [dict(r) for r in await conexao.fetch("""
            SELECT host(ip) AS ip, count(*) AS recusas,
                   count(DISTINCT entidade_id) AS contas, max(ocorrido_em) AS ultima
            FROM registros_auditoria
            WHERE acao = 'sessao.falha' AND ocorrido_em BETWEEN $1 AND $2
            GROUP BY ip ORDER BY 2 DESC LIMIT 10""", dados.inicio, dados.fim)]
        dados.contas = [dict(r) for r in await conexao.fetch("""
            SELECT COALESCE(u.email, 'e-mail não cadastrado') AS conta,
                   count(*) AS recusas, count(DISTINCT r.ip) AS ips
            FROM registros_auditoria r LEFT JOIN usuarios u ON u.id = r.entidade_id
            WHERE r.acao = 'sessao.falha' AND r.ocorrido_em BETWEEN $1 AND $2
            GROUP BY 1 ORDER BY 2 DESC LIMIT 8""", dados.inicio, dados.fim)]
        dados.consultas = [dict(r) for r in await conexao.fetch("""
            SELECT left(regexp_replace(s.query, '\\s+', ' ', 'g'), 110) AS consulta,
                   s.calls AS chamadas, s.mean_exec_time AS media,
                   s.total_exec_time AS total
            FROM pg_stat_statements s JOIN pg_database d ON d.oid = s.dbid
            WHERE d.datname = 'mais_horas'
              AND pg_get_userbyid(s.userid) NOT IN ('monitoramento', 'painel')
              AND s.query !~* '^\\s*(create|alter|grant|revoke|comment|set|show|vacuum)'
            ORDER BY s.total_exec_time DESC LIMIT 6""")]
    except Exception as erro:
        dados.erro_banco = f"Consulta ao banco falhou: {erro.__class__.__name__}."
    finally:
        await conexao.close()

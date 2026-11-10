"""
Os indicadores do relatório e os níveis de cada um.

Os limiares são os mesmos dos painéis do Grafana (grafana/gerar_paineis.py) e
dos alertas (prometheus/alertas.yml): o que é "atenção" no painel é "atenção"
no PDF. `{r}` vira a duração do período ("7d"); `por_dia` multiplica os
limiares pelo número de dias, porque 50 logins recusados num dia não é o mesmo
que 50 num mês.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Indicador:
    area: str
    nome: str
    expr: str
    unidade: str              # "%", "s", "n" (contagem)
    atencao: float | None = None
    critico: float | None = None
    invertido: bool = False   # quanto menor, pior
    por_dia: bool = False
    explicacao: str = ""


def _evento(acao: str) -> str:
    # Chaves dobradas duas vezes: uma pelo f-string, outra pelo `.format(r=...)`.
    return f'sum(increase(maishoras_eventos_total{{{{acao="{acao}"}}}}[{{r}}])) or vector(0)'


_REQ = "maishoras_http_requisicoes_total"
_DUR = 'maishoras_http_duracao_segundos_bucket{{rota!="nao_encontrada"}}'
_DB = 'datname="mais_horas"'
_CPU = '100 - avg(rate(node_cpu_seconds_total{{mode="idle"}}[5m])) * 100'
_MEM = "(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100"

INDICADORES = [
    Indicador("Disponibilidade", "Disponibilidade vista de fora",
              'avg(avg_over_time(probe_success{{job="disponibilidade"}}[{r}])) * 100',
              "%", 99.5, 95, invertido=True,
              explicacao="Sondas por HTTPS que deram certo, a cada 30 s."),
    Indicador("Desempenho", "Tempo de resposta (p95)",
              f"histogram_quantile(0.95, sum by (le) (increase({_DUR}[{{r}}])))", "s", 0.5, 1,
              explicacao="95% das respostas da API saíram abaixo deste tempo."),
    Indicador("Desempenho", "Tempo de resposta (p99)",
              f"histogram_quantile(0.99, sum by (le) (increase({_DUR}[{{r}}])))", "s", 1, 2.5),
    # Sem 5xx a série nem existe: o `or vector(0)` vira 0%. Sem tráfego nenhum,
    # o divisor some e o resultado fica "sem dado", que é o certo.
    Indicador("Desempenho", "Erros do servidor (5xx)",
              f'(sum(increase({_REQ}{{{{status=~"5.."}}}}[{{r}}])) or vector(0)) '
              f"/ clamp_min(sum(increase({_REQ}[{{r}}])), 1) * 100", "%", 1, 5),
    Indicador("Desempenho", "Requisições atendidas", f"sum(increase({_REQ}[{{r}}]))", "n"),
    Indicador("Segurança", "Logins aceitos", _evento("sessao.iniciada"), "n"),
    Indicador("Segurança", "Logins recusados", _evento("sessao.falha"), "n", 50, 200,
              por_dia=True),
    Indicador("Segurança", "Taxa de recusa de login",
              '(sum(increase(maishoras_eventos_total{{acao="sessao.falha"}}[{r}])) '
              '/ clamp_min(sum(increase(maishoras_eventos_total{{acao=~"sessao.falha|sessao.iniciada"}}[{r}])), 1)) '
              "* 100 or vector(0)", "%", 20, 50,
              explicacao="Abaixo de 20% é erro de digitação; acima, alguém chutando senha."),
    Indicador("Segurança", "Bloqueios por força bruta",
              'sum(increase(maishoras_limite_excedido_total{{balde="auth"}}[{r}])) or vector(0)',
              "n", 1, 50, por_dia=True),
    Indicador("Segurança", "Sessões roubadas detectadas", _evento("sessao.reuso_detectado"),
              "n", None, 1),
    Indicador("Segurança", "QR inválido no check-in", _evento("checkin.token_invalido"),
              "n", 5, 20, por_dia=True),
    Indicador("Segurança", "Bloqueios de varredura de certificados",
              'sum(increase(maishoras_limite_excedido_total{{balde="verificacao"}}[{r}])) '
              "or vector(0)", "n", 1, 100, por_dia=True),
    Indicador("Uso", "Contas criadas", _evento("conta.criada"), "n"),
    Indicador("Uso", "Inscrições", _evento("inscricao.criada"), "n"),
    Indicador("Uso", "Check-ins registrados", _evento("checkin.registrado"), "n"),
    Indicador("Uso", "Certificados emitidos", _evento("certificado.emitido"), "n"),
    Indicador("Uso", "Verificações públicas de certificado",
              "sum(increase(maishoras_certificado_verificacoes_total[{r}])) or vector(0)", "n"),
    Indicador("Banco", "Conexões no pico",
              f"max_over_time(sum(pg_stat_activity_count{{{{{_DB}}}}})[{{r}}:1m])", "n", 60, 85),
    Indicador("Banco", "Leituras atendidas pelo cache",
              f"sum(increase(pg_stat_database_blks_hit{{{{{_DB}}}}}[{{r}}])) / clamp_min("
              f"sum(increase(pg_stat_database_blks_hit{{{{{_DB}}}}}[{{r}}])) + "
              f"sum(increase(pg_stat_database_blks_read{{{{{_DB}}}}}[{{r}}])), 1) * 100",
              "%", 95, 90, invertido=True),
    Indicador("Banco", "Deadlocks",
              f"sum(increase(pg_stat_database_deadlocks{{{{{_DB}}}}}[{{r}}])) or vector(0)",
              "n", 1, 5),
    Indicador("Servidor", "CPU média", f"avg_over_time(({_CPU})[{{r}}:5m])", "%", 60, 80),
    Indicador("Servidor", "CPU no pico", f"max_over_time(({_CPU})[{{r}}:5m])", "%", 85, 95),
    Indicador("Servidor", "Memória no pico", f"max_over_time(({_MEM})[{{r}}:5m])", "%", 85, 95),
    Indicador("Servidor", "Disco usado",
              '(1 - node_filesystem_avail_bytes{{mountpoint="/"}} '
              '/ node_filesystem_size_bytes{{mountpoint="/"}}) * 100', "%", 80, 92),
]

# Contagem de uso não tem certo ou errado: fica "Informativo".
OK, ATENCAO, CRITICO, NEUTRO = "OK", "Atenção", "Crítico", "Informativo"
ORDEM = {NEUTRO: 0, OK: 1, ATENCAO: 2, CRITICO: 3}


def nivel(indicador: Indicador, valor: float | None, dias: float) -> str:
    if valor is None or (indicador.atencao is None and indicador.critico is None):
        return NEUTRO
    escala = dias if indicador.por_dia else 1
    atencao = indicador.atencao * escala if indicador.atencao is not None else None
    critico = indicador.critico * escala if indicador.critico is not None else None
    if indicador.invertido:
        if critico is not None and valor < critico:
            return CRITICO
        if atencao is not None and valor < atencao:
            return ATENCAO
        return OK
    if critico is not None and valor >= critico:
        return CRITICO
    if atencao is not None and valor >= atencao:
        return ATENCAO
    return OK

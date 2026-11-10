#!/usr/bin/env python3
"""
Gera os painéis do Grafana (grafana/paineis/*.json).

Painel do Grafana é um JSON longo e repetitivo; escrever à mão espalha o mesmo
limiar em dez lugares. Aqui cada painel é uma chamada, e os níveis (OK,
Atenção, Crítico) moram num lugar só. O Grafana carrega os arquivos gerados e
não aceita edição pela tela: mudou algo, mude aqui e rode de novo.

    python deploy/monitoramento/grafana/gerar_paineis.py
"""

from __future__ import annotations

import json
from pathlib import Path

PASTA = Path(__file__).resolve().parent / "paineis"

PROM = {"type": "prometheus", "uid": "prometheus"}
BANCO = {"type": "grafana-postgresql-datasource", "uid": "mais-horas-banco"}

VERDE, AMARELO, VERMELHO, AZUL, ROXO = "green", "#f2a20c", "red", "#3a63e0", "purple"

# Rótulo de status virando "2xx", "4xx"... para agrupar por classe.
POR_CLASSE = 'label_replace({expr}, "classe", "${{1}}xx", "status", "(.)..")'

P95 = ('histogram_quantile(0.95, sum by (le) '
       '(rate(maishoras_http_duracao_segundos_bucket{rota!="nao_encontrada"}[5m])))')
TAXA_5XX = ('(sum(rate(maishoras_http_requisicoes_total{status=~"5.."}[5m])) '
            '/ clamp_min(sum(rate(maishoras_http_requisicoes_total[5m])), 1e-9)) * 100 '
            'or vector(0)')
CPU = '100 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100'
MEMORIA = '(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100'
DISCO = ('(1 - node_filesystem_avail_bytes{mountpoint="/"} '
         '/ node_filesystem_size_bytes{mountpoint="/"}) * 100')


def evento(acao: str, janela: str = "$__range") -> str:
    return f'sum(increase(maishoras_eventos_total{{acao="{acao}"}}[{janela}])) or vector(0)'


# ===================== Peças =====================


def prom(expr: str, legenda: str = "", ref: str = "A", *, instantanea: bool = False,
         tabela: bool = False) -> dict:
    return {"datasource": PROM, "refId": ref, "expr": expr, "legendFormat": legenda,
            "instant": instantanea, "range": not instantanea,
            "format": "table" if tabela else "time_series", "editorMode": "code"}


def sql(consulta: str, ref: str = "A", *, serie: bool = False) -> dict:
    return {"datasource": BANCO, "refId": ref, "rawSql": consulta.strip(),
            "format": "time_series" if serie else "table", "rawQuery": True,
            "editorMode": "code"}


def niveis(atencao: float | None, critico: float | None, *, invertido: bool = False,
           base: str = VERDE) -> dict:
    """Limiares absolutos. `invertido`: quanto menor, pior (disponibilidade, cache)."""
    if invertido:
        passos = [{"color": VERMELHO, "value": None}]
        if critico is not None:
            passos.append({"color": AMARELO, "value": critico})
        if atencao is not None:
            passos.append({"color": VERDE, "value": atencao})
        return {"mode": "absolute", "steps": passos}
    passos = [{"color": base, "value": None}]
    if atencao is not None:
        passos.append({"color": AMARELO, "value": atencao})
    if critico is not None:
        passos.append({"color": VERMELHO, "value": critico})
    return {"mode": "absolute", "steps": passos}


def fixo(cor: str) -> dict:
    return {"mode": "absolute", "steps": [{"color": cor, "value": None}]}


def _base(tipo: str, titulo: str, pos: tuple[int, int, int, int], alvos: list,
          descricao: str, fonte: dict) -> dict:
    # Cada consulta do painel precisa de um refId próprio, senão o Grafana
    # recusa o painel inteiro. A, B, C... na ordem em que aparecem.
    for i, alvo in enumerate(alvos):
        alvo["refId"] = chr(ord("A") + i)
    x, y, w, h = pos
    return {"type": tipo, "title": titulo, "description": descricao, "datasource": fonte,
            "gridPos": {"x": x, "y": y, "w": w, "h": h}, "targets": alvos}


def numero(titulo: str, pos, alvos: list, *, unidade: str = "none", limiares: dict | None = None,
           decimais: int | None = None, mapeamentos: list | None = None, descricao: str = "",
           grafico: bool = False, fonte: dict = PROM, calculo: str = "lastNotNull") -> dict:
    painel = _base("stat", titulo, pos, alvos, descricao, fonte)
    padrao = {"unit": unidade, "thresholds": limiares or fixo(AZUL),
              "color": {"mode": "thresholds"}, "mappings": mapeamentos or []}
    if decimais is not None:
        padrao["decimals"] = decimais
    painel["fieldConfig"] = {"defaults": padrao, "overrides": []}
    painel["options"] = {
        "reduceOptions": {"calcs": [calculo], "fields": "", "values": False},
        "colorMode": "background", "graphMode": "area" if grafico else "none",
        "textMode": "value_and_name" if len(alvos) > 1 else "value",
        "justifyMode": "center", "orientation": "auto", "wideLayout": True,
        "showPercentChange": False,
    }
    return painel


def medidor(titulo: str, pos, alvo: dict, *, limiares: dict, unidade: str = "percent",
            descricao: str = "") -> dict:
    painel = _base("gauge", titulo, pos, [alvo], descricao, PROM)
    painel["fieldConfig"] = {"defaults": {"unit": unidade, "min": 0, "max": 100,
                                          "decimals": 0, "thresholds": limiares,
                                          "color": {"mode": "thresholds"}},
                             "overrides": []}
    painel["options"] = {"reduceOptions": {"calcs": ["lastNotNull"], "fields": "",
                                           "values": False},
                         "showThresholdMarkers": True, "showThresholdLabels": False}
    return painel


def serie(titulo: str, pos, alvos: list, *, unidade: str = "none", empilhar: bool = False,
          cores: dict[str, str] | None = None, descricao: str = "", fonte: dict = PROM,
          barras: bool = False, limiares: dict | None = None, minimo: float | None = 0) -> dict:
    painel = _base("timeseries", titulo, pos, alvos, descricao, fonte)
    personalizado = {
        "drawStyle": "bars" if barras else "line", "lineWidth": 2,
        "fillOpacity": 70 if barras else (35 if empilhar else 12),
        "gradientMode": "opacity",
        "showPoints": "never", "spanNulls": True, "lineInterpolation": "smooth",
        "stacking": {"mode": "normal" if empilhar else "none", "group": "A"},
    }
    padrao = {"unit": unidade, "custom": personalizado, "color": {"mode": "palette-classic"},
              "noValue": "Nada no período"}
    if minimo is not None:
        padrao["min"] = minimo
    if limiares:
        padrao["thresholds"] = limiares
        personalizado["thresholdsStyle"] = {"mode": "dashed"}
    sobreposicoes = [
        {"matcher": {"id": "byName", "options": nome},
         "properties": [{"id": "color", "value": {"mode": "fixed", "fixedColor": cor}}]}
        for nome, cor in (cores or {}).items()
    ]
    painel["fieldConfig"] = {"defaults": padrao, "overrides": sobreposicoes}
    painel["options"] = {"legend": {"displayMode": "list", "placement": "bottom",
                                    "showLegend": True},
                         "tooltip": {"mode": "multi", "sort": "desc"}}
    return painel


def tabela(titulo: str, pos, alvos: list, *, descricao: str = "", fonte: dict = PROM,
           transformacoes: list | None = None, colunas: dict[str, dict] | None = None,
           ordenar: tuple[str, bool] | None = None, vazio: str = "Nada no período") -> dict:
    """`colunas`: nome da coluna -> propriedades (unidade, níveis, largura)."""
    painel = _base("table", titulo, pos, alvos, descricao, fonte)
    sobreposicoes = []
    for nome, props in (colunas or {}).items():
        propriedades = []
        if "unidade" in props:
            propriedades.append({"id": "unit", "value": props["unidade"]})
        if "decimais" in props:
            propriedades.append({"id": "decimals", "value": props["decimais"]})
        if "largura" in props:
            propriedades.append({"id": "custom.width", "value": props["largura"]})
        if "niveis" in props:
            propriedades += [
                {"id": "thresholds", "value": props["niveis"]},
                {"id": "custom.cellOptions", "value": {"type": "color-background",
                                                       "mode": "basic"}},
            ]
        if "mapeamentos" in props:
            propriedades += [
                {"id": "mappings", "value": props["mapeamentos"]},
                {"id": "custom.cellOptions", "value": {"type": "color-background",
                                                       "mode": "basic"}},
            ]
        sobreposicoes.append({"matcher": {"id": "byName", "options": nome},
                              "properties": propriedades})
    painel["fieldConfig"] = {"defaults": {"custom": {"align": "auto", "filterable": False},
                                          "color": {"mode": "thresholds"}, "noValue": vazio,
                                          "thresholds": fixo("transparent")},
                             "overrides": sobreposicoes}
    painel["options"] = {"showHeader": True, "cellHeight": "sm",
                         "footer": {"show": False, "reducer": ["sum"], "fields": ""}}
    if ordenar:
        painel["options"]["sortBy"] = [{"displayName": ordenar[0], "desc": ordenar[1]}]
    painel["transformations"] = transformacoes or []
    return painel


def linha(titulo: str, y: int) -> dict:
    return {"type": "row", "title": titulo, "collapsed": False, "panels": [],
            "gridPos": {"x": 0, "y": y, "w": 24, "h": 1}}


def organizar(renomear: dict[str, str], esconder: list[str] | None = None,
              ordem: list[str] | None = None) -> dict:
    opcoes = {"renameByName": renomear,
              "excludeByName": {nome: True for nome in (esconder or [])}}
    if ordem:
        opcoes["indexByName"] = {nome: i for i, nome in enumerate(ordem)}
    return {"id": "organize", "options": opcoes}


def mapa(*pares: tuple[str, str, str]) -> list:
    """Texto -> (rótulo exibido, cor). Usado para os níveis dos alertas."""
    return [{"type": "value", "options": {valor: {"text": texto, "color": cor, "index": i}
                                          for i, (valor, texto, cor) in enumerate(pares)}}]


def painel(uid: str, titulo: str, descricao: str, paineis: list, *, desde: str = "now-24h",
           etiquetas: tuple[str, ...] = ()) -> dict:
    for i, p in enumerate(paineis, start=1):
        p["id"] = i
    return {
        "uid": uid, "title": titulo, "description": descricao,
        "tags": ["mais-horas", *etiquetas], "timezone": "America/Fortaleza",
        "schemaVersion": 39, "version": 1, "editable": False, "graphTooltip": 1,
        "refresh": "30s", "time": {"from": desde, "to": "now"},
        "timepicker": {"refresh_intervals": ["30s", "1m", "5m", "15m"]},
        "templating": {"list": []},
        "annotations": {"list": [{
            "builtIn": 1, "datasource": {"type": "grafana", "uid": "-- Grafana --"},
            "enable": True, "hide": True, "iconColor": "rgba(0, 211, 255, 1)",
            "name": "Anotações e alertas", "type": "dashboard"}]},
        "links": [
            {"title": "Painéis", "type": "dashboards", "tags": ["mais-horas"],
             "asDropdown": True, "includeVars": False, "keepTime": True},
            {"title": "Relatório em PDF", "type": "link", "icon": "doc",
             "url": "/monitoramento/relatorios/", "targetBlank": True,
             "tooltip": "Gera o relatório com comparativo entre períodos"},
        ],
        "panels": paineis,
    }


# ===================== Painéis =====================

ALERTAS_ATIVOS = tabela(
    "Alertas ativos", (0, 10, 12, 8),
    [prom('ALERTS{alertstate="firing"}', instantanea=True, tabela=True)],
    descricao="Regras de prometheus/alertas.yml disparadas agora. Crítico: olhar agora. "
              "Atenção: olhar hoje.",
    transformacoes=[organizar(
        {"titulo": "Alerta", "nivel": "Nível", "area": "Área"},
        esconder=["Time", "Value", "__name__", "alertstate", "alertname", "instance",
                  "job", "datname", "mountpoint", "device", "fstype", "server"],
        ordem=["nivel", "area", "titulo"])],
    colunas={"Nível": {"largura": 110, "mapeamentos": mapa(
        ("critico", "Crítico", VERMELHO), ("atencao", "Atenção", AMARELO))},
        "Área": {"largura": 140}},
    vazio="Nenhum alerta disparado agora",
)

CLASSES = {"2xx": VERDE, "3xx": AZUL, "4xx": AMARELO, "5xx": VERMELHO}


def visao_geral() -> dict:
    disponivel = mapa(("1", "No ar", VERDE), ("0", "Fora do ar", VERMELHO))
    return painel("visao-geral", "Saúde do Mais Horas",
                  "Resumo da aplicação: está no ar, está rápida, está sendo atacada?", [
        linha("Agora", 0),
        numero("Site no ar", (0, 1, 4, 5),
               [prom('min(probe_success{job="disponibilidade"})')],
               mapeamentos=disponivel, limiares=niveis(None, None, base=VERDE),
               descricao="As três sondas de fora (página, API e /saude) respondendo por HTTPS."),
        numero("Disponibilidade (24 h)", (4, 1, 4, 5),
               [prom('avg(avg_over_time(probe_success{job="disponibilidade"}[24h])) * 100')],
               unidade="percent", decimais=2, limiares=niveis(99.5, 95, invertido=True),
               descricao="Percentual das sondas que deram certo nas últimas 24 horas. "
                         "Verde a partir de 99,5%."),
        numero("Tempo de resposta (p95)", (8, 1, 4, 5), [prom(P95)], unidade="s",
               limiares=niveis(0.5, 1), grafico=True,
               descricao="95% das respostas da API saem abaixo deste tempo. "
                         "Atenção acima de 0,5 s, crítico acima de 1 s."),
        numero("Erros do servidor (5xx)", (12, 1, 4, 5), [prom(TAXA_5XX)], unidade="percent",
               decimais=2, limiares=niveis(1, 5), grafico=True,
               descricao="Respostas 5xx sobre o total, nos últimos 5 minutos."),
        numero("Requisições por minuto", (16, 1, 4, 5),
               [prom("sum(rate(maishoras_http_requisicoes_total[5m])) * 60")],
               unidade="suffix: /min", decimais=0, grafico=True),
        numero("Alertas disparados", (20, 1, 4, 5),
               [prom('count(ALERTS{alertstate="firing"}) or vector(0)')],
               limiares=niveis(1, None), decimais=0),
        numero("Logins com sucesso (24 h)", (0, 6, 4, 4),
               [prom(evento("sessao.iniciada", "24h"))], decimais=0, limiares=fixo(VERDE)),
        numero("Logins recusados (24 h)", (4, 6, 4, 4),
               [prom(evento("sessao.falha", "24h"))], decimais=0,
               limiares=niveis(50, 200)),
        numero("Bloqueios por força bruta (24 h)", (8, 6, 4, 4),
               [prom('sum(increase(maishoras_limite_excedido_total{balde="auth"}[24h])) '
                     'or vector(0)')],
               decimais=0, limiares=niveis(1, 50),
               descricao="Tentativas barradas pelo limite de 20 logins em 15 minutos por IP."),
        medidor("CPU", (12, 6, 4, 4), prom(CPU), limiares=niveis(70, 85)),
        medidor("Memória", (16, 6, 4, 4), prom(MEMORIA), limiares=niveis(80, 90)),
        medidor("Disco", (20, 6, 4, 4), prom(DISCO), limiares=niveis(80, 92)),
        ALERTAS_ATIVOS,
        serie("Respostas por tipo", (12, 10, 12, 8),
              [prom("sum by (classe) (" + POR_CLASSE.format(
                  expr="rate(maishoras_http_requisicoes_total[5m])") + ") * 60", "{{classe}}")],
              unidade="suffix: /min", empilhar=True, cores=CLASSES,
              descricao="2xx deu certo, 4xx foi pedido inválido (login errado, página "
                        "inexistente), 5xx foi falha nossa."),
        linha("Tendência", 18),
        serie("Tempo de resposta", (0, 19, 12, 8), [
            prom(P95.replace("0.95", "0.50"), "mediana"),
            prom(P95, "p95"),
            prom(P95.replace("0.95", "0.99"), "p99"),
        ], unidade="s", limiares=niveis(0.5, 1),
            cores={"mediana": VERDE, "p95": AMARELO, "p99": VERMELHO}),
        serie("Tentativas de login por minuto", (12, 19, 12, 8), [
            prom('sum(rate(maishoras_eventos_total{acao="sessao.iniciada"}[5m])) * 60',
                 "aceitas"),
            prom('sum(rate(maishoras_eventos_total{acao="sessao.falha"}[5m])) * 60',
                 "recusadas", "B"),
            prom('sum(rate(maishoras_limite_excedido_total{balde="auth"}[5m])) * 60',
                 "bloqueadas", "C"),
        ], unidade="suffix: /min",
            cores={"aceitas": VERDE, "recusadas": AMARELO, "bloqueadas": VERMELHO}),
        serie("Tempo de resposta visto de fora", (0, 27, 12, 7),
              [prom('probe_duration_seconds{job="disponibilidade"}', "{{instance}}")],
              unidade="s", descricao="Quanto a página leva para responder pela internet, "
                                     "com DNS e HTTPS incluídos."),
        numero("Certificado HTTPS vence em", (12, 27, 6, 7),
               [prom('min(probe_ssl_earliest_cert_expiry{job="disponibilidade"} - time()) / 86400')],
               unidade="suffix: dias", decimais=0, limiares=niveis(14, 7, invertido=True)),
        numero("Conexões no banco", (18, 27, 6, 7),
               [prom('sum(pg_stat_activity_count{datname="mais_horas"})')],
               decimais=0, limiares=niveis(60, 85), grafico=True,
               descricao="Conexões abertas no Postgres do Mais Horas (limite padrão: 100)."),
    ], etiquetas=("inicio",))


def api() -> dict:
    por_rota = ('sum by (metodo, rota) (increase(maishoras_http_requisicoes_total'
                '{rota!="nao_encontrada"}[$__range])) > 0')
    p95_rota = ('histogram_quantile(0.95, sum by (le, metodo, rota) '
                '(increase(maishoras_http_duracao_segundos_bucket{rota!="nao_encontrada"}'
                '[$__range])))')
    # Rota sem erro nenhum não tem a série; o `or (... * 0)` faz ela valer 0%.
    erro_rota = ('(sum by (metodo, rota) (increase(maishoras_http_requisicoes_total'
                 '{{status=~"{faixa}", rota!="nao_encontrada"}}[$__range])) '
                 'or (' + por_rota.replace("{", "{{").replace("}", "}}") + ') * 0) / ('
                 + por_rota.replace("{", "{{").replace("}", "}}") + ')')
    return painel("api", "API: desempenho e erros",
                  "Cada rota da API: quanto é chamada, quanto demora e quanto falha.", [
        numero("Requisições por segundo", (0, 0, 4, 5),
               [prom("sum(rate(maishoras_http_requisicoes_total[5m]))")], unidade="reqps",
               decimais=2, grafico=True),
        numero("p95", (4, 0, 4, 5), [prom(P95)], unidade="s", limiares=niveis(0.5, 1)),
        numero("p99", (8, 0, 4, 5), [prom(P95.replace("0.95", "0.99"))], unidade="s",
               limiares=niveis(1, 2.5)),
        numero("Erros 5xx", (12, 0, 4, 5), [prom(TAXA_5XX)], unidade="percent", decimais=2,
               limiares=niveis(1, 5)),
        numero("Respostas 4xx", (16, 0, 4, 5), [prom(
            '(sum(rate(maishoras_http_requisicoes_total{status=~"4.."}[5m])) '
            '/ clamp_min(sum(rate(maishoras_http_requisicoes_total[5m])), 1e-9)) * 100 '
            'or vector(0)')], unidade="percent", decimais=1, limiares=niveis(15, 30),
               descricao="Login errado, página inexistente, sessão vencida. Normal em "
                         "pequena quantidade; muito alto indica robô ou tela quebrada."),
        numero("Sendo atendidas agora", (20, 0, 4, 5),
               [prom("sum(maishoras_http_em_andamento)")], decimais=0,
               limiares=niveis(10, 30), grafico=True),
        serie("Requisições por rota (10 mais chamadas)", (0, 5, 12, 9),
              [prom('topk(10, sum by (rota) (rate(maishoras_http_requisicoes_total'
                    '{rota!="nao_encontrada"}[5m]))) * 60', "{{rota}}")],
              unidade="suffix: /min"),
        serie("p95 por rota (10 mais lentas)", (12, 5, 12, 9),
              [prom('topk(10, histogram_quantile(0.95, sum by (le, rota) '
                    '(rate(maishoras_http_duracao_segundos_bucket[5m]))))', "{{rota}}")],
              unidade="s", limiares=niveis(0.5, 1)),
        tabela("Rotas no período", (0, 14, 24, 11), [
            prom(por_rota, ref="A", instantanea=True, tabela=True),
            prom(p95_rota, ref="B", instantanea=True, tabela=True),
            prom(erro_rota.format(faixa="5.."), ref="C", instantanea=True, tabela=True),
            prom(erro_rota.format(faixa="4.."), ref="D", instantanea=True, tabela=True),
        ], descricao="Do intervalo escolhido no topo. Ordenada pela rota mais lenta.",
            transformacoes=[
                {"id": "merge", "options": {}},
                organizar({"metodo": "Método", "rota": "Rota", "Value #A": "Requisições",
                           "Value #B": "p95", "Value #C": "Erros 5xx",
                           "Value #D": "Respostas 4xx"}, esconder=["Time"],
                          ordem=["metodo", "rota", "Value #A", "Value #B", "Value #C",
                                 "Value #D"]),
            ],
            colunas={"Requisições": {"decimais": 0}, "p95": {
                "unidade": "s", "niveis": niveis(0.5, 1, base="transparent")},
                "Erros 5xx": {"unidade": "percentunit", "decimais": 1,
                              "niveis": niveis(0.01, 0.05, base="transparent")},
                "Respostas 4xx": {"unidade": "percentunit", "decimais": 1},
                "Método": {"largura": 90}},
            ordenar=("p95", True)),
        serie("Respostas por status", (0, 25, 12, 8),
              [prom("sum by (status) (rate(maishoras_http_requisicoes_total[5m])) * 60",
                    "{{status}}")], unidade="suffix: /min", empilhar=True),
        serie("Erros 5xx por rota", (12, 25, 12, 8),
              [prom('sum by (rota) (rate(maishoras_http_requisicoes_total{status=~"5.."}'
                    '[5m])) * 60', "{{rota}}")], unidade="suffix: /min",
              descricao="Vazio é bom sinal."),
        serie("Memória do processo da API", (0, 33, 8, 7),
              [prom('process_resident_memory_bytes{job="api"}', "memória residente")],
              unidade="bytes"),
        serie("CPU do processo da API", (8, 33, 8, 7),
              [prom('rate(process_cpu_seconds_total{job="api"}[5m]) * 100', "CPU")],
              unidade="percent"),
        serie("Conexões da API com o banco", (16, 33, 8, 7),
              [prom("maishoras_banco_conexoes", "{{estado}}")], empilhar=True,
              cores={"em_uso": AMARELO, "livres": VERDE},
              descricao="Pool do SQLAlchemy. Todas em uso por muito tempo = fila no banco."),
    ], etiquetas=("api",))


def seguranca() -> dict:
    return painel("seguranca", "Segurança e acessos",
                  "Logins, força bruta, sessões roubadas, QR e certificados. Os números "
                  "seguem o intervalo escolhido no topo.", [
        numero("Logins aceitos", (0, 0, 3, 4), [prom(evento("sessao.iniciada"))],
               decimais=0, limiares=fixo(VERDE)),
        numero("Logins recusados", (3, 0, 3, 4), [prom(evento("sessao.falha"))],
               decimais=0, limiares=niveis(50, 200)),
        numero("Taxa de recusa", (6, 0, 3, 4), [prom(
            "(" + evento("sessao.falha").replace(" or vector(0)", "") + ") / clamp_min("
            + evento("sessao.falha").replace(" or vector(0)", "") + " + "
            + evento("sessao.iniciada").replace(" or vector(0)", "") + ", 1) * 100 "
            "or vector(0)")], unidade="percent", decimais=1, limiares=niveis(20, 50),
               descricao="Recusados sobre o total de tentativas. Erro de digitação fica "
                         "abaixo de 20%; acima disso, alguém está chutando senha."),
        numero("Bloqueios", (9, 0, 3, 4),
               [prom('sum(increase(maishoras_limite_excedido_total{balde="auth"}[$__range])) '
                     'or vector(0)')], decimais=0, limiares=niveis(1, 50),
               descricao="Barrados pelo limite de 20 tentativas em 15 minutos por IP."),
        numero("Sessão roubada", (12, 0, 3, 4),
               [prom(evento("sessao.reuso_detectado"))], decimais=0,
               limiares=niveis(None, 1),
               descricao="Refresh token reapresentado depois de usado: a família de "
                         "sessões foi revogada."),
        numero("QR inválido", (15, 0, 3, 4),
               [prom(evento("checkin.token_invalido"))], decimais=0, limiares=niveis(5, 20),
               descricao="Código vencido ou de outra atividade. Típico de print do QR."),
        numero("Varredura", (18, 0, 3, 4),
               [prom('sum(increase(maishoras_limite_excedido_total{balde="verificacao"}'
                     '[$__range])) or vector(0)')], decimais=0, limiares=niveis(1, 100),
               descricao="Bloqueios por excesso de verificações de certificado (60 por "
                         "minuto por IP): alguém tentando adivinhar códigos."),
        numero("Contas criadas", (21, 0, 3, 4), [prom(evento("conta.criada"))], decimais=0),
        serie("Tentativas de login por minuto", (0, 4, 12, 8), [
            prom('sum(rate(maishoras_eventos_total{acao="sessao.iniciada"}[5m])) * 60',
                 "aceitas"),
            prom('sum(rate(maishoras_eventos_total{acao="sessao.falha"}[5m])) * 60',
                 "recusadas", "B"),
            prom('sum(rate(maishoras_limite_excedido_total{balde="auth"}[5m])) * 60',
                 "bloqueadas", "C"),
        ], unidade="suffix: /min",
            cores={"aceitas": VERDE, "recusadas": AMARELO, "bloqueadas": VERMELHO}),
        serie("Bloqueios e eventos de risco", (12, 4, 12, 8), [
            prom('sum(rate(maishoras_limite_excedido_total{balde="verificacao"}[5m])) * 60',
                 "varredura de certificados"),
            prom('sum(rate(maishoras_eventos_total{acao="checkin.token_invalido"}[5m])) * 60',
                 "QR inválido", "B"),
            prom('sum(rate(maishoras_eventos_total{acao="sessao.reuso_detectado"}[5m])) * 60',
                 "sessão roubada", "C"),
        ], unidade="suffix: /min", cores={"sessão roubada": VERMELHO,
                                          "varredura de certificados": ROXO,
                                          "QR inválido": AMARELO}),
        tabela("IPs com mais logins recusados", (0, 12, 12, 9), [sql("""
            SELECT host(ip) AS "IP", count(*) AS "Recusas",
                   count(DISTINCT entidade_id) AS "Contas visadas",
                   max(ocorrido_em) AS "Última", max(user_agent) AS "Navegador"
            FROM registros_auditoria
            WHERE acao = 'sessao.falha' AND $__timeFilter(ocorrido_em)
            GROUP BY ip ORDER BY 2 DESC LIMIT 15""")], fonte=BANCO,
            descricao="Da trilha de auditoria. Muitas recusas de um IP só = força bruta; "
                      "muitas contas visadas = lista de e-mails sendo testada.",
            colunas={"Recusas": {"largura": 90, "niveis": niveis(10, 20, base="transparent")},
                     "Contas visadas": {"largura": 120}, "IP": {"largura": 140}},
            vazio="Nenhum login recusado no período"),
        tabela("Contas mais visadas", (12, 12, 12, 9), [sql("""
            SELECT COALESCE(u.email, 'e-mail não cadastrado') AS "Conta",
                   count(*) AS "Recusas", count(DISTINCT r.ip) AS "IPs diferentes",
                   max(r.ocorrido_em) AS "Última"
            FROM registros_auditoria r
            LEFT JOIN usuarios u ON u.id = r.entidade_id
            WHERE r.acao = 'sessao.falha' AND $__timeFilter(r.ocorrido_em)
            GROUP BY 1 ORDER BY 2 DESC LIMIT 15""")], fonte=BANCO,
            colunas={"Recusas": {"largura": 90, "niveis": niveis(10, 20, base="transparent")}}),
        tabela("Últimas tentativas recusadas", (0, 21, 14, 10), [sql("""
            SELECT r.ocorrido_em AS "Quando", host(r.ip) AS "IP",
                   COALESCE(u.email, 'e-mail não cadastrado') AS "Conta",
                   CASE r.depois->>'motivo' WHEN 'credenciais' THEN 'senha ou e-mail errado'
                        WHEN 'suspensa' THEN 'conta suspensa'
                        ELSE r.depois->>'motivo' END AS "Motivo",
                   r.user_agent AS "Navegador"
            FROM registros_auditoria r
            LEFT JOIN usuarios u ON u.id = r.entidade_id
            WHERE r.acao = 'sessao.falha' AND $__timeFilter(r.ocorrido_em)
            ORDER BY r.ocorrido_em DESC LIMIT 100""")], fonte=BANCO,
            colunas={"Quando": {"largura": 170}, "IP": {"largura": 130}}),
        tabela("Eventos sensíveis na trilha", (14, 21, 10, 10), [sql("""
            SELECT ocorrido_em AS "Quando",
                   CASE acao WHEN 'sessao.reuso_detectado' THEN 'sessão roubada detectada'
                        WHEN 'sessoes.revogadas' THEN 'sessões revogadas'
                        WHEN 'conta.suspensa' THEN 'conta suspensa'
                        WHEN 'admin.entrou_como' THEN 'admin entrou como'
                        WHEN 'integridade.verificada' THEN 'certificado adulterado'
                        WHEN 'checkin.token_invalido' THEN 'QR inválido'
                        WHEN 'senha.redefinicao_disparada' THEN 'pedido de nova senha'
                        ELSE acao END AS "Evento",
                   host(ip) AS "IP"
            FROM registros_auditoria
            WHERE acao IN ('sessao.reuso_detectado', 'sessoes.revogadas', 'conta.suspensa',
                           'admin.entrou_como', 'integridade.verificada',
                           'checkin.token_invalido', 'senha.redefinicao_disparada')
              AND $__timeFilter(ocorrido_em)
            ORDER BY ocorrido_em DESC LIMIT 100""")], fonte=BANCO,
            colunas={"Quando": {"largura": 170}}, vazio="Nenhum evento sensível no período"),
        serie("Verificações públicas de certificado", (0, 31, 12, 8),
              [prom("sum by (desfecho) (rate(maishoras_certificado_verificacoes_total[5m])) * 60",
                    "{{desfecho}}")], unidade="suffix: /min", empilhar=True,
              cores={"valido": VERDE, "inexistente": AZUL, "revogado": AMARELO,
                     "adulterado": VERMELHO}),
        serie("Check-in", (12, 31, 12, 8), [
            prom('sum(increase(maishoras_eventos_total{acao="checkin.registrado"}[15m]))',
                 "registrados"),
            prom('sum(increase(maishoras_eventos_total{acao="checkin.token_invalido"}[15m]))',
                 "QR inválido", "B"),
        ], unidade="suffix: /15 min", barras=True,
            cores={"registrados": VERDE, "QR inválido": AMARELO}),
    ], etiquetas=("seguranca",))


def banco() -> dict:
    db = 'datname="mais_horas"'
    return painel("banco", "Banco de dados",
                  "Postgres do Mais Horas: carga, cache, travas e as consultas que mais "
                  "pesam.", [
        numero("Banco no ar", (0, 0, 4, 4), [prom("pg_up")],
               mapeamentos=mapa(("1", "No ar", VERDE), ("0", "Fora", VERMELHO))),
        numero("Conexões", (4, 0, 4, 4), [prom(f"sum(pg_stat_activity_count{{{db}}})")],
               decimais=0, limiares=niveis(60, 85), grafico=True),
        numero("Transações por segundo", (8, 0, 4, 4), [prom(
            f"sum(rate(pg_stat_database_xact_commit{{{db}}}[5m]) "
            f"+ rate(pg_stat_database_xact_rollback{{{db}}}[5m]))")], decimais=1,
               grafico=True),
        numero("Leituras do cache", (12, 0, 4, 4), [prom(
            f"sum(rate(pg_stat_database_blks_hit{{{db}}}[15m])) / clamp_min("
            f"sum(rate(pg_stat_database_blks_hit{{{db}}}[15m])) "
            f"+ sum(rate(pg_stat_database_blks_read{{{db}}}[15m])), 1e-9) * 100")],
               unidade="percent", decimais=1, limiares=niveis(95, 90, invertido=True),
               descricao="Quanto das leituras não precisou ir ao disco. Abaixo de 90% é "
                         "sinal de memória curta ou consulta varrendo tabela."),
        numero("Tamanho do banco", (16, 0, 4, 4),
               [prom(f"pg_database_size_bytes{{{db}}}")], unidade="bytes", decimais=1),
        numero("Transação mais longa", (20, 0, 4, 4),
               [prom(f'max(pg_stat_activity_max_tx_duration{{{db}}}) or vector(0)')],
               unidade="s", decimais=1, limiares=niveis(30, 300),
               descricao="Transação aberta há muito tempo segura travas e impede a limpeza."),
        serie("Conexões por estado", (0, 4, 12, 8),
              [prom(f"sum by (state) (pg_stat_activity_count{{{db}}}) > 0", "{{state}}")],
              empilhar=True, cores={"active": AMARELO, "idle": VERDE},
              descricao="active: executando agora. idle: aberta, esperando. idle in "
                        "transaction por muito tempo segura travas."),
        serie("Transações por segundo", (12, 4, 12, 8), [
            prom(f"rate(pg_stat_database_xact_commit{{{db}}}[5m])", "confirmadas"),
            prom(f"rate(pg_stat_database_xact_rollback{{{db}}}[5m])", "desfeitas", "B"),
        ], cores={"confirmadas": VERDE, "desfeitas": AMARELO},
            descricao="Toda leitura da API termina em rollback (a sessão fecha sem "
                      "commit), então 'desfeitas' acima de 'confirmadas' é o normal. O que "
                      "merece atenção é um salto repentino."),
        serie("Linhas por segundo", (0, 12, 12, 8), [
            prom(f"rate(pg_stat_database_tup_fetched{{{db}}}[5m])", "lidas"),
            prom(f"rate(pg_stat_database_tup_inserted{{{db}}}[5m])", "inseridas", "B"),
            prom(f"rate(pg_stat_database_tup_updated{{{db}}}[5m])", "atualizadas", "C"),
            prom(f"rate(pg_stat_database_tup_deleted{{{db}}}[5m])", "apagadas", "D"),
        ]),
        serie("Travas por tipo", (12, 12, 12, 8),
              [prom(f"pg_locks_count{{{db}}} > 0", "{{mode}}")], empilhar=True,
              descricao="Travas abertas agora. A inscrição trava a linha da atividade de "
                        "propósito (contagem de vagas), então RowShare e RowExclusive "
                        "aparecem em uso normal."),
        tabela("Consultas que mais consomem tempo", (0, 20, 24, 10), [sql("""
            SELECT left(regexp_replace(s.query, '\\s+', ' ', 'g'), 160) AS "Consulta",
                   s.calls AS "Chamadas",
                   round(s.total_exec_time::numeric, 1) AS "Tempo total (ms)",
                   round(s.mean_exec_time::numeric, 2) AS "Média (ms)",
                   round(s.max_exec_time::numeric, 1) AS "Pior (ms)",
                   s.rows AS "Linhas"
            FROM pg_stat_statements s
            JOIN pg_database d ON d.oid = s.dbid
            WHERE d.datname = 'mais_horas'
              AND pg_get_userbyid(s.userid) NOT IN ('monitoramento', 'painel')
              AND s.query !~* '^\\s*(create|alter|grant|revoke|comment|set|show|vacuum)'
            ORDER BY s.total_exec_time DESC LIMIT 15""")], fonte=BANCO,
            descricao="Acumulado desde o último reinício do banco (pg_stat_statements). "
                       "Média alta = consulta lenta; tempo total alto = consulta frequente.",
            colunas={"Média (ms)": {"largura": 110, "decimais": 2,
                                    "niveis": niveis(50, 200, base="transparent")},
                     "Chamadas": {"largura": 100},
                     "Tempo total (ms)": {"largura": 140, "decimais": 0},
                     "Pior (ms)": {"largura": 100, "decimais": 1}, "Linhas": {"largura": 90}}),
        tabela("Tabelas", (0, 30, 24, 9), [sql("""
            SELECT relname AS "Tabela", n_live_tup AS "Linhas",
                   pg_total_relation_size(relid) AS "Tamanho",
                   seq_scan AS "Varreduras completas", idx_scan AS "Buscas por índice",
                   n_dead_tup AS "Linhas mortas", last_autovacuum AS "Último autovacuum"
            FROM pg_stat_user_tables
            ORDER BY pg_total_relation_size(relid) DESC""")], fonte=BANCO,
            descricao="Varredura completa em tabela grande é o primeiro suspeito de lentidão.",
            colunas={"Tamanho": {"unidade": "bytes", "largura": 110}},
            vazio="ainda não rodou"),
    ], etiquetas=("banco",))


def servidor() -> dict:
    container = 'name=~"mais-horas.*|citinova.*"'
    return painel("servidor", "Servidor e containers",
                  "A máquina virtual e cada container que roda nela.", [
        medidor("CPU", (0, 0, 4, 5), prom(CPU), limiares=niveis(70, 85)),
        medidor("Memória", (4, 0, 4, 5), prom(MEMORIA), limiares=niveis(80, 90)),
        medidor("Disco", (8, 0, 4, 5), prom(DISCO), limiares=niveis(80, 92)),
        medidor("Swap", (12, 0, 4, 5), prom(
            "(1 - node_memory_SwapFree_bytes / clamp_min(node_memory_SwapTotal_bytes, 1)) * 100"),
                limiares=niveis(30, 70)),
        numero("Carga (1 min)", (16, 0, 4, 5), [prom("node_load1")], decimais=2,
               limiares=niveis(2, 4), grafico=True,
               descricao="Processos querendo CPU. Com 2 núcleos, acima de 2 já há fila."),
        numero("Ligada há", (20, 0, 4, 5), [prom("time() - node_boot_time_seconds")],
               unidade="s", decimais=0),
        serie("CPU por tipo de uso", (0, 5, 12, 8), [prom(
            'sum by (mode) (rate(node_cpu_seconds_total{mode=~"user|system|iowait|steal"}[5m])) '
            '/ scalar(count(node_cpu_seconds_total{mode="idle"})) * 100', "{{mode}}")],
              unidade="percent", empilhar=True,
              descricao="iowait alto = esperando disco; steal alto = a Azure está "
                        "dividindo a CPU com outras máquinas."),
        serie("Memória", (12, 5, 12, 8), [
            prom("node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes", "em uso"),
            prom("node_memory_Cached_bytes + node_memory_Buffers_bytes", "cache do sistema", "B"),
            prom("node_memory_MemAvailable_bytes", "disponível", "C"),
        ], unidade="bytes", cores={"em uso": AMARELO, "disponível": VERDE}),
        serie("Disco: leitura e escrita", (0, 13, 12, 8), [
            prom('sum(rate(node_disk_read_bytes_total{device!~"loop.*"}[5m]))', "leitura"),
            prom('sum(rate(node_disk_written_bytes_total{device!~"loop.*"}[5m]))', "escrita", "B"),
        ], unidade="Bps"),
        serie("Rede", (12, 13, 12, 8), [
            prom('sum(rate(node_network_receive_bytes_total{device!~"lo|veth.*|br-.*|docker.*"}[5m]))',
                 "recebido"),
            prom('sum(rate(node_network_transmit_bytes_total{device!~"lo|veth.*|br-.*|docker.*"}[5m]))',
                 "enviado", "B"),
        ], unidade="Bps"),
        serie("CPU por container", (0, 21, 12, 9), [prom(
            f"sum by (name) (rate(container_cpu_usage_seconds_total{{{container}}}[5m])) * 100",
            "{{name}}")], unidade="percent",
              descricao="100% = um núcleo inteiro."),
        serie("Memória por container", (12, 21, 12, 9), [prom(
            f"sum by (name) (container_memory_working_set_bytes{{{container}}})", "{{name}}")],
              unidade="bytes"),
    ], etiquetas=("servidor",))


def uso() -> dict:
    return painel("uso", "Uso da plataforma",
                  "O que as pessoas estão fazendo no Mais Horas, direto do banco.", [
        numero("Estudantes", (0, 0, 4, 4), [sql(
            "SELECT count(*) FROM usuarios WHERE papel = 'estudante' AND situacao = 'ativa'")],
               fonte=BANCO, decimais=0),
        numero("ONGs", (4, 0, 4, 4), [sql(
            "SELECT count(*) FROM usuarios WHERE papel = 'ong' AND situacao = 'ativa'")],
               fonte=BANCO, decimais=0),
        numero("Vagas abertas", (8, 0, 4, 4), [sql(
            "SELECT count(*) FROM atividades WHERE situacao = 'publicada' "
            "AND data >= current_date")], fonte=BANCO, decimais=0),
        numero("Inscrições ativas", (12, 0, 4, 4), [sql(
            "SELECT count(*) FROM inscricoes i JOIN atividades a ON a.id = i.atividade_id "
            "WHERE i.situacao IN ('pendente', 'confirmada') AND a.data >= current_date")],
               fonte=BANCO, decimais=0),
        numero("Certificados emitidos", (16, 0, 4, 4), [sql(
            "SELECT count(*) FROM certificados WHERE revogado_em IS NULL")],
               fonte=BANCO, decimais=0, limiares=fixo(VERDE)),
        numero("Horas certificadas", (20, 0, 4, 4), [sql(
            "SELECT COALESCE(sum(horas), 0) FROM certificados WHERE revogado_em IS NULL")],
               fonte=BANCO, decimais=0, unidade="suffix: h", limiares=fixo(AMARELO)),
        serie("Contas novas por dia", (0, 4, 12, 8), [sql("""
            SELECT $__timeGroupAlias(criado_em, '1d'),
                   CASE papel WHEN 'estudante' THEN 'estudantes' WHEN 'ong' THEN 'ONGs'
                        ELSE papel END AS metric, count(*) AS valor
            FROM usuarios WHERE $__timeFilter(criado_em)
            GROUP BY 1, 2 ORDER BY 1""", serie=True)], fonte=BANCO, barras=True,
              empilhar=True, cores={"estudantes": AZUL, "ONGs": ROXO}),
        serie("Inscrições por dia", (12, 4, 12, 8), [sql("""
            SELECT $__timeGroupAlias(criado_em, '1d'), count(*) AS "inscrições"
            FROM inscricoes WHERE $__timeFilter(criado_em)
            GROUP BY 1 ORDER BY 1""", serie=True)], fonte=BANCO, barras=True),
        serie("Check-ins por hora", (0, 12, 12, 8), [sql("""
            SELECT $__timeGroupAlias(checkin_em, '1h'),
                   CASE checkin_origem WHEN 'qr' THEN 'pelo QR' ELSE 'manual' END AS metric,
                   count(*) AS valor
            FROM inscricoes WHERE checkin_em IS NOT NULL AND $__timeFilter(checkin_em)
            GROUP BY 1, 2 ORDER BY 1""", serie=True)], fonte=BANCO, barras=True,
              empilhar=True, cores={"pelo QR": VERDE, "manual": AZUL}),
        serie("Certificados emitidos por dia", (12, 12, 12, 8), [sql("""
            SELECT $__timeGroupAlias(emitido_em, '1d'), count(*) AS "certificados",
                   sum(horas) AS "horas"
            FROM certificados WHERE $__timeFilter(emitido_em)
            GROUP BY 1 ORDER BY 1""", serie=True)], fonte=BANCO, barras=True,
              cores={"certificados": VERDE, "horas": AMARELO}),
        tabela("Atividades com mais procura", (0, 20, 14, 9), [sql("""
            SELECT a.titulo AS "Atividade", o.nome AS "ONG", a.data AS "Data",
                   count(i.id) FILTER (WHERE i.situacao IN ('pendente', 'confirmada',
                                                            'presente', 'ausente'))
                       AS "Inscritos",
                   a.vagas_max AS "Vagas"
            FROM atividades a
            JOIN usuarios o ON o.id = a.ong_id
            LEFT JOIN inscricoes i ON i.atividade_id = a.id
            WHERE a.situacao <> 'rascunho' AND a.data >= current_date - 30
            GROUP BY a.id, o.nome ORDER BY 4 DESC, a.data LIMIT 15""")], fonte=BANCO,
            colunas={"Data": {"largura": 110}, "Inscritos": {"largura": 90},
                     "Vagas": {"largura": 80}}),
        serie("Ações por minuto (trilha de auditoria)", (14, 20, 10, 9), [prom(
            'topk(8, sum by (acao) (rate(maishoras_eventos_total[5m]))) * 60', "{{acao}}")],
              unidade="suffix: /min"),
    ], etiquetas=("uso",), desde="now-7d")


def main() -> None:
    PASTA.mkdir(exist_ok=True)
    for gerar in (visao_geral, api, seguranca, banco, servidor, uso):
        dados = gerar()
        destino = PASTA / f"{dados['uid']}.json"
        destino.write_text(json.dumps(dados, ensure_ascii=False, indent=2) + "\n",
                           encoding="utf-8")
        print(f"{destino.name}: {len(dados['panels'])} painéis")


if __name__ == "__main__":
    main()

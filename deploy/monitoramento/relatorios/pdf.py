"""
Montagem do PDF do relatório (reportlab, a mesma biblioteca do certificado).

A página abre pela resposta: a situação geral, com o pior nível encontrado.
Depois vêm os indicadores com o comparativo, os gráficos (o período anterior
tracejado por baixo do atual) e o detalhe de segurança, rotas e banco.
"""

from __future__ import annotations

from datetime import datetime
from io import BytesIO
from zoneinfo import ZoneInfo

from reportlab.graphics.charts.legends import LineLegend
from reportlab.graphics.charts.lineplots import LinePlot
from reportlab.graphics.shapes import Drawing, String
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

from consultas import Dados
from indicadores import ATENCAO, CRITICO, NEUTRO, OK, ORDEM

FUSO = ZoneInfo("America/Fortaleza")

NOITE = colors.HexColor("#0b1a4d")
ROYAL = colors.HexColor("#1839b0")
CLARO = colors.HexColor("#edf1fc")
LINHA = colors.HexColor("#d3dcf3")
TINTA = colors.HexColor("#1b2540")
APAGADO = colors.HexColor("#5c6882")
COR_NIVEL = {OK: colors.HexColor("#2b8a3e"), ATENCAO: colors.HexColor("#d9480f"),
             CRITICO: colors.HexColor("#c92a2a"), NEUTRO: colors.HexColor("#5c6882")}

LARGURA = A4[0] - 36 * mm

AREAS = {"disponibilidade": "Disponibilidade", "desempenho": "Desempenho",
         "seguranca": "Segurança", "banco": "Banco", "servidor": "Servidor"}

_texto = ParagraphStyle("texto", fontName="Helvetica", fontSize=9.5, leading=13.5,
                        textColor=TINTA)
_miudo = ParagraphStyle("miudo", parent=_texto, fontSize=8, leading=11, textColor=APAGADO)
_nota = ParagraphStyle("nota", parent=_miudo, keepWithNext=1)
_titulo = ParagraphStyle("titulo", fontName="Helvetica-Bold", fontSize=21, leading=25,
                         textColor=NOITE)
# keepWithNext: título de seção nunca fica sozinho no pé da página.
_secao = ParagraphStyle("secao", fontName="Helvetica-Bold", fontSize=13, leading=17,
                        textColor=NOITE, spaceBefore=14, spaceAfter=6, keepWithNext=1)
_celula = ParagraphStyle("celula", parent=_texto, fontSize=8.5, leading=11,
                         alignment=TA_LEFT)


# ===================== Formatação =====================


def _num(valor: float, casas: int = 0) -> str:
    texto = f"{valor:,.{casas}f}"
    return texto.replace(",", "§").replace(".", ",").replace("§", ".")


def valor(v: float | None, unidade: str) -> str:
    if v is None:
        return "sem dado"
    if unidade == "%":
        return f"{_num(v, 2 if v >= 99 else 1)}%"
    if unidade == "s":
        return f"{_num(v * 1000)} ms" if v < 1 else f"{_num(v, 2)} s"
    return _num(v)


def variacao(atual: float | None, anterior: float | None, unidade: str) -> str:
    if atual is None or anterior is None:
        return "sem dado"
    if unidade == "%":
        diferenca = atual - anterior
        return "igual" if abs(diferenca) < 0.05 else f"{'+' if diferenca > 0 else ''}{_num(diferenca, 1)} p.p."
    if anterior == 0:
        return "igual" if atual == 0 else "novo"
    relativa = (atual - anterior) / anterior * 100
    return "igual" if abs(relativa) < 0.5 else f"{'+' if relativa > 0 else ''}{_num(relativa)}%"


def _quando(momento: datetime, formato: str = "%d/%m/%Y %H:%M") -> str:
    return momento.astimezone(FUSO).strftime(formato)


# ===================== Peças =====================


def _tabela(linhas: list[list], larguras: list[float], *, niveis: dict[int, str] | None = None,
            alinhar_direita: tuple[int, ...] = ()) -> Table:
    tabela = Table(linhas, colWidths=larguras, repeatRows=1)
    estilo = [
        ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 8.5),
        ("FONT", (0, 1), (-1, -1), "Helvetica", 8.5),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("BACKGROUND", (0, 0), (-1, 0), NOITE),
        ("TEXTCOLOR", (0, 1), (-1, -1), TINTA),
        ("LINEBELOW", (0, 1), (-1, -1), 0.5, LINHA),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]
    for coluna in alinhar_direita:
        estilo.append(("ALIGN", (coluna, 0), (coluna, -1), "RIGHT"))
    for linha, nivel in (niveis or {}).items():
        estilo += [("BACKGROUND", (-1, linha), (-1, linha), COR_NIVEL[nivel]),
                   ("TEXTCOLOR", (-1, linha), (-1, linha), colors.white),
                   ("FONT", (-1, linha), (-1, linha), "Helvetica-Bold", 8.5),
                   ("ALIGN", (-1, linha), (-1, linha), "CENTER")]
    tabela.setStyle(TableStyle(estilo))
    return tabela


def _grafico(titulo: str, series: list[tuple[str, list, colors.Color, bool]],
             inicio: datetime, fim: datetime, unidade: str, formato_hora: str) -> Drawing:
    """Linhas no tempo; a série tracejada é o período anterior, deslocado."""
    largura, altura = LARGURA, 165
    desenho = Drawing(largura, altura)
    desenho.add(String(0, altura - 12, titulo, fontName="Helvetica-Bold", fontSize=9.5,
                       fillColor=NOITE))
    com_dado = [s for s in series if s[1]]
    if not com_dado:
        desenho.add(String(0, altura / 2, "Sem dado neste período.", fontName="Helvetica",
                           fontSize=9, fillColor=APAGADO))
        return desenho

    grafico = LinePlot()
    grafico.x, grafico.y = 38, 22
    grafico.width, grafico.height = largura - 50, altura - 58
    grafico.data = [s[1] for s in com_dado]
    for i, (_, _, cor, tracejado) in enumerate(com_dado):
        grafico.lines[i].strokeColor = cor
        grafico.lines[i].strokeWidth = 1.1 if tracejado else 1.6
        if tracejado:
            grafico.lines[i].strokeDashArray = (3, 2)

    t0, t1 = inicio.timestamp(), fim.timestamp()
    grafico.xValueAxis.valueMin, grafico.xValueAxis.valueMax = t0, t1
    grafico.xValueAxis.valueSteps = [t0 + (t1 - t0) * k / 6 for k in range(7)]
    grafico.xValueAxis.labelTextFormat = (
        lambda t: datetime.fromtimestamp(t, FUSO).strftime(formato_hora))
    maior = max(v for s in com_dado for _, v in s[1]) or 1
    grafico.yValueAxis.valueMin, grafico.yValueAxis.valueMax = 0, maior * 1.15
    grafico.yValueAxis.labelTextFormat = lambda v: valor(v, unidade).replace(" ms", "ms")
    for eixo in (grafico.xValueAxis, grafico.yValueAxis):
        eixo.labels.fontName, eixo.labels.fontSize = "Helvetica", 7
        eixo.labels.fillColor = APAGADO
        eixo.strokeColor = LINHA
    grafico.yValueAxis.visibleGrid = True
    grafico.yValueAxis.gridStrokeColor = CLARO
    desenho.add(grafico)

    # A legenda cresce para a direita a partir de x: começa recuada o bastante
    # para a última série caber na página.
    legenda = LineLegend()
    legenda.x, legenda.y = largura - 92 * len(com_dado), altura - 8
    legenda.alignment = "right"
    legenda.columnMaximum = 1
    legenda.deltax = 92
    legenda.fontName, legenda.fontSize = "Helvetica", 7.5
    legenda.dx, legenda.dy = 12, 2
    legenda.colorNamePairs = [(cor, rotulo) for rotulo, _, cor, _ in com_dado]
    desenho.add(legenda)
    return desenho


# ===================== Documento =====================


def montar(dados: Dados, gerado_em: datetime) -> bytes:
    saida = BytesIO()
    doc = SimpleDocTemplate(saida, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                            topMargin=16 * mm, bottomMargin=16 * mm,
                            title="Relatório de saúde do Mais Horas", author="Mais Horas")
    corpo = []

    corpo.append(Paragraph("Relatório de saúde do Mais Horas", _titulo))
    corpo.append(Paragraph(
        f"{dados.rotulo}: de {_quando(dados.inicio)} a {_quando(dados.fim)}, comparado ao "
        f"período anterior de mesma duração. Gerado em {_quando(gerado_em)} "
        f"(horário de Fortaleza).", _miudo))
    corpo.append(Spacer(1, 10))

    pior = max((l.nivel for l in dados.linhas), key=ORDEM.get, default=NEUTRO)
    contagem = {n: sum(1 for l in dados.linhas if l.nivel == n) for n in (CRITICO, ATENCAO, OK)}
    def plural(n: int, um: str, varios: str) -> str:
        return f"{n} {um if n == 1 else varios}"

    if pior == CRITICO:
        frase = plural(contagem[CRITICO], "indicador em nível crítico pede",
                       "indicadores em nível crítico pedem") + " ação agora."
        if contagem[ATENCAO]:
            frase += " " + plural(contagem[ATENCAO], "outro está", "outros estão") + \
                " em atenção."
    elif pior == ATENCAO:
        frase = "Nada crítico. " + plural(contagem[ATENCAO], "indicador está",
                                          "indicadores estão") + " em atenção."
    elif pior == OK:
        frase = "Todos os indicadores dentro do esperado."
    else:
        frase = "Ainda não há dado suficiente para avaliar este período."
    caixa = Table([[Paragraph("<b>Situação geral</b>", ParagraphStyle(
        "s", parent=_texto, textColor=colors.white)), pior if pior != NEUTRO else "Sem dado"],
                   [Paragraph(frase, ParagraphStyle("f", parent=_texto,
                                                    textColor=colors.white)), ""]],
                  colWidths=[LARGURA - 45 * mm, 45 * mm])
    caixa.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), NOITE),
        ("BACKGROUND", (1, 0), (1, -1), COR_NIVEL.get(pior, APAGADO)),
        ("SPAN", (1, 0), (1, 1)),
        ("FONT", (1, 0), (1, 0), "Helvetica-Bold", 15),
        ("TEXTCOLOR", (1, 0), (1, 0), colors.white),
        ("ALIGN", (1, 0), (1, 0), "CENTER"), ("VALIGN", (1, 0), (1, 0), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10), ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    corpo.append(caixa)

    avisos = []
    if dados.cobertura_atual < 0.95:
        cobertura = dados.cobertura_atual * 100
        avisos.append(f"O monitoramento cobre {_num(cobertura, 1 if cobertura < 10 else 0)}% "
                      f"deste período: ele começou depois do início do intervalo.")
    if dados.cobertura_anterior == 0:
        avisos.append("Não há dado do período anterior, então a coluna de comparação "
                      "fica em branco.")
    elif dados.cobertura_anterior < 0.95:
        avisos.append(f"O período anterior tem só {_num(dados.cobertura_anterior * 100)}% "
                      f"de cobertura: compare com cuidado.")
    for aviso in avisos:
        corpo.append(Spacer(1, 4))
        corpo.append(Paragraph(aviso, _miudo))

    # ---- Indicadores ----
    corpo.append(Paragraph("Indicadores", _secao))
    linhas = [["Área", "Indicador", "Período atual", "Anterior", "Variação", "Nível"]]
    niveis_da_tabela = {}
    area_anterior = None
    for i, l in enumerate(dados.linhas, start=1):
        ind = l.indicador
        linhas.append([ind.area if ind.area != area_anterior else "",
                       Paragraph(ind.nome, _celula), valor(l.atual, ind.unidade),
                       valor(l.anterior, ind.unidade),
                       variacao(l.atual, l.anterior, ind.unidade), l.nivel])
        niveis_da_tabela[i] = l.nivel
        area_anterior = ind.area
    corpo.append(_tabela(linhas, [26 * mm, 58 * mm, 26 * mm, 24 * mm, 22 * mm, 18 * mm],
                         niveis=niveis_da_tabela, alinhar_direita=(2, 3, 4)))

    # ---- Gráficos ----
    formato = "%H:%M" if (dados.fim - dados.inicio).days < 2 else "%d/%m"
    s = dados.series
    corpo.append(Paragraph("Ao longo do período", _secao))
    corpo.append(Paragraph("Linha cheia: período atual. Tracejada: o período anterior, "
                           "alinhado ao mesmo intervalo para comparar.", _nota))
    graficos = [
        ("Requisições por minuto", [("atual", s["req"], ROYAL, False),
                                    ("anterior", s["req_anterior"], APAGADO, True)], "n"),
        ("Tempo de resposta (p95)", [("atual", s["p95"], COR_NIVEL[ATENCAO], False),
                                     ("anterior", s["p95_anterior"], APAGADO, True)], "s"),
        ("Logins por hora", [("aceitos", s["aceitos"], COR_NIVEL[OK], False),
                             ("recusados", s["recusados"], COR_NIVEL[CRITICO], False)], "n"),
        ("CPU e memória do servidor", [("CPU", s["cpu"], ROYAL, False),
                                       ("memória", s["mem"], COR_NIVEL[ATENCAO], False)], "%"),
    ]
    for i, (titulo, series, unidade) in enumerate(graficos):
        if i:
            corpo.append(Spacer(1, 6))
        corpo.append(_grafico(titulo, series, dados.inicio, dados.fim, unidade, formato))

    # ---- Alertas ----
    corpo.append(Paragraph("Alertas disparados no período", _secao))
    if dados.alertas:
        linhas = [["Alerta", "Área", "Tempo disparado", "Nível"]]
        niveis_alerta = {}
        for i, a in enumerate(dados.alertas, start=1):
            nivel = CRITICO if a["nivel"] == "critico" else ATENCAO
            minutos = a["minutos"]
            duracao = f"{minutos} min" if minutos < 120 else f"{_num(minutos / 60, 1)} h"
            linhas.append([Paragraph(a["titulo"], _celula), AREAS.get(a["area"], a["area"]),
                           duracao, nivel])
            niveis_alerta[i] = nivel
        corpo.append(_tabela(linhas, [92 * mm, 30 * mm, 30 * mm, 22 * mm],
                             niveis=niveis_alerta, alinhar_direita=(2,)))
    else:
        corpo.append(Paragraph("Nenhum alerta disparou neste período.", _texto))

    # ---- Segurança ----
    corpo.append(Paragraph("Segurança: de onde vieram os logins recusados", _secao))
    if dados.erro_banco:
        corpo.append(Paragraph(dados.erro_banco, _miudo))
    elif dados.ips:
        linhas = [["IP", "Recusas", "Contas visadas", "Última tentativa"]]
        for ip in dados.ips:
            linhas.append([ip["ip"], _num(ip["recusas"]), _num(ip["contas"]),
                           _quando(ip["ultima"])])
        corpo.append(_tabela(linhas, [50 * mm, 30 * mm, 34 * mm, 60 * mm],
                             alinhar_direita=(1, 2)))
        corpo.append(Spacer(1, 8))
        linhas = [["Conta visada", "Recusas", "IPs diferentes"]]
        for c in dados.contas:
            linhas.append([Paragraph(c["conta"], _celula), _num(c["recusas"]), _num(c["ips"])])
        corpo.append(_tabela(linhas, [110 * mm, 30 * mm, 34 * mm], alinhar_direita=(1, 2)))
    else:
        corpo.append(Paragraph("Nenhum login recusado neste período.", _texto))

    # ---- Rotas ----
    corpo.append(Paragraph("Rotas mais lentas da API", _secao))
    if dados.rotas:
        linhas = [["Método", "Rota", "Chamadas", "p95", "Erros 5xx"]]
        for r in dados.rotas:
            linhas.append([r["metodo"], Paragraph(r["rota"], _celula), _num(r["chamadas"]),
                           valor(r["p95"], "s"), f"{_num(r['erros'], 1)}%"])
        corpo.append(_tabela(linhas, [16 * mm, 92 * mm, 22 * mm, 22 * mm, 22 * mm],
                             alinhar_direita=(2, 3, 4)))
    else:
        corpo.append(Paragraph("Sem tráfego registrado neste período.", _texto))

    # ---- Banco ----
    if dados.consultas:
        corpo.append(Paragraph("Consultas que mais consomem o banco", _secao))
        corpo.append(Paragraph("Acumulado desde o último reinício do Postgres, não só "
                               "deste período (pg_stat_statements).", _nota))
        corpo.append(Spacer(1, 4))
        linhas = [["Consulta", "Chamadas", "Média", "Total"]]
        for c in dados.consultas:
            linhas.append([Paragraph(c["consulta"].replace("<", "&lt;"), _celula),
                           _num(c["chamadas"]), f"{_num(c['media'], 1)} ms",
                           f"{_num(c['total'] / 1000, 1)} s"])
        corpo.append(_tabela(linhas, [112 * mm, 20 * mm, 20 * mm, 22 * mm],
                             alinhar_direita=(1, 2, 3)))

    # ---- Leitura ----
    corpo.append(KeepTogether([
        Paragraph("Como ler os níveis", _secao),
        Paragraph("<b>OK</b>: dentro do esperado. <b>Atenção</b>: saiu do normal e vale "
                  "olhar hoje. <b>Crítico</b>: usuário afetado ou ataque em curso. "
                  "<b>Informativo</b>: contagem de uso, sem certo ou errado. Os limites "
                  "são os mesmos dos painéis do Grafana e dos alertas; os de contagem "
                  "(logins recusados, bloqueios, QR inválido) valem por dia e crescem "
                  "com o tamanho do período.", _texto),
    ]))

    def rodape(canvas, documento):
        canvas.saveState()
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(APAGADO)
        canvas.drawString(18 * mm, 9 * mm, "Mais Horas, relatório de saúde da aplicação")
        canvas.drawRightString(A4[0] - 18 * mm, 9 * mm, f"Página {documento.page}")
        canvas.setFillColor(ROYAL)
        canvas.rect(0, A4[1] - 5 * mm, A4[0], 5 * mm, stroke=0, fill=1)
        canvas.restoreState()

    doc.build(corpo, onFirstPage=rodape, onLaterPages=rodape)
    return saida.getvalue()

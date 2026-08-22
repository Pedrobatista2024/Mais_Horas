"""
Gera o Documento de Requisitos do Mais Horas em PDF, seguindo a ABNT.

ABNT NBR 14724: A4, margens 3-2-3-2 cm, Times New Roman 12, espaçamento 1,5,
recuo de parágrafo 1,25 cm, paginação no canto superior direito.
"""

from __future__ import annotations

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether,
)
from reportlab.platypus.tableofcontents import TableOfContents

import diagramas

F, FB, FI = "Times-Roman", "Times-Bold", "Times-Italic"
CORPO = 12
ENTRE = CORPO * 1.5
LARG_UTIL = A4[0] - 3 * cm - 2 * cm   # 16 cm

TINTA = colors.HexColor("#111111")
CINZA = colors.HexColor("#555555")
LINHA = colors.HexColor("#999999")
FUNDO = colors.HexColor("#ececec")

# ===================== Estilos =====================

def estilos():
    e = {}
    e["corpo"] = ParagraphStyle("corpo", fontName=F, fontSize=CORPO, leading=ENTRE,
                                alignment=TA_JUSTIFY, firstLineIndent=1.25 * cm,
                                spaceAfter=6, textColor=TINTA)
    e["corpo_sem_recuo"] = ParagraphStyle("csr", parent=e["corpo"], firstLineIndent=0)
    e["citacao"] = ParagraphStyle("cit", fontName=F, fontSize=10, leading=12,
                                  alignment=TA_JUSTIFY, leftIndent=4 * cm,
                                  spaceBefore=6, spaceAfter=6, textColor=TINTA)
    e["h1"] = ParagraphStyle("h1", fontName=FB, fontSize=12, leading=ENTRE,
                             spaceBefore=18, spaceAfter=12, textColor=TINTA)
    e["h2"] = ParagraphStyle("h2", fontName=FB, fontSize=12, leading=ENTRE,
                             spaceBefore=12, spaceAfter=8, textColor=TINTA)
    e["h3"] = ParagraphStyle("h3", fontName=FI, fontSize=12, leading=ENTRE,
                             spaceBefore=10, spaceAfter=6, textColor=TINTA)
    e["capa_inst"] = ParagraphStyle("ci", fontName=FB, fontSize=12, leading=18,
                                    alignment=TA_CENTER, textColor=TINTA)
    e["capa_titulo"] = ParagraphStyle("ct", fontName=FB, fontSize=16, leading=24,
                                      alignment=TA_CENTER, textColor=TINTA)
    e["capa_sub"] = ParagraphStyle("cs", fontName=F, fontSize=12, leading=18,
                                   alignment=TA_CENTER, textColor=TINTA)
    e["nota_rosto"] = ParagraphStyle("nr", fontName=F, fontSize=10, leading=12,
                                     alignment=TA_JUSTIFY, leftIndent=8 * cm,
                                     textColor=TINTA)
    e["legenda"] = ParagraphStyle("lg", fontName=F, fontSize=10, leading=12,
                                  alignment=TA_CENTER, spaceBefore=4, spaceAfter=2,
                                  textColor=TINTA)
    e["fonte_fig"] = ParagraphStyle("ff", fontName=F, fontSize=10, leading=12,
                                    alignment=TA_CENTER, spaceAfter=12, textColor=TINTA)
    e["tab"] = ParagraphStyle("tb", fontName=F, fontSize=9.5, leading=12,
                              textColor=TINTA)
    e["tab_b"] = ParagraphStyle("tbb", fontName=FB, fontSize=9.5, leading=12,
                                textColor=TINTA)
    e["ref"] = ParagraphStyle("rf", fontName=F, fontSize=CORPO, leading=CORPO,
                              alignment=TA_JUSTIFY, spaceAfter=12, textColor=TINTA)
    return e


E = estilos()


# ===================== Documento com numeração ABNT =====================

class Documento(BaseDocTemplate):
    """Paginação no canto superior direito, contada a partir da introdução."""

    def __init__(self, arquivo, **kw):
        super().__init__(arquivo, pagesize=A4,
                         leftMargin=3 * cm, rightMargin=2 * cm,
                         topMargin=3 * cm, bottomMargin=2 * cm,
                         title="Documento de Requisitos - Mais Horas",
                         author="Pedro Batista; Ismael Brandao; Antonio Yarlen",
                         subject="Projeto Integrador I", **kw)
        quadro = Frame(self.leftMargin, self.bottomMargin,
                       self.width, self.height, id="normal",
                       leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        self.addPageTemplates([
            PageTemplate(id="pre", frames=[quadro]),
            PageTemplate(id="corpo", frames=[quadro], onPage=self._numero),
        ])
        self.pagina_inicial = 0

    def _numero(self, canvas, doc):
        if not self.pagina_inicial:
            self.pagina_inicial = doc.page
        n = doc.page
        canvas.saveState()
        canvas.setFont(F, 10)
        canvas.drawRightString(A4[0] - 2 * cm, A4[1] - 2 * cm + 4, str(n))
        canvas.restoreState()

    def afterFlowable(self, flowable):
        """Alimenta o sumário automaticamente."""
        if not isinstance(flowable, Paragraph):
            return
        nome = flowable.style.name
        if nome not in ("h1", "h2", "h3"):
            return
        nivel = {"h1": 0, "h2": 1, "h3": 2}[nome]
        texto = flowable.getPlainText()
        self.notify("TOCEntry", (nivel, texto, self.page))


# ===================== Auxiliares de conteúdo =====================

def p(txt, estilo="corpo"):
    return Paragraph(txt, E[estilo])


def h1(num, txt):
    return Paragraph(f"{num} {txt.upper()}", E["h1"])


def h2(num, txt):
    return Paragraph(f"{num} {txt}", E["h2"])


def tabela(dados, larguras, cabecalho=True, tam=9.5):
    """Tabela ABNT: fechada em cima e embaixo, sem grade vertical externa."""
    corpo = []
    for i, linha in enumerate(dados):
        est = "tab_b" if (cabecalho and i == 0) else "tab"
        corpo.append([Paragraph(str(c), E[est]) for c in linha])

    t = Table(corpo, colWidths=larguras, repeatRows=1 if cabecalho else 0)
    estilo = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("LINEABOVE", (0, 0), (-1, 0), 1.0, TINTA),
        ("LINEBELOW", (0, -1), (-1, -1), 1.0, TINTA),
        ("GRID", (0, 0), (-1, -1), 0.4, LINHA),
    ]
    if cabecalho:
        estilo += [("BACKGROUND", (0, 0), (-1, 0), FUNDO),
                   ("LINEBELOW", (0, 0), (-1, 0), 0.8, TINTA)]
    t.setStyle(TableStyle(estilo))
    return t


_fig = {"n": 0}
_tab = {"n": 0}


def figura(desenho, titulo, fonte="Elaborado pelos autores (2026)."):
    _fig["n"] += 1
    largura_max = LARG_UTIL
    if desenho.width > largura_max:
        fator = largura_max / desenho.width
        desenho.scale(fator, fator)
        desenho.width *= fator
        desenho.height *= fator
    return [
        Paragraph(f"<b>Figura {_fig['n']}</b> — {titulo}", E["legenda"]),
        desenho,
        Paragraph(f"Fonte: {fonte}", E["fonte_fig"]),
    ]


def quadro(titulo, dados, larguras, fonte="Elaborado pelos autores (2026)."):
    _tab["n"] += 1
    return [
        Paragraph(f"<b>Quadro {_tab['n']}</b> — {titulo}", E["legenda"]),
        tabela(dados, larguras),
        Paragraph(f"Fonte: {fonte}", E["fonte_fig"]),
    ]

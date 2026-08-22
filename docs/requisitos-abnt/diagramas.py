"""Diagramas do documento de requisitos, desenhados com reportlab.graphics."""

from __future__ import annotations

import math

from reportlab.graphics.shapes import (
    Drawing, Rect, String, Line, Ellipse, Circle, Polygon,
)
from reportlab.lib import colors

TINTA = colors.HexColor("#1a1a1a")
CINZA = colors.HexColor("#5a5a5a")
CLARO = colors.HexColor("#eeeeee")
BORDA = colors.HexColor("#333333")

F, FB = "Times-Roman", "Times-Bold"

CAB = 17          # altura da faixa de título da caixa
LIN = 9.5         # altura de cada linha de atributo
PAD = 7


def _txt(d, x, y, s, tam=8, fonte=F, cor=TINTA, anc="middle"):
    d.add(String(x, y, s, fontName=fonte, fontSize=tam, fillColor=cor, textAnchor=anc))


def altura_caixa(linhas) -> float:
    return CAB + PAD + LIN * len(linhas)


def _caixa(d, x, y, l, titulo, linhas, tam=7.5):
    """Desenha a partir do CANTO SUPERIOR esquerdo. Altura sai do conteúdo."""
    a = altura_caixa(linhas)
    base = y - a
    d.add(Rect(x, base, l, a, fillColor=colors.white, strokeColor=BORDA, strokeWidth=0.9))
    d.add(Line(x, y - CAB, x + l, y - CAB, strokeColor=BORDA, strokeWidth=0.6))
    _txt(d, x + l / 2, y - 12, titulo, tam + 1, FB)
    yy = y - CAB - LIN
    for ln in linhas:
        _txt(d, x + 5, yy, ln, tam, F, TINTA, "start")
        yy -= LIN
    return base


def _ponta(d, x, y, ang):
    t = 5
    d.add(Polygon([x, y,
                   x - t * math.cos(ang - 0.4), y - t * math.sin(ang - 0.4),
                   x - t * math.cos(ang + 0.4), y - t * math.sin(ang + 0.4)],
                  fillColor=BORDA, strokeColor=BORDA))


def _seta(d, x1, y1, x2, y2, tracejada=False, rotulo=None, dx=0, dy=6):
    ln = Line(x1, y1, x2, y2, strokeColor=BORDA, strokeWidth=0.9)
    if tracejada:
        ln.strokeDashArray = [3, 2]
    d.add(ln)
    _ponta(d, x2, y2, math.atan2(y2 - y1, x2 - x1))
    if rotulo:
        _txt(d, (x1 + x2) / 2 + dx, (y1 + y2) / 2 + dy, rotulo, 7, F, CINZA)


def _cotovelo(d, x1, y1, xm, y2, x2, rotulo=None):
    """Conector ortogonal: sai na horizontal, desce, entra na horizontal."""
    for a, b, c, e in ((x1, y1, xm, y1), (xm, y1, xm, y2), (xm, y2, x2, y2)):
        d.add(Line(a, b, c, e, strokeColor=BORDA, strokeWidth=0.9))
    _ponta(d, x2, y2, math.atan2(0, x2 - xm))
    if rotulo:
        _txt(d, xm + (14 if xm > x2 else -14), (y1 + y2) / 2, rotulo, 7, F, CINZA)


# ===================== 1. Casos de uso =====================

def casos_de_uso() -> Drawing:
    d = Drawing(450, 430)
    L, B, LB, AB = 118, 20, 214, 392
    d.add(Rect(LB - 96, B, 224, AB, fillColor=colors.white, strokeColor=BORDA, strokeWidth=1))
    _txt(d, LB + 16, B + AB - 14, "Sistema Mais Horas", 8.5, FB)

    # Ordenados para agrupar por ator e reduzir cruzamento.
    casos = [
        (352, "Criar conta e|autenticar-se"),
        (310, "Manter perfil"),
        (268, "Inscrever-se em|atividade"),
        (226, "Registrar presença|por QR Code"),
        (184, "Publicar|atividade"),
        (142, "Aprovar ou|recusar inscrição"),
        (100, "Validar presenças e|emitir certificados"),
        (58, "Verificar|certificado"),
        (16, "Administrar e|auditar o sistema"),
    ]
    for cy, s in casos:
        d.add(Ellipse(LB + 16, cy, 100, 18, fillColor=colors.white,
                      strokeColor=BORDA, strokeWidth=0.9))
        partes = s.split("|")
        yy = cy + (4 if len(partes) > 1 else -2)
        for p in partes:
            _txt(d, LB + 16, yy, p, 7)
            yy -= 8.5

    def ator(x, y, nome):
        d.add(Circle(x, y + 24, 4.5, fillColor=colors.white, strokeColor=BORDA, strokeWidth=0.9))
        for a, b, c, e in ((x, y + 19.5, x, y + 8), (x - 7, y + 16, x + 7, y + 16),
                           (x, y + 8, x - 6, y - 1), (x, y + 8, x + 6, y - 1)):
            d.add(Line(a, b, c, e, strokeColor=BORDA, strokeWidth=0.9))
        _txt(d, x, y - 11, nome, 7.5, FB)

    ator(38, 292, "Estudante")
    ator(38, 120, "ONG")
    ator(412, 60, "Verificador")
    ator(412, 250, "Superadmin")

    for cy in (352, 310, 268, 226):                       # Estudante
        _seta(d, 52, 300, LB - 88, cy)
    for cy in (352, 310, 184, 142, 100, 226):             # ONG
        _seta(d, 52, 128, LB - 88, cy)
    _seta(d, 398, 68, LB + 122, 58)                       # Verificador
    for cy in (16, 58):                                   # Superadmin
        _seta(d, 398, 258, LB + 122, cy, tracejada=True)

    _txt(d, 225, 4, "Tracejado: acesso administrativo. O verificador atua sem "
                    "possuir conta no sistema.", 7, F, CINZA)
    return d


# ===================== 2. DER =====================

def der_principal() -> Drawing:
    d = Drawing(450, 580)

    usu = ["PK id : UUID", "nome", "email  UK", "senha_hash", "papel", "situacao"]
    b_usu = _caixa(d, 152, 575, 140, "usuarios", usu)

    est = ["PK,FK usuario_id", "nome_completo", "instituicao", "curso", "cidade, foto"]
    _caixa(d, 6, 470, 120, "perfis_estudante", est)
    ong = ["PK,FK usuario_id", "nome_organizacao", "cnpj", "descricao", "verificada_em"]
    _caixa(d, 296, 470, 120, "perfis_ong", ong)

    atv = ["PK id : UUID", "FK ong_id", "titulo, local", "data, hora_inicio/fim",
           "carga_horaria", "vagas_min / vagas_max", "exige_aprovacao", "situacao"]
    b_atv = _caixa(d, 147, 375, 150, "atividades", atv)

    ins = ["PK id : UUID", "FK atividade_id", "FK usuario_id", "situacao",
           "checkin_em", "checkin_origem", "UK (atividade, usuario)"]
    b_ins = _caixa(d, 147, 250, 150, "inscricoes", ins)

    _caixa(d, 147, 135, 150, "certificados",
           ["PK id : UUID", "FK inscricao_id  UK", "codigo_verificacao  UK",
            "horas", "assinatura", "revogado_em"])

    _seta(d, 152, b_usu + 10, 126, 458, rotulo="1:1", dx=-8, dy=10)
    _seta(d, 292, b_usu + 10, 296, 458, rotulo="1:1", dx=10, dy=10)
    _seta(d, 222, b_usu, 222, 377, rotulo="1:N", dx=14)
    _seta(d, 222, b_atv, 222, 252, rotulo="1:N", dx=14, dy=10)
    _seta(d, 222, b_ins, 222, 137, rotulo="1:1", dx=14, dy=10)
    _cotovelo(d, 292, b_usu + 24, 436, b_ins + 45, 297, rotulo="1:N")

    _txt(d, 225, 20, "Um estudante possui N inscricoes; uma inscricao gera no maximo "
                     "um certificado.".replace("inscricoes", "inscrições")
                     .replace("inscricao", "inscrição")
                     .replace("maximo", "máximo"), 7, F, CINZA)
    return d


def der_apoio() -> Drawing:
    d = Drawing(450, 230)
    _caixa(d, 165, 228, 120, "usuarios", ["PK id : UUID"])
    b = 228 - altura_caixa(["PK id : UUID"])

    tabelas = [
        (5, "tokens_sessao", ["PK id", "FK usuario_id", "token_hash UK",
                              "familia_id", "expira_em", "usado_em", "em_nome_de"]),
        (118, "tokens_redefinicao", ["PK id", "FK usuario_id", "token_hash UK",
                                     "expira_em", "usado_em", "disparado_por"]),
        (231, "notificacoes", ["PK id", "FK destinatario_id", "tipo", "titulo",
                               "mensagem, link", "lida_em"]),
        (344, "registros_auditoria", ["PK id BIGSERIAL", "ator_id", "em_nome_de_id",
                                      "acao, entidade", "antes / depois", "ip",
                                      "ocorrido_em"]),
    ]
    for x, nome, linhas in tabelas:
        _caixa(d, x, 140, 101, nome, linhas)

    for x in (55, 168, 281):
        _seta(d, 225, b, x, 142, rotulo="1:N", dy=10)
    _seta(d, 285, b + 4, 394, 142, tracejada=True, rotulo="sem FK", dy=10)

    _txt(d, 225, 6, "registros_auditoria não tem chave estrangeira: a trilha "
                    "sobrevive à remoção da conta investigada.", 7, F, CINZA)
    return d


# ===================== 3. Fluxo do processo =====================

def fluxo_processo() -> Drawing:
    d = Drawing(450, 330)
    faixas = [("ONG", 240), ("ESTUDANTE", 130), ("VERIFICADOR", 20)]
    for nome, y in faixas:
        d.add(Rect(0, y, 450, 80, fillColor=CLARO, strokeColor=CINZA, strokeWidth=0.5))
        _txt(d, 6, y + 68, nome, 7, FB, CINZA, "start")

    def passo(x, y, l, s):
        d.add(Rect(x, y, l, 32, fillColor=colors.white, strokeColor=BORDA, strokeWidth=0.9))
        partes = s.split("|")
        yy = y + 20 if len(partes) > 1 else y + 13
        for p in partes:
            _txt(d, x + l / 2, yy, p, 7)
            yy -= 8.5

    passo(14, 258, 80, "1. Publica|a atividade")
    passo(190, 258, 80, "4. Abre o painel|de check-in")
    passo(330, 258, 92, "6. Valida presenças|e finaliza")

    passo(100, 148, 80, "2. Encontra|a atividade")
    passo(100, 105, 80, "3. Inscreve-se")
    passo(190, 130, 80, "5. Faz check-in|lendo o QR")
    passo(330, 130, 92, "7. Baixa o PDF|do certificado")

    passo(330, 32, 92, "8. Escaneia o QR|e confirma na base")

    _seta(d, 94, 274, 100, 170)
    _seta(d, 140, 148, 140, 139)
    _seta(d, 180, 121, 190, 148)
    _seta(d, 230, 258, 230, 164)
    _seta(d, 270, 150, 330, 272)
    _seta(d, 376, 258, 376, 164)
    _seta(d, 376, 130, 376, 66)

    _txt(d, 225, 314, "Do anúncio ao certificado verificado", 8.5, FB, CINZA)
    _txt(d, 225, 8, "O QR do passo 5 rotaciona a cada 30 s; o do passo 8 é permanente.",
         7, F, CINZA)
    return d


# ===================== 4. Máquinas de estado =====================

def _estado(d, x, y, l, s, calc=False):
    r = Rect(x, y, l, 26, fillColor=CLARO if calc else colors.white,
             strokeColor=BORDA, strokeWidth=0.9)
    r.rx = r.ry = 7
    d.add(r)
    _txt(d, x + l / 2, y + 10, s, 7, FB)


def estados_atividade() -> Drawing:
    d = Drawing(450, 235)
    _estado(d, 12, 185, 74, "RASCUNHO")
    _estado(d, 126, 185, 76, "PUBLICADA")
    _estado(d, 242, 185, 92, "EM ANDAMENTO", calc=True)
    _estado(d, 242, 120, 92, "AGUARDANDO VALID.", calc=True)
    _estado(d, 366, 120, 76, "FINALIZADA")
    _estado(d, 126, 55, 76, "CANCELADA")

    _seta(d, 86, 198, 126, 198, rotulo="publicar")
    _seta(d, 202, 198, 242, 198, rotulo="chega a hora")
    _seta(d, 288, 185, 288, 148, rotulo="termina", dx=32, dy=0)
    _seta(d, 334, 133, 366, 133, rotulo="ONG valida")
    _seta(d, 164, 185, 164, 83, rotulo="cancelar", dx=28, dy=0)
    _seta(d, 49, 185, 49, 30)
    _txt(d, 49, 18, "excluída", 7, F, CINZA)

    d.add(Rect(300, 22, 11, 11, fillColor=CLARO, strokeColor=BORDA, strokeWidth=0.6))
    _txt(d, 317, 25, "situação calculada na leitura, não gravada", 7, F, CINZA, "start")
    return d


def estados_inscricao() -> Drawing:
    d = Drawing(450, 250)
    _estado(d, 18, 195, 76, "PENDENTE")
    _estado(d, 18, 120, 76, "RECUSADA")
    _estado(d, 160, 160, 86, "CONFIRMADA")
    _estado(d, 160, 55, 86, "CANCELADA")
    _estado(d, 310, 200, 76, "PRESENTE")
    _estado(d, 310, 120, 76, "AUSENTE")
    _estado(d, 310, 30, 76, "certificado")

    _txt(d, 56, 234, "só se a atividade exige aprovação", 7, F, CINZA)
    _seta(d, 94, 205, 160, 180, rotulo="aprovada", dy=8)
    _seta(d, 56, 195, 56, 148, rotulo="recusada", dx=30, dy=0)
    _seta(d, 203, 160, 203, 83, rotulo="desiste antes|do início".split("|")[0], dx=34, dy=0)
    _seta(d, 246, 180, 310, 210, rotulo="compareceu", dy=8)
    _seta(d, 246, 168, 310, 138, rotulo="faltou", dy=-10)
    _seta(d, 348, 200, 348, 58)

    _txt(d, 225, 8, "Na inscrição automática o estado inicial já é CONFIRMADA. "
                    "Só PRESENTE gera certificado.", 7, F, CINZA)
    return d

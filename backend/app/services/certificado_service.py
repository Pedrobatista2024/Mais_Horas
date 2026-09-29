"""
Certificado: emissão assinada, verificação pública e revogação.

Três garantias independentes, e a página pública mostra as três (os "selos"):

- **existe** — há um registro com aquele código na base da Mais Horas;
- **não revogado** — ninguém o invalidou depois de emitido;
- **assinatura confere** — o registro não foi alterado desde a emissão.

A terceira é a que justifica a assinatura. Um invasor que escreva direto no
banco consegue criar um registro que "existe" e "não está revogado", mas não
consegue produzir uma assinatura Ed25519 válida sem a chave privada, que nunca
vai para o banco.
"""

from __future__ import annotations

import io
import uuid
from datetime import datetime

from fastapi import Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import auditoria, security
from app.core.config import config
from app.core.errors import ErroDeNegocio
from app.db.models import (
    Atividade, Certificado, Inscricao, PerfilEstudante, PerfilOng, Usuario,
)
from app.services import notificacao_service
from app.services.atividade_service import TZ, agora

MESES = ("janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
         "agosto", "setembro", "outubro", "novembro", "dezembro")


def _data_por_extenso(quando) -> str:
    return f"{quando.day} de {MESES[quando.month - 1]} de {quando.year}"


def _no_fuso(momento: datetime) -> datetime:
    return momento.astimezone(TZ)


def url_de_verificacao(codigo: str) -> str:
    return f"{config.web_url.rstrip('/')}/verificar/{codigo}"


def _texto_assinado(cert: Certificado) -> str:
    return security.texto_canonico_certificado(
        codigo=cert.codigo_verificacao,
        nome_aluno=cert.nome_no_certificado,
        organizacao=cert.nome_organizacao,
        titulo_atividade=cert.titulo_atividade,
        horas=cert.horas,
        data_atividade=cert.data_atividade,
        emitido_em=cert.emitido_em,
    )


def assinatura_confere(cert: Certificado) -> bool:
    return security.conferir_assinatura(_texto_assinado(cert), cert.assinatura)


# ===================== Emissão =====================


def exigir_chave() -> None:
    """
    Confere a chave **antes** de mexer em qualquer coisa.

    Sem ela não há assinatura, e certificado sem assinatura não sai (D4). Falhar
    aqui, no começo, deixa a atividade intacta em vez de depender só do
    rollback.
    """
    if not config.chave_assinatura:
        raise ErroDeNegocio(
            "emissao_indisponivel",
            "A emissão de certificados está indisponível no momento. "
            "Nada foi alterado; tente de novo mais tarde.",
            status.HTTP_503_SERVICE_UNAVAILABLE,
        )


async def _nome_da_organizacao(sessao: AsyncSession, ong_id: uuid.UUID) -> str:
    perfil = await sessao.get(PerfilOng, ong_id)
    if perfil and perfil.nome_organizacao:
        return perfil.nome_organizacao
    ong = await sessao.get(Usuario, ong_id)
    return ong.nome if ong else ""


async def _nome_do_aluno(sessao: AsyncSession, usuario_id: uuid.UUID) -> str:
    """RN-50 — nome completo; na falta dele, o nome de cadastro."""
    perfil = await sessao.get(PerfilEstudante, usuario_id)
    if perfil and (perfil.nome_completo or "").strip():
        return perfil.nome_completo.strip()
    usuario = await sessao.get(Usuario, usuario_id)
    return usuario.nome


async def emitir_para_atividade(
    sessao: AsyncSession, ong: Usuario, atividade: Atividade,
    presentes: list[Inscricao], *, request: Request | None = None,
) -> int:
    """
    Cria e assina um certificado por presente. **Não dá commit**: roda dentro da
    transação da finalização, então ou a atividade fecha com todos os
    certificados, ou nada muda (RN-41).
    """
    organizacao = await _nome_da_organizacao(sessao, atividade.ong_id)
    # Segundos inteiros: o texto assinado usa essa precisão, e guardar o mesmo
    # valor evita qualquer dúvida sobre arredondamento na hora de conferir.
    emitido_em = agora().replace(microsecond=0)

    for inscricao in presentes:
        cert = Certificado(
            inscricao_id=inscricao.id,
            usuario_id=inscricao.usuario_id,
            atividade_id=atividade.id,
            codigo_verificacao=security.gerar_codigo_verificacao(),
            horas=atividade.carga_horaria,
            nome_no_certificado=(await _nome_do_aluno(sessao, inscricao.usuario_id))[:120],
            nome_organizacao=organizacao[:120],
            titulo_atividade=atividade.titulo,
            data_atividade=atividade.data,
            emitido_em=emitido_em,
            assinatura="",
        )
        cert.assinatura = security.assinar_certificado(_texto_assinado(cert))
        sessao.add(cert)
        await sessao.flush()

        await auditoria.registrar(
            sessao, "certificado.emitido", ator_id=ong.id, ator_papel=ong.papel,
            entidade="certificado", entidade_id=cert.id,
            depois={"codigo": cert.codigo_verificacao, "horas": cert.horas,
                    "aluno_id": str(cert.usuario_id)},
            request=request,
        )
        await notificacao_service.certificado_emitido(
            sessao, cert.usuario_id, cert.titulo_atividade, cert.horas)

    return len(presentes)


# ===================== Serialização =====================


def serializar(cert: Certificado) -> dict:
    return {
        "id": str(cert.id),
        "codigo": cert.codigo_verificacao,
        "aluno": cert.nome_no_certificado,
        "atividade": cert.titulo_atividade,
        "atividadeId": str(cert.atividade_id),
        "organizacao": cert.nome_organizacao,
        "horas": cert.horas,
        "dataAtividade": cert.data_atividade,
        "emitidoEm": _no_fuso(cert.emitido_em).isoformat(),
        "revogado": cert.revogado_em is not None,
        "revogadoEm": (_no_fuso(cert.revogado_em).isoformat()
                       if cert.revogado_em else None),
        "urlVerificacao": url_de_verificacao(cert.codigo_verificacao),
    }


# ===================== Listagem do aluno (E6) =====================


async def listar_meus(sessao: AsyncSession, aluno: Usuario, *, pagina: int = 1,
                      tamanho: int = 20) -> tuple[list[dict], int, int]:
    """Devolve (itens, total, horas válidas somadas — RN-16)."""
    base = select(Certificado).where(Certificado.usuario_id == aluno.id)

    total = int(await sessao.scalar(
        select(func.count()).select_from(base.subquery())) or 0)

    # RN-16: o total de horas é a soma dos certificados — mas só dos que valem.
    horas = int(await sessao.scalar(
        select(func.coalesce(func.sum(Certificado.horas), 0))
        .where(Certificado.usuario_id == aluno.id,
               Certificado.revogado_em.is_(None))) or 0)

    resultado = await sessao.scalars(
        base.order_by(Certificado.data_atividade.desc(),
                      Certificado.emitido_em.desc())
        .offset((pagina - 1) * tamanho).limit(tamanho))
    return [serializar(c) for c in resultado], total, horas


# ===================== Verificação pública (T6) =====================


def _normalizar(codigo: str) -> str:
    return (codigo or "").strip().lower()


async def _buscar_por_codigo(sessao: AsyncSession, codigo: str) -> Certificado | None:
    codigo = _normalizar(codigo)
    if not codigo or len(codigo) > 32:
        return None
    return await sessao.scalar(
        select(Certificado).where(Certificado.codigo_verificacao == codigo))


async def prova(sessao: AsyncSession, codigo: str) -> dict:
    """
    A prova crua de um certificado: o texto exato que foi assinado, a
    assinatura e a chave usada.

    Existe para tirar a verificação das nossas mãos. Com isto e a chave
    pública, qualquer pessoa confere o certificado sozinha, no computador
    dela — sem precisar acreditar no que esta API responde. Um certificado
    revogado também tem prova: a assinatura continua válida, o que mudou foi
    a decisão da instituição.
    """
    cert = await _buscar_por_codigo(sessao, codigo)
    if cert is None:
        raise ErroDeNegocio("nao_encontrado", "Certificado não encontrado",
                            status.HTTP_404_NOT_FOUND)

    return {
        "codigo": cert.codigo_verificacao,
        "algoritmo": "Ed25519",
        "formatoDoTexto": security.VERSAO_TEXTO_CERTIFICADO,
        "textoAssinado": _texto_assinado(cert),
        "assinatura": cert.assinatura,
        "chavePublica": security.chave_publica_pem(),
        "impressaoDigitalDaChave": security.impressao_digital_chave(),
        "revogado": cert.revogado_em is not None,
        "comoConferir": (
            "Verifique a assinatura Ed25519 sobre o texto assinado, byte a byte, "
            "usando a chave pública acima. O texto é uma lista JSON com versão, "
            "código, nome, organização, atividade, horas, data e emissão em "
            "segundos UTC — os mesmos campos impressos no certificado."),
    }


def _desfecho(cert: Certificado | None, codigo: str) -> dict:
    """
    Monta a resposta pronta para a tela (RN-56).

    Nenhum dos quatro desfechos é erro genérico: nos três primeiros o sistema
    funcionou e tem algo importante a dizer; no quarto, quase sempre foi erro
    de digitação.
    """
    if cert is None:
        return {
            "valido": False,
            "desfecho": "inexistente",
            "titulo": "Certificado não encontrado",
            "mensagem": (
                f"Nenhum certificado corresponde ao código {_normalizar(codigo)}. "
                "Confira se o código foi digitado corretamente — ele tem 16 "
                "caracteres. Se veio de um QR Code, tente escanear novamente."),
            "selos": {"existe": False, "naoRevogado": False,
                      "assinaturaConfere": False},
            "certificado": None,
        }

    confere = assinatura_confere(cert)
    revogado = cert.revogado_em is not None
    selos = {"existe": True, "naoRevogado": not revogado,
             "assinaturaConfere": confere}
    dados = serializar(cert)
    dados.pop("id", None)
    dados.pop("atividadeId", None)

    # A adulteração vem antes da revogação: se o registro foi mexido, até o
    # motivo da revogação pode ter sido escrito pelo invasor.
    if not confere:
        return {
            "valido": False,
            "desfecho": "adulterado",
            "titulo": "Este certificado não confere",
            "mensagem": (
                "Os dados registrados não correspondem à assinatura digital "
                "emitida pela Mais Horas. Isso indica que o registro foi alterado "
                "depois da emissão. Não aceite este documento como comprovação de "
                "horas. Se você o recebeu de alguém, avise a instituição."),
            "selos": selos,
            "certificado": dados,
        }

    if revogado:
        return {
            "valido": False,
            "desfecho": "revogado",
            "titulo": "Este certificado foi revogado",
            "mensagem": (
                f"Este certificado existiu e foi emitido pela "
                f"{cert.nome_organizacao}, mas foi invalidado em "
                f"{_data_por_extenso(_no_fuso(cert.revogado_em))}. "
                f"Motivo: {cert.motivo_revogacao}. Ele não deve ser aceito como "
                "comprovação de horas."),
            "selos": selos,
            "certificado": dados,
        }

    return {
        "valido": True,
        "desfecho": "valido",
        "titulo": "Certificado válido",
        "mensagem": (
            f"Este certificado foi emitido pela {cert.nome_organizacao} em "
            f"{_data_por_extenso(_no_fuso(cert.emitido_em))} e confere "
            f"{cert.horas} {'hora' if cert.horas == 1 else 'horas'} de atividade "
            f"de extensão a {cert.nome_no_certificado}. Os dados abaixo vêm "
            "direto da base da Mais Horas, não do arquivo."),
        "selos": selos,
        "certificado": dados,
    }


async def verificar(sessao: AsyncSession, codigo: str, *,
                    request: Request | None = None) -> dict:
    cert = await _buscar_por_codigo(sessao, codigo)
    resposta = _desfecho(cert, codigo)

    # Só a adulteração vai para a trilha. As verificações comuns são públicas e
    # frequentes, e registrá-las todas afogaria o que importa: a prova de que
    # alguém mexeu no banco.
    if resposta["desfecho"] == "adulterado":
        await auditoria.registrar(
            sessao, "integridade.verificada", entidade="certificado",
            entidade_id=cert.id,
            depois={"desfecho": "adulterado", "codigo": cert.codigo_verificacao},
            request=request,
        )
        await sessao.commit()

    return resposta


# ===================== PDF =====================

# Paleta da marca (mesma de frontend/src/theme.js). O certificado é a peça que
# mais circula fora da plataforma: sair com outra cor seria sair sem identidade.
AZUL = "#1839b0"      # brand.7 — royal, cor principal
AZUL_ESCURO = "#0f2570"
AZUL_CLARO = "#e8edfb"
AMBAR = "#ef9504"     # clay.6 — o ponteiro de segundos da marca
TINTA = "#1b2540"     # texto
CINZA = "#5b6885"     # texto secundário


def _relogio(pdf, cx: float, cy: float, raio: float) -> None:
    """
    O relógio que substitui o "o" de "Horas" no logotipo.

    Desenhado em vetor, e não colado como imagem: o PDF é impresso e ampliado,
    e um PNG de logotipo apareceria serrilhado. Espelha
    `frontend/src/components/ui/ClockGlyph.jsx`, inclusive na pose 10:10.
    """
    from math import cos, pi, sin

    from reportlab.lib import colors

    pdf.saveState()
    pdf.setLineCap(1)

    pdf.setFillColor(colors.HexColor(AZUL))
    pdf.circle(cx, cy, raio, stroke=0, fill=1)
    pdf.setFillColor(colors.HexColor(AZUL_CLARO))
    pdf.circle(cx, cy, raio * 0.85, stroke=0, fill=1)
    pdf.setFillColor(colors.white)
    pdf.circle(cx, cy, raio * 0.79, stroke=0, fill=1)

    for marcador in range(12):
        angulo = marcador * pi / 6
        cheio = marcador % 3 == 0
        fora, dentro = raio * 0.70, raio * (0.55 if cheio else 0.62)
        pdf.setStrokeColor(colors.HexColor(AZUL_ESCURO if cheio else "#9fb1d6"))
        pdf.setLineWidth(raio * (0.068 if cheio else 0.038))
        pdf.line(cx + fora * sin(angulo), cy + fora * cos(angulo),
                 cx + dentro * sin(angulo), cy + dentro * cos(angulo))

    # Ponteiro de segundos (âmbar), com contrapeso, apontando para baixo.
    pdf.setStrokeColor(colors.HexColor(AMBAR))
    pdf.setLineWidth(raio * 0.034)
    pdf.line(cx, cy, cx, cy - raio * 0.64)
    pdf.line(cx, cy, cx, cy + raio * 0.17)

    # Horas em 10 e minutos em 2 — a pose clássica de vitrine de relojoaria.
    pdf.setStrokeColor(colors.HexColor(AZUL_ESCURO))
    pdf.setLineWidth(raio * 0.11)
    pdf.line(cx, cy, cx - raio * 0.37, cy + raio * 0.26)
    pdf.setStrokeColor(colors.HexColor(AZUL))
    pdf.setLineWidth(raio * 0.094)
    pdf.line(cx, cy, cx + raio * 0.55, cy + raio * 0.32)

    pdf.setFillColor(colors.HexColor(AZUL_ESCURO))
    pdf.circle(cx, cy, raio * 0.077, stroke=0, fill=1)
    pdf.setFillColor(colors.white)
    pdf.circle(cx, cy, raio * 0.032, stroke=0, fill=1)
    pdf.restoreState()


def _marca(pdf, centro_x: float, base_y: float, tamanho: float,
           claro: bool = False) -> None:
    """Logotipo "MaisH(relógio)ras", centralizado em `centro_x`."""
    from reportlab.lib import colors

    fonte = "Helvetica-Bold"
    largura_mais = pdf.stringWidth("Mais", fonte, tamanho)
    largura_h = pdf.stringWidth("H", fonte, tamanho)
    largura_ras = pdf.stringWidth("ras", fonte, tamanho)
    raio = tamanho * 0.40
    total = largura_mais + largura_h + raio * 2 + largura_ras

    x = centro_x - total / 2
    pdf.setFont(fonte, tamanho)
    pdf.setFillColor(colors.white if claro else colors.HexColor(TINTA))
    pdf.drawString(x, base_y, "Mais")
    x += largura_mais
    pdf.setFillColor(colors.white if claro else colors.HexColor(AZUL))
    pdf.drawString(x, base_y, "H")
    x += largura_h
    _relogio(pdf, x + raio, base_y + tamanho * 0.36, raio)
    x += raio * 2
    pdf.drawString(x, base_y, "ras")


def _selo(pdf, cx: float, cy: float, raio: float, impressao: str) -> None:
    """Selo de assinatura digital — o equivalente honesto do carimbo."""
    from reportlab.lib import colors

    pdf.saveState()
    pdf.setStrokeColor(colors.HexColor(AZUL))
    pdf.setLineWidth(1.6)
    pdf.circle(cx, cy, raio, stroke=1, fill=0)
    pdf.setLineWidth(0.6)
    pdf.circle(cx, cy, raio * 0.88, stroke=1, fill=0)

    pdf.setFillColor(colors.HexColor(AZUL))
    pdf.setFont("Helvetica-Bold", raio * 0.21)
    pdf.drawCentredString(cx, cy + raio * 0.36, "ASSINADO")
    pdf.drawCentredString(cx, cy + raio * 0.10, "DIGITALMENTE")
    pdf.setFont("Helvetica", raio * 0.17)
    pdf.setFillColor(colors.HexColor(CINZA))
    pdf.drawCentredString(cx, cy - raio * 0.18, "Ed25519")
    # A impressão digital inteira fica no rodapé: aqui ela não caberia sem
    # virar letra ilegível.
    pdf.drawCentredString(cx, cy - raio * 0.42, impressao[:8])
    pdf.restoreState()


def _cabe(pdf, texto: str, fonte: str, tamanho: float, largura: float) -> float:
    """
    Maior tamanho de fonte (até `tamanho`) em que o texto cabe na largura.

    Nome de 120 caracteres e título de 40 são permitidos pelo cadastro; sem
    isto, os dois atravessariam a moldura em vez de encolher.
    """
    while tamanho > 8 and pdf.stringWidth(texto, fonte, tamanho) > largura:
        tamanho -= 0.5
    return tamanho


def _desenhar_pdf(cert: Certificado, *, revogado: bool) -> bytes:
    import qrcode
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.units import mm
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfgen import canvas

    buffer = io.BytesIO()
    largura, altura = landscape(A4)
    pdf = canvas.Canvas(buffer, pagesize=landscape(A4))
    pdf.setTitle(f"Certificado Mais Horas {cert.codigo_verificacao}")
    pdf.setAuthor("Mais Horas")
    pdf.setSubject("Certificado de participação em atividade de extensão")

    azul = colors.HexColor(AZUL)
    tinta = colors.HexColor(TINTA)
    cinza = colors.HexColor(CINZA)
    centro = largura / 2

    # Faixa superior: é ela que identifica o documento de longe, na mesa da
    # coordenação, antes de alguém ler qualquer linha.
    faixa = 30 * mm
    pdf.setFillColor(colors.HexColor(AZUL_ESCURO))
    pdf.rect(0, altura - faixa, largura, faixa, stroke=0, fill=1)
    pdf.setFillColor(colors.HexColor(AMBAR))
    pdf.rect(0, altura - faixa - 1.6 * mm, largura, 1.6 * mm, stroke=0, fill=1)
    _marca(pdf, centro, altura - faixa + 10 * mm, 21, claro=True)

    # Moldura fina, respeitando a faixa.
    pdf.setStrokeColor(colors.HexColor("#c9d4f2"))
    pdf.setLineWidth(0.8)
    pdf.rect(12 * mm, 12 * mm, largura - 24 * mm, altura - faixa - 20 * mm)

    pdf.setFillColor(azul)
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawCentredString(centro, altura - faixa - 16 * mm,
                          "C E R T I F I C A D O   D E   P A R T I C I P A Ç Ã O")

    pdf.setFillColor(cinza)
    pdf.setFont("Helvetica", 13)
    pdf.drawCentredString(centro, altura - faixa - 30 * mm, "Certificamos que")

    util = largura - 56 * mm
    pdf.setFillColor(tinta)
    pdf.setFont("Helvetica-Bold",
                _cabe(pdf, cert.nome_no_certificado, "Helvetica-Bold", 32, util))
    pdf.drawCentredString(centro, altura - faixa - 46 * mm, cert.nome_no_certificado)

    # Fio curto sob o nome, como numa linha de assinatura.
    pdf.setStrokeColor(colors.HexColor(AMBAR))
    pdf.setLineWidth(1.4)
    pdf.line(centro - 45 * mm, altura - faixa - 52 * mm,
             centro + 45 * mm, altura - faixa - 52 * mm)

    pdf.setFillColor(colors.HexColor("#39456b"))
    pdf.setFont("Helvetica", 14)
    linhas = [
        f"participou da atividade “{cert.titulo_atividade}”,",
        f"promovida por {cert.nome_organizacao},",
        f"realizada em {_data_por_extenso(cert.data_atividade)}.",
    ]
    corpo = min(_cabe(pdf, linha, "Helvetica", 14, util) for linha in linhas)
    pdf.setFont("Helvetica", corpo)
    for indice, linha in enumerate(linhas):
        pdf.drawCentredString(centro, altura - faixa - (64 + indice * 9) * mm, linha)

    # A carga horária é o número que a coordenação procura primeiro: ela ganha
    # destaque próprio em vez de se esconder no meio da frase.
    horas = f"{cert.horas} {'hora' if cert.horas == 1 else 'horas'} de extensão"
    largura_pilula = pdf.stringWidth(horas, "Helvetica-Bold", 15) + 22 * mm
    topo_pilula = altura - faixa - 110 * mm
    pdf.setFillColor(colors.HexColor("#fff6e6"))
    pdf.setStrokeColor(colors.HexColor(AMBAR))
    pdf.setLineWidth(1)
    pdf.roundRect(centro - largura_pilula / 2, topo_pilula, largura_pilula,
                  11 * mm, 5.5 * mm, stroke=1, fill=1)
    pdf.setFillColor(colors.HexColor("#8a5a03"))
    pdf.setFont("Helvetica-Bold", 15)
    pdf.drawCentredString(centro, topo_pilula + 3.6 * mm, horas)

    # Rodapé: QR à esquerda, selo à direita. O QR fica grande o bastante para
    # ser lido do papel impresso, a uma distância de braço.
    base = 20 * mm
    url = url_de_verificacao(cert.codigo_verificacao)
    imagem = qrcode.make(url, box_size=10, border=1)
    arquivo = io.BytesIO()
    imagem.save(arquivo, format="PNG")
    arquivo.seek(0)
    lado = 32 * mm
    pdf.drawImage(ImageReader(arquivo), 22 * mm, base, lado, lado)

    texto_x = 22 * mm + lado + 7 * mm
    pdf.setFillColor(tinta)
    pdf.setFont("Helvetica-Bold", 10.5)
    pdf.drawString(texto_x, base + 25 * mm, "Confira a autenticidade")
    pdf.setFont("Helvetica", 9)
    pdf.setFillColor(cinza)
    pdf.drawString(texto_x, base + 19.5 * mm,
                   "Aponte a câmera para o QR Code ou acesse")
    pdf.setFillColor(azul)
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawString(texto_x, base + 14.5 * mm, url)
    pdf.setFillColor(cinza)
    pdf.setFont("Helvetica", 9)
    pdf.drawString(texto_x, base + 9 * mm, f"Código: {cert.codigo_verificacao}")
    pdf.drawString(texto_x, base + 3.5 * mm,
                   f"Emitido em {_data_por_extenso(_no_fuso(cert.emitido_em))}")

    _selo(pdf, largura - 44 * mm, base + lado / 2, 20 * mm,
          security.impressao_digital_chave())

    # A página inteira é assinada: dizer isso em letra miúda evita a pergunta
    # "e a assinatura de quem?" antes que ela apareça.
    pdf.setFillColor(colors.HexColor("#8792ad"))
    pdf.setFont("Helvetica", 7.5)
    pdf.drawCentredString(
        centro, 14 * mm,
        "Documento assinado digitalmente pela plataforma Mais Horas "
        f"(Ed25519, chave {security.impressao_digital_chave()}). A verificação confere "
        "nome, organização, atividade, data e carga horária.")

    if revogado:
        # Marca d'água: o arquivo continua disponível ao aluno (FE-07 E2), mas não
        # pode circular como se valesse.
        pdf.saveState()
        pdf.setFillColor(colors.HexColor("#c0392b"))
        pdf.setFillAlpha(0.18)
        pdf.setFont("Helvetica-Bold", 110)
        pdf.translate(centro, altura / 2)
        pdf.rotate(24)
        pdf.drawCentredString(0, -20, "REVOGADO")
        pdf.restoreState()

    pdf.showPage()
    pdf.save()
    return buffer.getvalue()


def _arquivo(cert: Certificado) -> tuple[bytes, str]:
    """
    Gera o PDF — **só de registro íntegro**.

    Imprimir um registro adulterado com o timbre da Mais Horas seria dar ao
    invasor exatamente o documento que ele queria.
    """
    if not assinatura_confere(cert):
        raise ErroDeNegocio(
            "certificado_nao_confere",
            "Este certificado não confere com a assinatura digital e não pode "
            "ser gerado. A equipe da Mais Horas foi alertada.",
            status.HTTP_409_CONFLICT,
        )
    nome = f"certificado-mais-horas-{cert.codigo_verificacao}.pdf"
    return _desenhar_pdf(cert, revogado=cert.revogado_em is not None), nome


async def pdf_do_proprio(sessao: AsyncSession, usuario: Usuario,
                         certificado_id: uuid.UUID) -> tuple[bytes, str]:
    cert = await sessao.get(Certificado, certificado_id)
    dono = cert is not None and cert.usuario_id == usuario.id
    if cert is None or not (dono or usuario.papel == "superadmin"):
        # 404 também para certificado alheio: não confirmar que o id existe.
        raise ErroDeNegocio("nao_encontrado", "Certificado não encontrado",
                            status.HTTP_404_NOT_FOUND)
    return _arquivo(cert)


async def pdf_publico(sessao: AsyncSession, codigo: str) -> tuple[bytes, str]:
    """
    O "PDF oficial" de `T6`: o verificador baixa da fonte em vez de confiar no
    arquivo que recebeu. Por isso só sai de certificado **válido** — um
    revogado baixado aqui pareceria endossado pela própria verificação.
    """
    cert = await _buscar_por_codigo(sessao, codigo)
    if cert is None:
        raise ErroDeNegocio("nao_encontrado", "Certificado não encontrado",
                            status.HTTP_404_NOT_FOUND)
    if cert.revogado_em is not None:
        raise ErroDeNegocio("certificado_revogado",
                            "Este certificado foi revogado e não tem PDF oficial",
                            status.HTTP_409_CONFLICT)
    return _arquivo(cert)


# ===================== Revogação (admin) =====================


async def _buscar(sessao: AsyncSession, certificado_id: uuid.UUID) -> Certificado:
    cert = await sessao.get(Certificado, certificado_id)
    if cert is None:
        raise ErroDeNegocio("nao_encontrado", "Certificado não encontrado",
                            status.HTTP_404_NOT_FOUND)
    return cert


async def revogar(sessao: AsyncSession, admin: Usuario, certificado_id: uuid.UUID,
                  motivo: str, *, request: Request | None = None) -> dict:
    """
    RN-25 / RN-34 — invalida **sem apagar**. O registro continua lá, e a
    verificação pública passa a dizer que foi revogado, quando e por quê.

    A revogação não toca nos campos assinados, então a assinatura continua
    conferindo: "revogado" e "adulterado" permanecem distinguíveis.
    """
    cert = await _buscar(sessao, certificado_id)
    if cert.revogado_em is not None:
        raise ErroDeNegocio("ja_revogado", "Este certificado já está revogado")

    cert.revogado_em = agora()
    cert.revogado_por = admin.id
    cert.motivo_revogacao = motivo.strip()

    await auditoria.registrar(
        sessao, "certificado.revogado", ator_id=admin.id, ator_papel=admin.papel,
        entidade="certificado", entidade_id=cert.id,
        depois={"motivo": cert.motivo_revogacao, "codigo": cert.codigo_verificacao},
        request=request,
    )
    await notificacao_service.certificado_revogado(
        sessao, cert.usuario_id, cert.titulo_atividade, cert.motivo_revogacao)
    await sessao.commit()
    return serializar(cert)


async def reverter_revogacao(sessao: AsyncSession, admin: Usuario,
                             certificado_id: uuid.UUID, *,
                             request: Request | None = None) -> dict:
    cert = await _buscar(sessao, certificado_id)
    if cert.revogado_em is None:
        raise ErroDeNegocio("nao_revogado", "Este certificado não está revogado")

    antes = {"motivo": cert.motivo_revogacao,
             "revogado_em": cert.revogado_em.isoformat()}
    cert.revogado_em = None
    cert.revogado_por = None
    cert.motivo_revogacao = None

    await auditoria.registrar(
        sessao, "certificado.revogacao_revertida", ator_id=admin.id,
        ator_papel=admin.papel, entidade="certificado", entidade_id=cert.id,
        antes=antes, request=request,
    )
    await notificacao_service.certificado_restabelecido(
        sessao, cert.usuario_id, cert.titulo_atividade)
    await sessao.commit()
    return serializar(cert)

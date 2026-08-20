"""
Geração do PDF do certificado.

Substitui o pdfkit do backend Node por reportlab. O QR Code aponta para a página
pública de verificação no frontend (`/verificar/<code>`), nunca para o PDF em si
— é isso que permite conferir a autenticidade sem confiar no arquivo.
"""

from __future__ import annotations

import io
from typing import Any

import qrcode
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas as pdf_canvas

from app.core.config import settings

PAGE_WIDTH, PAGE_HEIGHT = A4
MARGIN = 50


def _qr_image(url: str) -> ImageReader:
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGB")

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return ImageReader(buffer)


def _format_date(value: Any) -> str:
    """Formata como dd/mm/aaaa. Aceita datetime ou string ISO."""
    if value is None:
        return ""
    if hasattr(value, "strftime"):
        return value.strftime("%d/%m/%Y")
    return str(value)


def _draw_centered_paragraph(
    canvas: pdf_canvas.Canvas, text: str, y: float, font_size: int, leading: float
) -> float:
    """Desenha texto centralizado com quebra de linha. Retorna o novo Y."""
    from reportlab.platypus import Paragraph

    style = ParagraphStyle(
        "centered",
        parent=getSampleStyleSheet()["Normal"],
        fontName="Helvetica",
        fontSize=font_size,
        leading=leading,
        alignment=TA_CENTER,
    )
    paragraph = Paragraph(text, style)
    available_width = PAGE_WIDTH - 2 * MARGIN
    _, height = paragraph.wrap(available_width, PAGE_HEIGHT)
    paragraph.drawOn(canvas, MARGIN, y - height)
    return y - height


def generate_certificate_pdf(certificate: dict[str, Any]) -> bytes:
    """Monta o PDF do certificado e devolve os bytes."""
    buffer = io.BytesIO()
    canvas = pdf_canvas.Canvas(buffer, pagesize=A4)
    canvas.setTitle("Certificado de Participação - Mais Horas")

    user = certificate.get("user") or {}
    activity = certificate.get("activity") or {}
    created_by = activity.get("createdBy") or {}

    student_name = user.get("name") or "Participante"
    activity_title = activity.get("title") or "Atividade"
    activity_date = _format_date(activity.get("date"))
    hours = certificate.get("hours") or 0
    org_name = created_by.get("name") or "Organização"
    code = certificate.get("verificationCode") or ""

    # ===== Título =====
    canvas.setFont("Helvetica-Bold", 22)
    y = PAGE_HEIGHT - MARGIN - 40
    canvas.drawCentredString(PAGE_WIDTH / 2, y, "CERTIFICADO DE PARTICIPAÇÃO")

    # ===== Corpo =====
    y -= 60
    body = (
        f"Certificamos que <b>{student_name}</b> participou da atividade "
        f'"<b>{activity_title}</b>", realizada em {activity_date}, totalizando '
        f"<b>{hours}</b> horas de atividades de extensão."
    )
    y = _draw_centered_paragraph(canvas, body, y, font_size=14, leading=20)

    # ===== Organização =====
    y -= 40
    canvas.setFont("Helvetica", 12)
    canvas.drawCentredString(PAGE_WIDTH / 2, y, f"Organização responsável: {org_name}")

    # ===== QR Code =====
    validation_url = f"{settings.web_url.rstrip('/')}/verificar/{code}"
    qr_size = 120
    y -= (qr_size + 50)
    canvas.drawImage(
        _qr_image(validation_url),
        (PAGE_WIDTH - qr_size) / 2,
        y,
        width=qr_size,
        height=qr_size,
        mask="auto",
    )

    # ===== Código e instrução =====
    y -= 20
    canvas.setFont("Helvetica", 10)
    canvas.drawCentredString(PAGE_WIDTH / 2, y, f"Código de verificação: {code}")

    y -= 14
    canvas.setFont("Helvetica-Oblique", 8)
    canvas.drawCentredString(
        PAGE_WIDTH / 2,
        y,
        "Escaneie o QR Code para confirmar a autenticidade deste certificado.",
    )

    # ===== Rodapé =====
    canvas.setFont("Helvetica", 8)
    canvas.drawCentredString(PAGE_WIDTH / 2, MARGIN, "Mais Horas")

    canvas.showPage()
    canvas.save()
    return buffer.getvalue()

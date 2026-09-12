from __future__ import annotations

from pathlib import Path
from textwrap import wrap as text_wrap

import fitz
from PIL import Image, ImageColor, ImageDraw, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SOURCE_PDF = Path(r"C:\Users\ismae\OneDrive\Documents\apresen-final23062026.pdf")
OUTPUT_PDF = SOURCE_PDF.with_name("apresen-final23062026-reformulada.pdf")
TEMP_DIR = ROOT / ".codex-temp" / "visual-redesign"
TEMP_DIR.mkdir(parents=True, exist_ok=True)

FONT_REGULAR = Path(r"C:\Windows\Fonts\segoeui.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\segoeuib.ttf")

BG = "#F5F8FF"
BG_TOP = "#EEF3FF"
WHITE = "#FFFFFF"
INK = "#111C30"
MUTED = "#64748F"
LINE = "#D7E1F3"
BRAND = "#1F47C9"
BRAND_DEEP = "#142F8F"
NAVY = "#0F2570"
CLAY = "#EF9504"
SOFT_BLUE = "#E8EDFB"
SOFT_CLAY = "#FFF2DD"
GREEN = "#2E7D55"
SOFT_GREEN = "#E9F8F0"

SLIDE_STUDENT = ROOT / "presentation" / "slides" / "slide-09.png"
SLIDE_ONG = ROOT / "presentation" / "slides" / "slide-10.png"
QR_PRESENCE = ROOT / "presentation" / "assets" / "qr-presence.png"
QR_CERT = ROOT / "presentation" / "assets" / "qr-certificate.png"


def rgba(color: str, alpha: int = 255) -> tuple[int, int, int, int]:
    r, g, b = ImageColor.getrgb(color)
    return (r, g, b, alpha)


def load_font(path: Path, size: int) -> ImageFont.ImageFont:
    try:
        return ImageFont.truetype(str(path), size)
    except OSError:
        return ImageFont.load_default()


def line_height(font: ImageFont.ImageFont, extra: float = 0.25) -> int:
    bbox = font.getbbox("Ag")
    return int((bbox[3] - bbox[1]) * (1 + extra))


def wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: int) -> list[str]:
    lines: list[str] = []
    for paragraph in text.split("\n"):
        words = paragraph.split()
        if not words:
            lines.append("")
            continue
        current = words[0]
        for word in words[1:]:
            candidate = f"{current} {word}"
            if draw.textlength(candidate, font=font) <= max_width:
                current = candidate
            else:
                lines.append(current)
                current = word
        lines.append(current)
    return lines


def draw_multiline(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    font: ImageFont.ImageFont,
    fill: str,
    max_width: int,
    spacing: int | None = None,
    max_lines: int | None = None,
) -> int:
    lines = wrap_text(draw, text, font, max_width)
    if max_lines is not None:
        lines = lines[:max_lines]
    lh = spacing or line_height(font)
    x, y = xy
    for idx, line in enumerate(lines):
        draw.text((x, y + idx * lh), line, font=font, fill=fill)
    return y + len(lines) * lh


def rounded_panel(
    base: Image.Image,
    box: tuple[int, int, int, int],
    radius: int,
    fill: str = WHITE,
    outline: str | None = LINE,
    shadow_alpha: int = 30,
    offset: tuple[int, int] = (0, 12),
    blur: int = 18,
) -> None:
    x1, y1, x2, y2 = box
    w = x2 - x1
    h = y2 - y1
    shadow = Image.new("RGBA", (w + blur * 4, h + blur * 4), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle(
        (blur * 2, blur * 2, blur * 2 + w, blur * 2 + h),
        radius=radius,
        fill=rgba(NAVY, shadow_alpha),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
    base.alpha_composite(shadow, (x1 + offset[0] - blur * 2, y1 + offset[1] - blur * 2))

    draw = ImageDraw.Draw(base)
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=2 if outline else 0)


def paste_contain(
    base: Image.Image,
    asset: Image.Image,
    box: tuple[int, int, int, int],
    radius: int = 24,
    bg: str | None = None,
    inner_padding: int = 0,
) -> None:
    x1, y1, x2, y2 = box
    if bg:
        rounded_panel(base, box, radius=radius, fill=bg, outline=None, shadow_alpha=0)

    inner = (x2 - x1 - inner_padding * 2, y2 - y1 - inner_padding * 2)
    contained = ImageOps.contain(asset, inner, method=Image.Resampling.LANCZOS)
    mask = Image.new("L", (contained.width, contained.height), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle((0, 0, contained.width, contained.height), radius=max(8, radius // 2), fill=255)

    px = x1 + inner_padding + (inner[0] - contained.width) // 2
    py = y1 + inner_padding + (inner[1] - contained.height) // 2
    base.paste(contained, (px, py), mask)


def crop(path: Path, box: tuple[int, int, int, int]) -> Image.Image:
    return Image.open(path).convert("RGBA").crop(box)


def draw_brand_mark(base: Image.Image, x: int, y: int, scale: float = 1.0) -> None:
    draw = ImageDraw.Draw(base)
    icon = int(56 * scale)
    draw.rounded_rectangle((x, y, x + icon, y + icon), radius=int(16 * scale), fill=BRAND)
    draw.ellipse((x + 12 * scale, y + 12 * scale, x + 38 * scale, y + 38 * scale), outline=WHITE, width=max(2, int(3 * scale)))
    draw.line((x + 25 * scale, y + 25 * scale, x + 25 * scale, y + 12 * scale), fill=WHITE, width=max(2, int(3 * scale)))
    draw.line((x + 25 * scale, y + 25 * scale, x + 38 * scale, y + 25 * scale), fill=WHITE, width=max(2, int(3 * scale)))
    draw.ellipse((x + 39 * scale, y + 4 * scale, x + 55 * scale, y + 20 * scale), fill=CLAY)
    draw.line((x + 47 * scale, y + 8 * scale, x + 47 * scale, y + 16 * scale), fill=WHITE, width=max(2, int(2 * scale)))
    draw.line((x + 43 * scale, y + 12 * scale, x + 51 * scale, y + 12 * scale), fill=WHITE, width=max(2, int(2 * scale)))

    bold = load_font(FONT_BOLD, int(28 * scale))
    regular = load_font(FONT_REGULAR, int(10 * scale))
    draw.text((x + 68 * scale, y + 4 * scale), "Mais", fill=INK, font=bold)
    draw.text((x + 140 * scale, y + 4 * scale), "Horas", fill=BRAND, font=bold)
    draw.text((x + 68 * scale, y + 34 * scale), "Horas que transformam", fill=MUTED, font=regular)


def badge(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], fill: str, text: str, text_fill: str, font: ImageFont.ImageFont) -> None:
    draw.rounded_rectangle(box, radius=(box[3] - box[1]) // 2, fill=fill)
    tw = draw.textlength(text, font=font)
    th = font.getbbox(text)[3] - font.getbbox(text)[1]
    x1, y1, x2, y2 = box
    draw.text((x1 + (x2 - x1 - tw) / 2, y1 + (y2 - y1 - th) / 2 - 1), text, fill=text_fill, font=font)


def make_gradient(size: tuple[int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGBA", size, rgba(BG))
    top = Image.new("RGBA", size, (0, 0, 0, 0))
    top_draw = ImageDraw.Draw(top)
    top_draw.rectangle((0, 0, w, int(h * 0.30)), fill=rgba(BG_TOP))
    top_draw.ellipse((int(w * 0.68), -int(h * 0.08), int(w * 1.02), int(h * 0.38)), fill=rgba("#DCE7FF", 180))
    top_draw.ellipse((int(w * 0.72), int(h * 0.55), int(w * 1.10), int(h * 1.02)), fill=rgba("#EAF1FF", 120))
    img.alpha_composite(top)
    return img


def student_assets() -> tuple[Image.Image, Image.Image]:
    main = crop(SLIDE_STUDENT, (100, 335, 1450, 955))
    summary = crop(SLIDE_STUDENT, (1510, 405, 1840, 835))
    return main, summary


def ong_assets() -> tuple[Image.Image, Image.Image]:
    main = crop(SLIDE_ONG, (100, 335, 1450, 955))
    summary = crop(SLIDE_ONG, (1510, 405, 1840, 835))
    return main, summary


def make_certificate_card(size: tuple[int, int]) -> Image.Image:
    w, h = size
    card = Image.new("RGBA", size, (0, 0, 0, 0))
    rounded_panel(card, (0, 0, w - 1, h - 1), radius=34, fill=WHITE, outline=LINE, shadow_alpha=0)
    draw = ImageDraw.Draw(card)
    draw_brand_mark(card, 28, 24, 0.62)

    title_font = load_font(FONT_BOLD, int(h * 0.10))
    body_font = load_font(FONT_REGULAR, int(h * 0.065))
    micro_font = load_font(FONT_BOLD, int(h * 0.052))
    code_font = load_font(FONT_BOLD, int(h * 0.06))

    draw.text((36, int(h * 0.26)), "Certificado público", font=title_font, fill=BRAND_DEEP)
    draw.text((36, int(h * 0.42)), "Maria Eduarda Silva", font=body_font, fill=INK)
    draw.text((36, int(h * 0.52)), "Casa Florian • ação validada • 4 horas", font=body_font, fill=MUTED)

    qr = Image.open(QR_CERT).convert("RGBA")
    paste_contain(card, qr, (int(w * 0.68), int(h * 0.23), int(w * 0.93), int(h * 0.70)), radius=18)

    badge(draw, (36, int(h * 0.72), int(w * 0.40), int(h * 0.86)), SOFT_BLUE, "4 horas validadas", BRAND, micro_font)
    badge(draw, (int(w * 0.44), int(h * 0.72), int(w * 0.67), int(h * 0.86)), SOFT_CLAY, "Código público", CLAY, micro_font)
    draw.text((36, int(h * 0.90)), "Token: MH-649ECE45", font=code_font, fill=BRAND_DEEP)
    return card


def make_auth_visual(size: tuple[int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    rounded_panel(img, (0, 0, w - 1, h - 1), radius=28, fill=WHITE, outline=LINE, shadow_alpha=0)
    draw = ImageDraw.Draw(img)
    title_font = load_font(FONT_BOLD, int(h * 0.095))
    body_font = load_font(FONT_REGULAR, int(h * 0.053))
    pill_font = load_font(FONT_BOLD, int(h * 0.055))
    small_font = load_font(FONT_BOLD, int(h * 0.05))

    sections = [
        ("ALUNO", BRAND, "E-mail acadêmico"),
        ("ONG", GREEN, "Perfil da ONG"),
    ]
    for idx, (label, color, desc) in enumerate(sections):
        top = int(28 + idx * (h * 0.41))
        badge(draw, (24, top, int(w * 0.30), top + int(h * 0.12)), rgba(color, 40), label, color, pill_font)
        rounded_panel(img, (24, top + int(h * 0.15), w - 24, top + int(h * 0.38)), radius=22, fill=rgba("#F8FAFF"), outline=LINE, shadow_alpha=0)
        draw.text((46, top + int(h * 0.21)), desc, font=title_font, fill=INK)
        sub = "login validado para a jornada correta" if label == "ALUNO" else "CNPJ e dados institucionais conferidos"
        draw.text((46, top + int(h * 0.31)), sub, font=body_font, fill=MUTED)
        draw.ellipse((w - 92, top + int(h * 0.22), w - 36, top + int(h * 0.36)), fill=rgba(color, 35), outline=color, width=3)
        draw.line((w - 74, top + int(h * 0.30), w - 64, top + int(h * 0.33)), fill=color, width=4)
        draw.line((w - 64, top + int(h * 0.33), w - 46, top + int(h * 0.26)), fill=color, width=4)

    draw.text((28, h - 62), "login por perfil • dados validados", font=small_font, fill=MUTED)
    return img


def make_qr_visual(size: tuple[int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    rounded_panel(img, (40, 36, int(w * 0.64), h - 40), radius=34, fill=WHITE, outline=LINE, shadow_alpha=18)
    rounded_panel(img, (int(w * 0.45), int(h * 0.28), w - 36, h - 20), radius=34, fill=WHITE, outline=LINE, shadow_alpha=20)

    qr = Image.open(QR_PRESENCE).convert("RGBA")
    draw.text((82, 72), "Check-in da atividade", fill=BRAND_DEEP, font=load_font(FONT_BOLD, int(h * 0.085)))
    paste_contain(img, qr, (92, 130, int(w * 0.57), int(h * 0.66)), radius=18)
    badge(draw, (92, int(h * 0.70), int(w * 0.38), int(h * 0.82)), SOFT_CLAY, "expira em 30s", CLAY, load_font(FONT_BOLD, int(h * 0.05)))

    phone = (int(w * 0.53), int(h * 0.34), w - 78, h - 76)
    rounded_panel(img, phone, radius=42, fill=INK, outline=None, shadow_alpha=0)
    draw.rounded_rectangle((phone[0] + 14, phone[1] + 18, phone[2] - 14, phone[3] - 18), radius=30, fill=WHITE)
    notch_margin = max(24, int((phone[2] - phone[0]) * 0.28))
    draw.rounded_rectangle(
        (phone[0] + notch_margin, phone[1] + 10, phone[2] - notch_margin, phone[1] + 26),
        radius=8,
        fill="#293752",
    )
    paste_contain(img, qr, (phone[0] + 50, phone[1] + 72, phone[2] - 50, phone[3] - 90), radius=18)
    badge(draw, (phone[0] + 56, phone[3] - 66, phone[2] - 56, phone[3] - 24), SOFT_BLUE, "presença confirmada", BRAND, load_font(FONT_BOLD, int(h * 0.048)))
    return img


def add_header(base: Image.Image, kicker: str, title: str, subtitle: str | None = None, centered: bool = False) -> None:
    draw = ImageDraw.Draw(base)
    w, _ = base.size
    kicker_font = load_font(FONT_BOLD, 26)
    title_font = load_font(FONT_BOLD, 74)
    subtitle_font = load_font(FONT_REGULAR, 28)
    if centered:
        kw = draw.textlength(kicker, font=kicker_font)
        badge(draw, (int((w - kw - 52) / 2), 52, int((w + kw + 52) / 2), 98), SOFT_BLUE, kicker, BRAND, kicker_font)
        tw = draw.textlength(title, font=title_font)
        draw.text(((w - tw) / 2, 134), title, font=title_font, fill=INK)
        if subtitle:
            sw = draw.textlength(subtitle, font=subtitle_font)
            draw.text(((w - sw) / 2, 228), subtitle, font=subtitle_font, fill=MUTED)
    else:
        draw_brand_mark(base, 74, 42, 0.72)
        badge(draw, (74, 130, 268, 174), SOFT_BLUE, kicker, BRAND, kicker_font)
        draw_multiline(draw, (74, 208), title, title_font, INK, 940, spacing=82, max_lines=2)
        if subtitle:
            draw_multiline(draw, (74, 360), subtitle, subtitle_font, MUTED, 840, spacing=40, max_lines=2)


def draw_tag_row(draw: ImageDraw.ImageDraw, x: int, y: int, tags: list[tuple[str, str, str]]) -> None:
    font = load_font(FONT_BOLD, 20)
    cursor = x
    for label, fill, color in tags:
        width = int(draw.textlength(label, font=font) + 46)
        badge(draw, (cursor, y, cursor + width, y + 40), fill, label, color, font)
        cursor += width + 12


def make_slide_7(size: tuple[int, int]) -> Image.Image:
    img = make_gradient(size)
    draw = ImageDraw.Draw(img)
    add_header(
        img,
        "Solução criada",
        "A Solução: MaisHoras",
        "Um fluxo visual único para o aluno encontrar vagas, para a ONG validar presença e para a universidade verificar horas.",
    )

    student_main, student_summary = student_assets()
    org_main, org_summary = ong_assets()

    rounded_panel(img, (74, 430, 1040, 930), radius=34, fill=WHITE, outline=LINE, shadow_alpha=26)
    paste_contain(img, student_main, (108, 462, 980, 876), radius=24)
    badge(draw, (110, 880, 270, 920), SOFT_BLUE, "Painel do aluno", BRAND, load_font(FONT_BOLD, 20))

    rounded_panel(img, (720, 670, 1040, 930), radius=30, fill=WHITE, outline=LINE, shadow_alpha=28)
    paste_contain(img, org_summary, (744, 696, 1016, 884), radius=22)
    badge(draw, (760, 888, 966, 924), SOFT_CLAY, "Resumo da ONG", CLAY, load_font(FONT_BOLD, 18))

    rounded_panel(img, (930, 400, 1160, 610), radius=28, fill=WHITE, outline=LINE, shadow_alpha=22)
    paste_contain(img, org_main, (952, 422, 1138, 584), radius=22)

    cards = [
        ("01", "Aluno encontra vagas", "Busca oportunidades, horas e certificados no mesmo painel.", [("vagas", SOFT_BLUE, BRAND), ("horas", SOFT_BLUE, BRAND), ("QR", SOFT_CLAY, CLAY)]),
        ("02", "ONG publica e valida", "Organiza atividade, inscritos e presença sem planilha paralela.", [("atividade", SOFT_BLUE, BRAND), ("presença", SOFT_CLAY, CLAY), ("controle", SOFT_GREEN, GREEN)]),
        ("03", "Certificado verificável", "Após a validação, libera comprovante com código e QR.", [("código único", SOFT_BLUE, BRAND), ("consulta pública", SOFT_GREEN, GREEN)]),
    ]

    start_y = 408
    for idx, (num, title, desc, tags) in enumerate(cards):
        y = start_y + idx * 178
        rounded_panel(img, (1130, y, 1718, y + 160), radius=28, fill=WHITE, outline=LINE, shadow_alpha=18)
        draw.ellipse((1160, y + 28, 1220, y + 88), fill=BRAND if idx < 2 else CLAY)
        num_font = load_font(FONT_BOLD, 28)
        tw = draw.textlength(num, font=num_font)
        draw.text((1190 - tw / 2, y + 42), num, font=num_font, fill=WHITE)
        draw.text((1244, y + 24), title, font=load_font(FONT_BOLD, 32), fill=INK)
        draw_multiline(draw, (1244, y + 68), desc, load_font(FONT_REGULAR, 20), MUTED, 420, spacing=26, max_lines=2)
        draw_tag_row(draw, 1244, y + 118, tags)

    rounded_panel(img, (1130, 936, 1718, 988), radius=26, fill=BRAND_DEEP, outline=None, shadow_alpha=0)
    draw.text((1162, 950), "Menos papelada, mais prova real de participação.", font=load_font(FONT_BOLD, 24), fill=WHITE)
    return img


def make_feature_card(base: Image.Image, box: tuple[int, int, int, int], label: str, title: str, desc: str, asset: Image.Image, accent: str) -> None:
    rounded_panel(base, box, radius=30, fill=WHITE, outline=LINE, shadow_alpha=18)
    draw = ImageDraw.Draw(base)
    x1, y1, x2, y2 = box
    badge(draw, (x1 + 28, y1 + 24, x1 + 162, y1 + 62), rgba(accent, 34), label, accent, load_font(FONT_BOLD, 18))
    paste_contain(base, asset, (x1 + 28, y1 + 86, x2 - 28, y1 + 266), radius=22)
    draw.text((x1 + 28, y1 + 286), title, font=load_font(FONT_BOLD, 32), fill=INK)
    draw_multiline(draw, (x1 + 28, y1 + 332), desc, load_font(FONT_REGULAR, 22), MUTED, x2 - x1 - 56, spacing=28, max_lines=2)


def make_slide_8(size: tuple[int, int]) -> Image.Image:
    img = make_gradient(size)
    add_header(
        img,
        "Resultados e ferramentas",
        "O produto em ação",
        "Aluno, ONG e certificado funcionando dentro do mesmo fluxo digital.",
        centered=True,
    )

    student_main, student_summary = student_assets()
    org_main, org_summary = ong_assets()
    cert_card = make_certificate_card((560, 320))

    make_feature_card(
        img,
        (88, 310, 562, 744),
        "Aluno",
        "Descobre e acompanha",
        "Horas validadas, certificados e inscrições no mesmo lugar.",
        student_summary,
        BRAND,
    )
    make_feature_card(
        img,
        (664, 310, 1138, 744),
        "ONG",
        "Publica e valida",
        "Gestão das vagas e confirmação de presença sem retrabalho.",
        org_main,
        CLAY,
    )
    make_feature_card(
        img,
        (1240, 310, 1714, 744),
        "Certificado",
        "Comprovação pública",
        "QR Code e código único para validar a participação depois do evento.",
        cert_card,
        GREEN,
    )

    rounded_panel(img, (88, 818, 1714, 1120), radius=34, fill=WHITE, outline=LINE, shadow_alpha=16)
    draw = ImageDraw.Draw(img)
    draw.text((126, 854), "Fluxo principal do produto", font=load_font(FONT_BOLD, 32), fill=INK)

    steps = [
        ("1", "Vaga publicada", BRAND),
        ("2", "Inscrição", BRAND),
        ("3", "Check-in QR", CLAY),
        ("4", "Certificado", GREEN),
        ("5", "Validação pública", BRAND_DEEP),
    ]
    circle_y = 968
    start_x = 164
    gap = 318
    step_font = load_font(FONT_BOLD, 22)
    number_font = load_font(FONT_BOLD, 28)
    for idx, (num, label, color) in enumerate(steps):
        cx = start_x + idx * gap
        draw.ellipse((cx - 34, circle_y - 34, cx + 34, circle_y + 34), fill=color)
        tw = draw.textlength(num, font=number_font)
        draw.text((cx - tw / 2, circle_y - 18), num, font=number_font, fill=WHITE)
        label_lines = text_wrap(label, width=14)
        for line_idx, line in enumerate(label_lines[:2]):
            lw = draw.textlength(line, font=step_font)
            draw.text((cx - lw / 2, 1060 + line_idx * 28), line, font=step_font, fill=INK)
        if idx < len(steps) - 1:
            draw.line((cx + 52, circle_y, cx + gap - 52, circle_y), fill=LINE, width=6)

    caption = "Da atividade publicada até a comprovação final, cada etapa deixa menos ruído e mais confiança."
    cap_font = load_font(FONT_REGULAR, 24)
    cap_width = draw.textlength(caption, font=cap_font)
    draw.text(((img.size[0] - cap_width) / 2, 1010), caption, font=cap_font, fill=MUTED)
    return img


def make_challenge_card(base: Image.Image, box: tuple[int, int, int, int], number: str, title: str, subtitle: str, visual: Image.Image, bullets: list[tuple[str, str, str]]) -> None:
    rounded_panel(base, box, radius=34, fill=WHITE, outline=LINE, shadow_alpha=18)
    draw = ImageDraw.Draw(base)
    x1, y1, x2, y2 = box
    draw.ellipse((x1 + 28, y1 + 30, x1 + 96, y1 + 98), fill=BRAND_DEEP)
    tw = draw.textlength(number, font=load_font(FONT_BOLD, 28))
    draw.text((x1 + 62 - tw / 2, y1 + 46), number, font=load_font(FONT_BOLD, 28), fill=WHITE)
    draw_multiline(draw, (x1 + 116, y1 + 36), title, load_font(FONT_BOLD, 34), INK, x2 - x1 - 152, spacing=38, max_lines=2)
    draw_multiline(draw, (x1 + 38, y1 + 126), subtitle, load_font(FONT_REGULAR, 22), MUTED, x2 - x1 - 76, spacing=30, max_lines=2)
    paste_contain(base, visual, (x1 + 34, y1 + 208, x2 - 34, y1 + 540), radius=28)
    bullet_font = load_font(FONT_BOLD, 20)
    body_font = load_font(FONT_REGULAR, 19)
    for idx, (label, color, detail) in enumerate(bullets):
        yy = y1 + 582 + idx * 86
        draw.ellipse((x1 + 38, yy + 12, x1 + 58, yy + 32), fill=color)
        draw.text((x1 + 76, yy), label, font=bullet_font, fill=INK)
        draw_multiline(draw, (x1 + 76, yy + 28), detail, body_font, MUTED, x2 - x1 - 116, spacing=24, max_lines=2)


def make_slide_9(size: tuple[int, int]) -> Image.Image:
    img = make_gradient(size)
    add_header(
        img,
        "Desafios tecnológicos",
        "Prova técnica do produto",
        "Os três pontos mais sensíveis do sistema foram tratados com segurança e rastreabilidade.",
        centered=True,
    )

    cert_visual = make_certificate_card((420, 300))
    auth_visual = make_auth_visual((420, 300))
    qr_visual = make_qr_visual((420, 300))

    make_challenge_card(
        img,
        (86, 282, 560, 1128),
        "1",
        "Autenticação de aluno e ONG",
        "Perfis diferentes precisam entrar com regras e jornadas diferentes.",
        auth_visual,
        [("acesso por perfil", BRAND, "aluno e ONG entram em jornadas separadas"), ("dados validados", GREEN, "e-mail acadêmico e perfil institucional"), ("rotas separadas", CLAY, "menos risco de usuário no fluxo errado")],
    )
    make_challenge_card(
        img,
        (664, 282, 1138, 1128),
        "2",
        "Validação de presença via QR",
        "O check-in precisa confirmar quem esteve presente sem abrir brecha para fraude.",
        qr_visual,
        [("QR dinâmico", CLAY, "código temporário para presença real"), ("tempo curto", BRAND, "check-in rápido no momento do evento"), ("menos fraude", GREEN, "reduz repasse indevido de comprovantes")],
    )
    make_challenge_card(
        img,
        (1242, 282, 1716, 1128),
        "3",
        "Certificado verificável",
        "A comprovação precisa continuar íntegra depois da ação social ser concluída.",
        cert_visual,
        [("código único", BRAND, "cada certificado nasce com verificação pública"), ("consulta pública", GREEN, "coordenação confere sem depender do PDF"), ("QR no comprovante", CLAY, "validação imediata para qualquer leitor")],
    )
    return img


def make_future_card(base: Image.Image, box: tuple[int, int, int, int], pill_text: str, pill_fill: str, pill_color: str, title: str, desc: str, accent_text: str) -> None:
    rounded_panel(base, box, radius=32, fill=WHITE, outline=LINE, shadow_alpha=18)
    draw = ImageDraw.Draw(base)
    x1, y1, x2, y2 = box
    badge(draw, (x1 + 28, y1 + 28, x1 + 148, y1 + 66), pill_fill, pill_text, pill_color, load_font(FONT_BOLD, 18))
    draw_multiline(draw, (x1 + 28, y1 + 98), title, load_font(FONT_BOLD, 36), INK, x2 - x1 - 56, spacing=40, max_lines=2)
    draw_multiline(draw, (x1 + 28, y1 + 190), desc, load_font(FONT_REGULAR, 22), MUTED, x2 - x1 - 56, spacing=30, max_lines=2)
    rounded_panel(base, (x1 + 28, y2 - 88, x2 - 28, y2 - 30), radius=20, fill=pill_color, outline=None, shadow_alpha=0)
    draw.text((x1 + 52, y2 - 74), accent_text, font=load_font(FONT_BOLD, 22), fill=WHITE)


def make_slide_10(size: tuple[int, int]) -> Image.Image:
    img = make_gradient(size)
    draw = ImageDraw.Draw(img)
    draw_brand_mark(img, 74, 42, 0.72)
    badge(draw, (74, 130, 268, 174), SOFT_BLUE, "Perspectivas futuras", BRAND, load_font(FONT_BOLD, 26))
    draw_multiline(draw, (74, 208), "Evolução natural do\nMaisHoras", load_font(FONT_BOLD, 68), INK, 760, spacing=74, max_lines=2)
    draw_multiline(
        draw,
        (74, 416),
        "A base do produto já permite crescer para outras instituições, ganhar mobilidade e recomendar melhor as oportunidades.",
        load_font(FONT_REGULAR, 26),
        MUTED,
        860,
        spacing=34,
        max_lines=2,
    )

    make_future_card(
        img,
        (74, 500, 566, 834),
        "Rede",
        SOFT_BLUE,
        BRAND,
        "Escalar para novas faculdades",
        "Levar a mesma lógica para outros campi e ampliar a oferta de ações sociais.",
        "expansão interinstitucional",
    )
    make_future_card(
        img,
        (654, 500, 1146, 834),
        "App",
        SOFT_CLAY,
        CLAY,
        "Versão mobile para aluno e ONG",
        "Acesso rápido ao painel, check-in e validação de presença em qualquer lugar.",
        "jornada mais rápida no celular",
    )
    make_future_card(
        img,
        (1234, 500, 1726, 834),
        "IA",
        SOFT_GREEN,
        GREEN,
        "Recomendação de vagas por perfil",
        "Sugerir atividades com base em interesse, histórico e disponibilidade.",
        "sugestões mais relevantes",
    )

    rounded_panel(img, (74, 892, 1726, 960), radius=28, fill=BRAND_DEEP, outline=None, shadow_alpha=0)
    draw.text((110, 913), "Produto pronto para piloto, expansão mobile e novas camadas de inteligência.", font=load_font(FONT_BOLD, 28), fill=WHITE)
    return img


def cover_watermark(page: fitz.Page, page_number: int) -> None:
    rect = page.rect
    if page_number == 3:
        x1, y1, x2, y2 = (
            rect.width * 0.835,
            rect.height * 0.928,
            rect.width * 0.997,
            rect.height * 0.982,
        )
    else:
        x1, y1, x2, y2 = (
            rect.width * 0.858,
            rect.height * 0.932,
            rect.width * 0.994,
            rect.height * 0.978,
        )
    fill = (1, 1, 1)
    radius = (y2 - y1) / 2
    page.draw_rect(fitz.Rect(x1 + radius, y1, x2 - radius, y2), color=fill, fill=fill, overlay=True, width=0)
    page.draw_oval(fitz.Rect(x1, y1, x1 + radius * 2, y2), color=fill, fill=fill, overlay=True, width=0)
    page.draw_oval(fitz.Rect(x2 - radius * 2, y1, x2, y2), color=fill, fill=fill, overlay=True, width=0)


def render_replacement_pages(pdf: fitz.Document) -> dict[int, Path]:
    replacements: dict[int, Path] = {}
    makers = {
        7: make_slide_7,
        8: make_slide_8,
        9: make_slide_9,
        10: make_slide_10,
    }
    for page_number, maker in makers.items():
        page = pdf.load_page(page_number - 1)
        width = round(page.rect.width * 2)
        height = round(page.rect.height * 2)
        image = maker((width, height))
        path = TEMP_DIR / f"page-{page_number:02d}.png"
        image.convert("RGB").save(path, quality=95)
        replacements[page_number] = path
    return replacements


def build_pdf() -> Path:
    doc = fitz.open(SOURCE_PDF)
    replacements = render_replacement_pages(doc)

    for page_number, page in enumerate(doc, start=1):
        if page_number in replacements:
            page.draw_rect(page.rect, color=(1, 1, 1), fill=(1, 1, 1), overlay=True, width=0)
            page.insert_image(page.rect, filename=str(replacements[page_number]), overlay=True)
        else:
            cover_watermark(page, page_number)

    doc.save(OUTPUT_PDF, deflate=True, garbage=4)
    doc.close()
    return OUTPUT_PDF


if __name__ == "__main__":
    print(build_pdf())

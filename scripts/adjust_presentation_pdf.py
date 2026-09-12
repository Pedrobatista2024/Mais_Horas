from __future__ import annotations

from pathlib import Path

import fitz
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE_PDF = Path(r"C:\Users\ismae\OneDrive\Documents\apresen-final23062026.pdf")
OUTPUT_PDF = SOURCE_PDF.with_name("apresen-final23062026-ajustada.pdf")
TEMP_DIR = ROOT / ".codex-temp" / "presentation-adjust"
TEMP_DIR.mkdir(parents=True, exist_ok=True)

SLIDE_REPLACEMENTS = {
    7: ROOT / "presentation" / "slides" / "slide-08.png",
    8: ROOT / "presentation" / "slides" / "slide-09.png",
    9: ROOT / "presentation" / "slides" / "slide-10.png",
}

SLIDE_BG = "#F3F6FC"
MUTED = "#64748F"
FONT_REGULAR = Path(r"C:\Windows\Fonts\segoeui.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\segoeuib.ttf")


def load_font(path: Path, size: int) -> ImageFont.ImageFont:
    try:
        return ImageFont.truetype(str(path), size)
    except OSError:
        return ImageFont.load_default()


def cover_watermark(page: fitz.Page) -> None:
    rect = page.rect
    mask = fitz.Rect(
        rect.width * 0.82,
        rect.height * 0.90,
        rect.width * 0.995,
        rect.height * 0.992,
    )
    page.draw_rect(mask, color=(1, 1, 1), fill=(1, 1, 1), overlay=True, width=0)


def prepare_slide(slide_path: Path, visible_number: int) -> Image.Image:
    slide = Image.open(slide_path).convert("RGB")
    draw = ImageDraw.Draw(slide)

    # Remove o numero original do slide para reaproveitar o visual no novo fluxo.
    number_box = (1735, 34, 1888, 118)
    draw.rounded_rectangle(number_box, radius=24, fill=SLIDE_BG)

    font = load_font(FONT_BOLD, 44)
    draw.text((1780, 46), f"{visible_number:02d}", fill=MUTED, font=font)
    return slide


def build_page_image(page: fitz.Page, slide_path: Path, visible_number: int) -> Path:
    page_width = round(page.rect.width * 2)
    page_height = round(page.rect.height * 2)

    slide = prepare_slide(slide_path, visible_number)
    canvas = Image.new("RGB", (page_width, page_height), SLIDE_BG)

    scale = min(page_width / slide.width, page_height / slide.height)
    resized = slide.resize(
        (round(slide.width * scale), round(slide.height * scale)),
        Image.Resampling.LANCZOS,
    )
    offset = ((page_width - resized.width) // 2, (page_height - resized.height) // 2)
    canvas.paste(resized, offset)

    out_path = TEMP_DIR / f"page-{visible_number:02d}.png"
    canvas.save(out_path, optimize=True)
    return out_path


def adjust_pdf() -> Path:
    doc = fitz.open(SOURCE_PDF)
    replacement_assets: dict[int, Path] = {}

    for page_number, slide_path in SLIDE_REPLACEMENTS.items():
        replacement_assets[page_number] = build_page_image(
            doc.load_page(page_number - 1),
            slide_path,
            page_number,
        )

    for page_index, page in enumerate(doc, start=1):
        if page_index in replacement_assets:
            page.draw_rect(page.rect, color=(1, 1, 1), fill=(1, 1, 1), overlay=True, width=0)
            page.insert_image(page.rect, filename=str(replacement_assets[page_index]), overlay=True)
            continue

        cover_watermark(page)

    doc.save(OUTPUT_PDF, deflate=True, garbage=4)
    doc.close()
    return OUTPUT_PDF


if __name__ == "__main__":
    result = adjust_pdf()
    print(result)

#!/usr/bin/env python3
"""
Zuzzkin's Kitchen — Avery 5360 ingredient label generator.

Usage:
  python3 make-label.py "Product Name" "Ingredient 1, Ingredient 2" [output.pdf] ["Dominant ingredient from"] ["$8.00"]

Produces one Letter page with 21 labels, 3 columns × 7 rows, sized for Avery 5360
(2-13/16" × 1-1/2"). The licensed YAMAS OTF is rendered into the PDF as image
art for brand text because ReportLab cannot embed this CFF-flavored OTF directly.
"""

from __future__ import annotations

from io import BytesIO
import os
import re
import sys

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

try:
    from PIL import Image, ImageDraw, ImageFont
except Exception:  # pragma: no cover - label generation still has a fallback
    Image = ImageDraw = ImageFont = None

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LABELS_DIR = os.path.join(SCRIPT_DIR, "labels")
YAMAS_OTF = os.path.join(SCRIPT_DIR, "public", "fonts", "yamas", "TAYYamasRegular.otf")

# Avery 5360: 3 × 7, 2-13/16" × 1-1/2".
# The 2-13/16" width leaves only 1/16" spare across three columns on US Letter,
# so the template uses 1/32" side margins and no horizontal gutter. A previous
# 3/16" margin + 1/16" gutter layout overflowed the page and clipped the right
# column, which is exactly what Jess flagged.
PAGE_W, PAGE_H = letter
LABEL_W = 2.8125 * inch
LABEL_H = 1.5 * inch
LEFT_MARGIN = 0.03125 * inch
TOP_MARGIN = 0.5 * inch
H_GAP = 0.0 * inch
COL_X = [LEFT_MARGIN + i * (LABEL_W + H_GAP) for i in range(3)]
ROW_Y = [PAGE_H - TOP_MARGIN - LABEL_H - i * LABEL_H for i in range(7)]

BROWN = colors.HexColor("#3D2B1F")
BLACK = colors.HexColor("#222222")
MUTED = colors.HexColor("#4F4A42")
RULE = colors.HexColor("#777777")

PHONE = "(615) 378-7574"
ADDRESS = "Hwy 70, Kingston Springs TN 37082"
DISCLAIMER = (
    "This product was produced at a private residence that is exempt from state "
    "licensing and inspection. This product may contain allergens."
)
WEBSITE = "ZUZZKINS.COM"
BRAND = "ZUZZKIN'S"

_yamas_cache: dict[tuple[str, int, str], ImageReader] = {}


def slugify(value: str) -> str:
    value = value.lower().replace("'", "")
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value or "label"


def color_to_hex(color: colors.Color) -> str:
    return "#{:02x}{:02x}{:02x}".format(
        int(color.red * 255),
        int(color.green * 255),
        int(color.blue * 255),
    )


def yamas_image(text: str, font_size: int, fill: colors.Color) -> ImageReader | None:
    """Render YAMAS text to transparent artwork for reliable PDF output."""
    if Image is None or ImageDraw is None or ImageFont is None or not os.path.exists(YAMAS_OTF):
        return None

    key = (text, font_size, color_to_hex(fill))
    if key in _yamas_cache:
        return _yamas_cache[key]

    font = ImageFont.truetype(YAMAS_OTF, font_size)
    scratch = Image.new("RGBA", (1, 1), (255, 255, 255, 0))
    draw = ImageDraw.Draw(scratch)
    bbox = draw.textbbox((0, 0), text, font=font)
    width = max(1, bbox[2] - bbox[0])
    height = max(1, bbox[3] - bbox[1])
    pad = max(8, font_size // 3)
    image = Image.new("RGBA", (width + pad * 2, height + pad * 2), (255, 255, 255, 0))
    draw = ImageDraw.Draw(image)
    draw.text((pad - bbox[0], pad - bbox[1]), text, font=font, fill=color_to_hex(fill))

    buf = BytesIO()
    image.save(buf, format="PNG")
    buf.seek(0)
    reader = ImageReader(buf)
    _yamas_cache[key] = reader
    return reader


def draw_yamas(
    c: canvas.Canvas,
    text: str,
    x: float,
    y: float,
    max_width: float,
    max_height: float,
    *,
    font_size: int = 42,
    fill: colors.Color = BROWN,
    align: str = "center",
) -> float:
    """Draw YAMAS text and return the drawn width in points."""
    image = yamas_image(text, font_size, fill)
    if image is None:
        c.setFillColor(fill)
        c.setFont("Helvetica-BoldOblique", min(max_height, 10))
        text_width = min(max_width, c.stringWidth(text, "Helvetica-BoldOblique", min(max_height, 10)))
        draw_x = x - text_width / 2 if align == "center" else x
        c.drawString(draw_x, y, text)
        return text_width

    img_width, img_height = image.getSize()
    scale = min(max_width / img_width, max_height / img_height)
    draw_width = img_width * scale
    draw_height = img_height * scale
    draw_x = x - draw_width / 2 if align == "center" else x
    c.drawImage(image, draw_x, y, width=draw_width, height=draw_height, mask="auto")
    return draw_width


def wrap_text(c: canvas.Canvas, text: str, font: str, size: float, max_width: float) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        test = f"{current} {word}".strip()
        if c.stringWidth(test, font, size) <= max_width:
            current = test
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def draw_centered(c: canvas.Canvas, text: str, y: float, font: str, size: float, center_x: float) -> None:
    c.setFont(font, size)
    c.drawCentredString(center_x, y, text)


def draw_label(
    c: canvas.Canvas,
    x: float,
    y: float,
    product_name: str,
    ingredients: str,
    produce_label: str,
    price: str,
) -> None:
    pad_x = 10
    left = x + pad_x
    right = x + LABEL_W - pad_x
    center = x + LABEL_W / 2
    width = right - left

    c.saveState()
    # Avery 5360 cut boundary. Jess asked to see the boundaries so she can
    # confirm the labels print centered on the physical template.
    c.setStrokeColor(colors.HexColor("#B8B0A6"))
    c.setLineWidth(0.35)
    c.rect(x, y, LABEL_W, LABEL_H, stroke=1, fill=0)

    clip = c.beginPath()
    clip.rect(x, y, LABEL_W, LABEL_H)
    c.clipPath(clip, stroke=0, fill=0)

    # Product name at the top. Jess asked to remove the standalone Zuzzkin's
    # brand from the top and shift the label text upward.
    c.setFillColor(BLACK)
    draw_centered(c, product_name, y + 92.0, "Helvetica-Bold", 10.8, center)

    # Ingredients.
    c.setFont("Helvetica", 5.9)
    ingredient_lines = wrap_text(c, f"Ingredients: {ingredients}", "Helvetica", 5.9, width)
    for i, line in enumerate(ingredient_lines[:3]):
        c.drawString(left, y + 80.5 - i * 6.5, line)

    # Dominant ingredient line for Jess to handwrite the farm/source.
    from_y = y + 59.0
    c.setFillColor(BLACK)
    c.setFont("Helvetica", 6.0)
    label_text = f"{produce_label} from"
    c.drawString(left, from_y, label_text)
    line_start = left + c.stringWidth(label_text, "Helvetica", 6.0) + 4
    c.setStrokeColor(RULE)
    c.setLineWidth(0.45)
    c.line(line_start, from_y - 1, right, from_y - 1)

    # Homemade line, with ZUZZKINS rendered in YAMAS.
    made_y = y + 44.5
    c.setFillColor(BLACK)
    c.setFont("Helvetica", 5.8)
    made_text = "Homemade with love at "
    made_width = c.stringWidth(made_text, "Helvetica", 5.8)
    yamas_width_estimate = 54
    start = center - (made_width + yamas_width_estimate) / 2
    c.drawString(start, made_y, made_text)
    draw_yamas(c, BRAND, start + made_width + 1, made_y - 3.0, 65, 12.0, font_size=70, fill=BLACK, align="left")

    # Contact + legal, intentionally smaller and italic.
    c.setFillColor(MUTED)
    c.setFont("Helvetica-Oblique", 3.65)
    contact = f"{PHONE} · {ADDRESS} · {DISCLAIMER}"
    for i, line in enumerate(wrap_text(c, contact, "Helvetica-Oblique", 3.65, width)[:3]):
        c.drawCentredString(center, y + 34.0 - i * 4.25, line)

    # Website: actual YAMAS artwork, uppercase per Jess's label direction.
    draw_yamas(c, WEBSITE, center, y + 13.3, width * 0.82, 12.5, font_size=76, fill=BROWN)

    # Clear price at the bottom, parallel with website/product pricing.
    c.setFillColor(BLACK)
    c.setFont("Helvetica-Bold", 8.0)
    c.drawCentredString(center, y + 4.0, price)

    c.restoreState()


def make_label_pdf(
    product_name: str,
    ingredients: str,
    output_path: str,
    produce_label: str | None = None,
    price: str = "",
) -> None:
    if produce_label is None:
        produce_label = ingredients.split(",")[0].strip()

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    c = canvas.Canvas(output_path, pagesize=letter)
    for y in ROW_Y:
        for x in COL_X:
            draw_label(c, x, y, product_name, ingredients, produce_label, price)
    c.save()
    print(f"Saved: {output_path}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print((__doc__ or "").strip())
        sys.exit(1)

    product = sys.argv[1]
    ingredients = sys.argv[2]
    output = sys.argv[3] if len(sys.argv) >= 4 else os.path.join(LABELS_DIR, f"{slugify(product)}.pdf")
    produce = sys.argv[4] if len(sys.argv) >= 5 else None
    price = sys.argv[5] if len(sys.argv) >= 6 else ""
    make_label_pdf(product, ingredients, output, produce, price)

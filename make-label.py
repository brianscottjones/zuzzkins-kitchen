#!/usr/bin/env python3
"""
Zuzzkin's Kitchen — Avery 5360 ingredient label generator.

Usage:
  python3 make-label.py "Product Name" "Ingredient 1, Ingredient 2" [output.pdf] ["Dominant ingredient from"]

Produces one Letter page with 21 labels, 3 columns × 7 rows, sized for Avery 5360
(1-1/2" × 2-13/16").
"""

from __future__ import annotations

import os
import re
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LABELS_DIR = os.path.join(SCRIPT_DIR, "labels")
YAMAS_OTF = os.path.join(SCRIPT_DIR, "public", "fonts", "yamas", "TAYYamasRegular.otf")
YAMAS_FONT = "Yamas"

# Avery 5360: 3 × 7, 2-13/16" × 1-1/2". These coordinates match the
# Avery template: 0.1875" left margin, 0.5" top/bottom margins, 0.0625" gutters.
PAGE_W, PAGE_H = letter
LABEL_W = 2.8125 * inch
LABEL_H = 1.5 * inch
LEFT_MARGIN = 0.1875 * inch
TOP_MARGIN = 0.5 * inch
H_GAP = 0.0625 * inch
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
WEBSITE = "zuzzkins.com"


def register_fonts() -> None:
    if os.path.exists(YAMAS_OTF):
        try:
            pdfmetrics.registerFont(TTFont(YAMAS_FONT, YAMAS_OTF))
            return
        except Exception:
            pass
    # Fallback keeps generation working if the licensed font is absent.
    globals()["YAMAS_FONT"] = "Helvetica-Oblique"


def slugify(value: str) -> str:
    value = value.lower().replace("'", "")
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value or "label"


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


def draw_label(c: canvas.Canvas, x: float, y: float, product_name: str, ingredients: str, produce_label: str) -> None:
    pad_x = 9
    left = x + pad_x
    right = x + LABEL_W - pad_x
    width = right - left

    # Product name
    c.setFillColor(BLACK)
    c.setFont("Helvetica-Bold", 7.6)
    c.drawString(left, y + 95, product_name)

    # Ingredients. Two lines max leaves room for the legal/disclaimer block below.
    c.setFont("Helvetica", 6.0)
    for i, line in enumerate(wrap_text(c, f"Ingredients: {ingredients}", "Helvetica", 6.0, width)[:2]):
        c.drawString(left, y + 85 - i * 7, line)

    # Homemade line, using Yamas only for the brand word.
    made_y = y + 62
    c.setFont("Helvetica", 6.2)
    c.drawString(left, made_y, "Homemade with love at ")
    prefix_w = c.stringWidth("Homemade with love at ", "Helvetica", 6.2)
    c.setFont(YAMAS_FONT, 8.0)
    c.drawString(left + prefix_w, made_y - 0.8, "Zuzzkin's")

    # Contact + legal, intentionally smaller/italic.
    c.setFillColor(MUTED)
    c.setFont("Helvetica-Oblique", 3.7)
    contact = f"{PHONE} · {ADDRESS} · {DISCLAIMER}"
    for i, line in enumerate(wrap_text(c, contact, "Helvetica-Oblique", 3.7, width)[:3]):
        c.drawString(left, y + 47 - i * 4.4, line)

    # Dominant ingredient line for handwriting.
    from_y = y + 30
    c.setFillColor(BLACK)
    c.setFont("Helvetica", 6.0)
    label_text = f"{produce_label} from"
    c.drawString(left, from_y, label_text)
    line_start = left + c.stringWidth(label_text, "Helvetica", 6.0) + 4
    c.setStrokeColor(RULE)
    c.setLineWidth(0.45)
    c.line(line_start, from_y - 1, right, from_y - 1)

    # Website, using Yamas as requested.
    c.setFillColor(BROWN)
    c.setFont(YAMAS_FONT, 7.8)
    c.drawString(left, y + 10, WEBSITE)


def make_label_pdf(product_name: str, ingredients: str, output_path: str, produce_label: str | None = None) -> None:
    register_fonts()
    if produce_label is None:
        produce_label = ingredients.split(",")[0].strip()

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    c = canvas.Canvas(output_path, pagesize=letter)
    for y in ROW_Y:
        for x in COL_X:
            draw_label(c, x, y, product_name, ingredients, produce_label)
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
    make_label_pdf(product, ingredients, output, produce)

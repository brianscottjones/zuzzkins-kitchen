#!/usr/bin/env python3
"""
Zuzzkin's Kitchen — Label Generator (v8 template)
Usage: python3 make-label.py "Product Name" "Ingredient 1, Ingredient 2" [output.pdf]

Produces a 2.8125" x 1.5" horizontal label sheet (21 labels, 3x7) in v8 format:
  - Circular logo (left)
  - Product name (bold brown)
  - Pink rule (equal spacing above/below)
  - Ingredients
  - Light rule
  - Made by Zuzzkin's Kitchen
  - Address & phone (tiny, 2 lines)
  - Light rule
  - Legal disclaimer
  - "Strawberries/[produce] from: ___" line (pinned to bottom)
"""

import sys
import os
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LOGO = os.path.join(SCRIPT_DIR, "public", "logo.jpg")
LABELS_DIR = os.path.join(SCRIPT_DIR, "labels")

def make_label_pdf(product_name, ingredients, output_path, produce_line=None):
    """
    product_name:  e.g. "Strawberry Preserves"
    ingredients:   e.g. "Strawberries, Sugar"
    output_path:   e.g. "/path/to/strawberry-preserves.pdf"
    produce_line:  e.g. "Strawberries from:" (auto-generated if None)
    """
    if produce_line is None:
        first_ingredient = ingredients.split(",")[0].strip()
        produce_line = f"{first_ingredient} from:"

    PAGE_W, PAGE_H = letter
    LABEL_W = 2.8125 * inch
    LABEL_H = 1.5 * inch
    COLS = 3
    ROWS = 7

    # Avery 5360 exact margins
    LEFT_MARGIN = 0.25 * inch
    TOP_MARGIN  = 0.5  * inch
    H_PITCH     = 2.875 * inch  # label + 0.0625" gap
    TOP_MARGIN  = (PAGE_H - ROWS * LABEL_H) / 2

    BROWN = colors.HexColor("#5C3D2E")
    ROSE  = colors.HexColor("#C0666F")
    MUTED = colors.HexColor("#8A7060")
    BLACK = colors.HexColor("#222222")
    LGRAY = colors.HexColor("#CCCCCC")
    DGRAY = colors.HexColor("#AAAAAA")

    c = canvas.Canvas(output_path, pagesize=letter)

    def draw_circular_logo(c, cx, cy, r):
        c.saveState()
        p = c.beginPath()
        p.circle(cx, cy, r)
        c.clipPath(p, stroke=0, fill=0)
        try:
            img = ImageReader(LOGO)
            c.drawImage(img, cx - r, cy - r, width=2*r, height=2*r,
                        preserveAspectRatio=False, mask='auto')
        except:
            c.setFillColor(BROWN)
            c.circle(cx, cy, r, fill=1, stroke=0)
        c.restoreState()

    def wrap_text(c, font, size, text, max_w):
        words = text.split()
        lines = []
        line = ""
        for word in words:
            test = (line + " " + word).strip()
            if c.stringWidth(test, font, size) <= max_w:
                line = test
            else:
                if line:
                    lines.append(line)
                line = word
        if line:
            lines.append(line)
        return lines

    def draw_label(c, x, y):
        OUTER_PAD = 0.11 * inch
        INNER_SEP = 0.08 * inch
        RULE_GAP  = 0.07 * inch

        LOGO_R = (LABEL_H * 0.55) / 2
        logo_cx = x + OUTER_PAD + LOGO_R
        logo_cy = y + LABEL_H / 2
        # Label border
        c.setStrokeColor(LGRAY)
        c.setLineWidth(0.3)
        c.rect(x, y, LABEL_W, LABEL_H)
        draw_circular_logo(c, logo_cx, logo_cy, LOGO_R)

        TX  = logo_cx + LOGO_R + INNER_SEP
        TR  = x + LABEL_W - OUTER_PAD
        TW  = TR - TX
        TCX = TX + TW / 2


        cursor = y + LABEL_H - OUTER_PAD

        # Product name
        FS_PROD = 9
        c.setFont("Helvetica-Bold", FS_PROD)
        c.setFillColor(BROWN)
        cursor -= FS_PROD * 0.95
        c.drawCentredString(TCX, cursor, product_name)
        cursor -= RULE_GAP

        # Pink rule
        c.setStrokeColor(ROSE)
        c.setLineWidth(0.8)
        c.line(TX, cursor, TR, cursor)
        cursor -= RULE_GAP

        # Ingredients
        FS_ING = 6
        c.setFont("Helvetica-Bold", FS_ING)
        c.setFillColor(BLACK)
        cursor -= FS_ING * 0.9
        c.drawCentredString(TCX, cursor, f"INGREDIENTS: {ingredients}")
        cursor -= 0.07 * inch

        # Light divider
        c.setStrokeColor(LGRAY)
        c.setLineWidth(0.4)
        c.line(TX, cursor, TR, cursor)
        cursor -= 0.07 * inch

        # Made by
        FS_MADE = 6
        c.setFont("Helvetica-Bold", FS_MADE)
        c.setFillColor(BLACK)
        cursor -= FS_MADE * 0.9
        c.drawCentredString(TCX, cursor, "Made by Zuzzkin's Kitchen")
        cursor -= 0.065 * inch

        # Address + phone
        FS_ADDR = 4.8
        c.setFont("Helvetica", FS_ADDR)
        c.setFillColor(MUTED)
        cursor -= FS_ADDR * 0.9
        c.drawCentredString(TCX, cursor, "1335 Highway 70, Kingston Springs, TN")
        cursor -= FS_ADDR * 0.9 + 1
        c.drawCentredString(TCX, cursor, "615.111.1111")
        cursor -= 0.07 * inch

        # Light divider
        c.setStrokeColor(LGRAY)
        c.setLineWidth(0.4)
        c.line(TX, cursor, TR, cursor)
        cursor -= 0.06 * inch

        # Disclaimer
        DISC = ("This product was produced at a private residence exempt from state "
                "licensing and inspection. This product may contain allergens.")
        FS_DISC = 4.3
        c.setFont("Helvetica", FS_DISC)
        c.setFillColor(MUTED)
        for dl in wrap_text(c, "Helvetica", FS_DISC, DISC, TW):
            cursor -= FS_DISC * 0.9
            c.drawCentredString(TCX, cursor, dl)

        # "Produce from" — pinned near bottom
        FROM_Y = y + OUTER_PAD + 0.01 * inch
        FS_FROM = 6.5
        c.setFont("Helvetica-Bold", FS_FROM)
        c.setFillColor(BROWN)
        tw = c.stringWidth(produce_line, "Helvetica-Bold", FS_FROM)
        c.drawString(TX, FROM_Y, produce_line)
        c.setStrokeColor(DGRAY)
        c.setLineWidth(0.5)
        c.line(TX + tw + 3, FROM_Y - 1, TR, FROM_Y - 1)

    for row in range(ROWS):
        for col in range(COLS):
            lx = LEFT_MARGIN + col * H_PITCH
            ly = PAGE_H - TOP_MARGIN - (row + 1) * LABEL_H
            draw_label(c, lx, ly)

    c.save()
    print(f"✅ Saved: {output_path}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 make-label.py \"Product Name\" \"Ingredient 1, Ingredient 2\" [output.pdf]")
        sys.exit(1)

    product   = sys.argv[1]
    ingreds   = sys.argv[2]
    if len(sys.argv) >= 4:
        out_path = sys.argv[3]
    else:
        slug = product.lower().replace(" ", "-").replace("'", "")
        out_path = os.path.join(LABELS_DIR, f"{slug}.pdf")

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    make_label_pdf(product, ingreds, out_path)

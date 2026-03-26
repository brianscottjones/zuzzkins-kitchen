#!/usr/bin/env bash
# remove-bg.sh — Replace image background via Gemini API
# Usage: ./remove-bg.sh <input_image> <output_image> [background_description]
#
# Examples:
#   ./remove-bg.sh cake.jpg cake-clean.jpg
#   ./remove-bg.sh cake.jpg cake-wood.jpg "a rustic wooden table"
#   ./remove-bg.sh cake.jpg cake-marble.jpg "a white marble kitchen counter"
#
# Background defaults to "a clean white background" if not specified.
#
# Requires: curl, python3, Pillow (pip install Pillow)
# API key: loaded from ~/.openclaw/.env (GEMINI_API_KEY)

set -euo pipefail

INPUT="${1:-}"
OUTPUT="${2:-}"
BG_DESC="${3:-a clean white background}"

if [[ -z "$INPUT" || -z "$OUTPUT" ]]; then
  echo "Usage: $0 <input_image> <output_image> [background_description]" >&2
  echo "  background_description defaults to: \"a clean white background\"" >&2
  exit 1
fi

if [[ ! -f "$INPUT" ]]; then
  echo "ERROR: Input file not found: $INPUT" >&2
  exit 1
fi

# Load GEMINI_API_KEY from ~/.openclaw/.env
ENV_FILE="$HOME/.openclaw/.env"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

if [[ -z "${GEMINI_API_KEY:-}" ]]; then
  echo "ERROR: GEMINI_API_KEY not set. Add it to ~/.openclaw/.env" >&2
  exit 1
fi

# Detect MIME type from input extension
EXT_LOWER=$(echo "${INPUT##*.}" | tr '[:upper:]' '[:lower:]')
case "$EXT_LOWER" in
  jpg|jpeg) MIME_TYPE="image/jpeg" ;;
  png)      MIME_TYPE="image/png" ;;
  webp)     MIME_TYPE="image/webp" ;;
  gif)      MIME_TYPE="image/gif" ;;
  *)        MIME_TYPE="image/jpeg" ;;
esac

echo "📷 Processing: $INPUT"
echo "🎨 Replacing background with: $BG_DESC"

# Encode input image as base64 (no line breaks)
IMAGE_B64=$(base64 < "$INPUT" | tr -d '\n')

# Build the prompt — keeps the product pixel-perfect, replaces only the background
PROMPT="Remove the background from this food/product photo and replace it with ${BG_DESC}. Keep the product itself completely unchanged — same shape, same colors, same details. Only change the background. The result should look like a professional product photo."

# Build request JSON using Python to avoid shell quoting issues with the prompt
REQUEST_JSON=$(python3 -c "
import json, sys
payload = {
    'contents': [{
        'parts': [
            {'text': sys.argv[1]},
            {'inline_data': {'mime_type': sys.argv[2], 'data': sys.argv[3]}}
        ]
    }],
    'generationConfig': {
        'responseModalities': ['IMAGE', 'TEXT']
    }
}
print(json.dumps(payload))
" "$PROMPT" "$MIME_TYPE" "$IMAGE_B64")

# Call Gemini API
echo "⏳ Calling Gemini API..."
RESPONSE=$(curl -s -X POST \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$REQUEST_JSON")

# Check for API-level errors
if echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); sys.exit(0 if 'error' not in d else 1)" 2>/dev/null; then
  : # no error
else
  echo "ERROR: Gemini API returned an error:" >&2
  echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(json.dumps(d.get('error',d), indent=2))" >&2
  exit 1
fi

# Extract base64 image data from response
TEMP_RAW=$(mktemp /tmp/remove-bg-raw.XXXXXX)
trap 'rm -f "$TEMP_RAW"' EXIT

echo "$RESPONSE" | python3 -c "
import json, sys, base64

data = json.load(sys.stdin)
candidates = data.get('candidates', [])
if not candidates:
    print('ERROR: No candidates in response', file=sys.stderr)
    sys.exit(1)

parts = candidates[0].get('content', {}).get('parts', [])
for part in parts:
    # API returns either 'inlineData' (camelCase) or 'inline_data' (snake_case)
    img_block = part.get('inlineData') or part.get('inline_data')
    if img_block:
        img_b64 = img_block.get('data', '')
        sys.stdout.buffer.write(base64.b64decode(img_b64))
        sys.exit(0)

print('ERROR: No image data in response', file=sys.stderr)
print('Response text parts:', file=sys.stderr)
for part in parts:
    if 'text' in part:
        print(' ', part['text'][:200], file=sys.stderr)
sys.exit(1)
" > "$TEMP_RAW"

if [[ ! -s "$TEMP_RAW" ]]; then
  echo "ERROR: No image data returned from Gemini API" >&2
  exit 1
fi

echo "🧹 Removing Gemini watermark..."

# Remove the Gemini watermark from the bottom-right corner using Pillow.
# The watermark is approximately 200x30 pixels in the very bottom-right.
# Strategy: sample the background color near the watermark edge and fill over it,
# or simply paint the region with a solid color sampled from just above it.
python3 - "$TEMP_RAW" "$OUTPUT" <<'PYEOF'
import sys
from PIL import Image
import io

input_path = sys.argv[1]
output_path = sys.argv[2]

img = Image.open(input_path).convert("RGB")
w, h = img.size

# Watermark region: bottom-right ~200x30 pixels
# We use a slightly larger patch to be safe (220x40)
wm_w = 220
wm_h = 40
x0 = w - wm_w
y0 = h - wm_h

# Sample background color: grab pixels from a strip just above the watermark area.
# Sample every 4px across and every 2px tall to get a representative set.
pixels_rgb = [img.getpixel((x, y)) for x in range(x0, w, 4) for y in range(max(0, y0 - 12), y0 - 2, 2)]
# Use the median (by brightness) as the fill color
pixels_rgb.sort(key=lambda p: p[0] + p[1] + p[2])
median_px = pixels_rgb[len(pixels_rgb) // 2] if pixels_rgb else (255, 255, 255)

# Paint over the watermark region with the sampled background color
from PIL import ImageDraw
draw = ImageDraw.Draw(img)
draw.rectangle([x0, y0, w, h], fill=median_px)

# Save — detect format from extension
ext = output_path.rsplit('.', 1)[-1].lower()
fmt_map = {'jpg': 'JPEG', 'jpeg': 'JPEG', 'png': 'PNG', 'webp': 'WEBP'}
fmt = fmt_map.get(ext, 'JPEG')

save_kwargs = {}
if fmt == 'JPEG':
    save_kwargs['quality'] = 92
    save_kwargs['subsampling'] = 0

img.save(output_path, fmt, **save_kwargs)
print(f"✓ Saved {w}x{h} image → {output_path}")
PYEOF

echo "✅ Done! Saved to: $OUTPUT"

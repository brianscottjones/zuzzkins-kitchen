#!/usr/bin/env bash
# manage.sh — Zuzzkin's Kitchen website content manager
# Usage: ./manage.sh <command> [args...]
#
# Commands:
#   stops list
#   stops add "<date YYYY-MM-DD>" "<venue>" "<location>" "<time>" ["<description>"] ["<link URL>"]
#   stops remove "<date YYYY-MM-DD>"
#   stops clear
#   photos list
#   photos remove "<filename>"
#   info get
#   info set tagline "<value>"
#   info set location "<value>"
#   info set email "<value>"
#   info set contactIntro "<value>"
#   newsletter set heading "<value>"
#   newsletter set subheading "<value>"
#   deploy "<commit message>"

set -euo pipefail

CONTENT_JSON="$(dirname "$0")/src/data/content.json"
PYTHON=/opt/homebrew/opt/python@3.10/bin/python3.10

# ─── Helpers ────────────────────────────────────────────────────

die() { echo "ERROR: $*" >&2; exit 1; }

require_file() {
  [[ -f "$CONTENT_JSON" ]] || die "content.json not found at $CONTENT_JSON"
}

# Validate JSON before writing
validate_json() {
  local json="$1"
  echo "$json" | $PYTHON -c "import sys,json; json.load(sys.stdin)" 2>/dev/null || die "Invalid JSON — aborting write"
}

read_json() {
  require_file
  cat "$CONTENT_JSON"
}

write_json() {
  local json="$1"
  validate_json "$json"
  echo "$json" | $PYTHON -c "
import sys, json
data = json.load(sys.stdin)
print(json.dumps(data, indent=2, ensure_ascii=False))
" > "$CONTENT_JSON"
  echo "✓ content.json updated"
}

# ─── Date helpers ────────────────────────────────────────────────

# Given YYYY-MM-DD, produce "Mar 22" and "Saturday" 
format_date() {
  local d="$1"
  $PYTHON -c "
from datetime import datetime
d = datetime.strptime('$d', '%Y-%m-%d')
print(d.strftime('%b %-d'))
print(d.strftime('%A'))
"
}

# ─── Stops ──────────────────────────────────────────────────────

cmd_stops_list() {
  local raw
  raw=$(read_json)
  $PYTHON -c "
import sys, json
data = json.loads('''$(echo "$raw" | sed "s/'''/\\'\\'\\'/" )''')
stops = data.get('stops', [])
if not stops:
    print('No upcoming stops.')
else:
    for s in stops:
        print(f\"{s.get('date','?')} ({s.get('day','')}) — {s.get('venue','?')} @ {s.get('location','?')} | {s.get('time','?')}\")
" 2>/dev/null || $PYTHON3 -c "
import json, sys
data = json.load(open('$CONTENT_JSON'))
stops = data.get('stops', [])
if not stops:
    print('No upcoming stops.')
else:
    for s in stops:
        print(f\"{s.get('date','?')} ({s.get('day','')}) — {s.get('venue','?')} @ {s.get('location','?')} | {s.get('time','?')}\")
"
}

cmd_stops_add() {
  local raw_date="${1:?date required (YYYY-MM-DD)}"
  local venue="${2:?venue name required}"
  local location="${3:?location required}"
  local time="${4:?time required}"
  local description="${5:-}"
  local link="${6:-}"

  # Generate formatted date and day-of-week
  local formatted_date day
  formatted_date=$($PYTHON -c "from datetime import datetime; d=datetime.strptime('$raw_date','%Y-%m-%d'); print(d.strftime('%b %-d'))")
  day=$($PYTHON -c "from datetime import datetime; d=datetime.strptime('$raw_date','%Y-%m-%d'); print(d.strftime('%A'))")

  require_file
  local new_json
  new_json=$($PYTHON - "$CONTENT_JSON" "$raw_date" "$formatted_date" "$day" "$venue" "$location" "$time" "$description" "$link" <<'PYEOF'
import json, sys, uuid
path, raw_date, fmt_date, day, venue, loc, time_str, desc, link = sys.argv[1:]
data = json.load(open(path))
stops = data.get('stops', [])
# Prevent duplicate by date
stops = [s for s in stops if s.get('id') != raw_date and s.get('id','') != raw_date]
new_stop = {
    "id": raw_date,
    "date": fmt_date,
    "day": day,
    "venue": venue,
    "location": loc,
    "time": time_str,
}
if desc:
    new_stop["description"] = desc
if link:
    new_stop["link"] = link
stops.append(new_stop)
# Sort by id (YYYY-MM-DD)
stops.sort(key=lambda s: s.get('id', ''))
data['stops'] = stops
print(json.dumps(data, indent=2, ensure_ascii=False))
PYEOF
)
  write_json "$new_json"
  echo "✓ Added stop: $venue on $formatted_date ($day) at $time"
}

cmd_stops_remove() {
  local target="${1:?date (YYYY-MM-DD) or venue name required}"
  require_file
  local new_json
  new_json=$($PYTHON - "$CONTENT_JSON" "$target" <<'PYEOF'
import json, sys
path, target = sys.argv[1:]
data = json.load(open(path))
before = len(data.get('stops', []))
# Match by id (date) or venue name (case-insensitive)
data['stops'] = [
    s for s in data.get('stops', [])
    if s.get('id','') != target and s.get('venue','').lower() != target.lower()
]
after = len(data['stops'])
removed = before - after
if removed == 0:
    print(f"WARNING: no stop matched '{target}'", file=sys.stderr)
else:
    print(f"Removed {removed} stop(s) matching '{target}'", file=sys.stderr)
print(json.dumps(data, indent=2, ensure_ascii=False))
PYEOF
)
  write_json "$new_json"
}

cmd_stops_clear() {
  require_file
  local new_json
  new_json=$($PYTHON - "$CONTENT_JSON" <<'PYEOF'
import json, sys
data = json.load(open(sys.argv[1]))
data['stops'] = []
print(json.dumps(data, indent=2, ensure_ascii=False))
PYEOF
)
  write_json "$new_json"
  echo "✓ All stops cleared"
}

# ─── Photos ─────────────────────────────────────────────────────

cmd_photos_list() {
  require_file
  $PYTHON - "$CONTENT_JSON" <<'PYEOF'
import json, sys
data = json.load(open(sys.argv[1]))
photos = data.get('photos', [])
if not photos:
    print('No photos in gallery.')
else:
    for i, p in enumerate(photos, 1):
        print(f"{i}. {p.get('src','?')} — {p.get('alt','')}")
PYEOF
}

cmd_photos_remove() {
  local filename="${1:?filename required}"
  require_file
  local new_json
  new_json=$($PYTHON - "$CONTENT_JSON" "$filename" <<'PYEOF'
import json, sys, os
path, filename = sys.argv[1:]
data = json.load(open(path))
before = len(data.get('photos', []))
# Match by filename (strip leading /)
data['photos'] = [
    p for p in data.get('photos', [])
    if os.path.basename(p.get('src','')) != os.path.basename(filename)
]
after = len(data['photos'])
print(f"Removed {before - after} photo(s)", file=sys.stderr)
print(json.dumps(data, indent=2, ensure_ascii=False))
PYEOF
)
  write_json "$new_json"
}

cmd_photos_add() {
  local filename="${1:?filename required (e.g. cake.jpg)}"
  local alt="${2:?alt text required}"
  local src_path="${3:-}"

  require_file

  # Strip leading slash from filename if present
  local basename
  basename=$(basename "$filename")

  # Copy file to public/ if a source path was provided and it's not already there
  local public_dir
  public_dir="$(dirname "$0")/public"
  local dest="$public_dir/$basename"

  if [[ -n "$src_path" ]]; then
    if [[ ! -f "$src_path" ]]; then
      die "Source file not found: $src_path"
    fi
    cp "$src_path" "$dest"
    echo "✓ Copied $basename to public/"
  fi

  # Add to content.json photos array
  local new_json
  new_json=$($PYTHON - "$CONTENT_JSON" "$basename" "$alt" <<'PYEOF'
import json, sys, os
path, filename, alt = sys.argv[1:]
data = json.load(open(path))
photos = data.get('photos', [])
# Get next available id (max existing id + 1)
existing_ids = []
for p in photos:
    try:
        existing_ids.append(int(p.get('id', '0')))
    except (ValueError, TypeError):
        pass
next_id = str(max(existing_ids) + 1) if existing_ids else "1"
# Check for duplicate src
src = "/" + filename
for p in photos:
    if p.get('src') == src:
        print(f"WARNING: photo with src '{src}' already exists", file=sys.stderr)
new_photo = {
    "id": next_id,
    "src": src,
    "alt": alt
}
photos.append(new_photo)
data['photos'] = photos
print(json.dumps(data, indent=2, ensure_ascii=False))
PYEOF
)
  write_json "$new_json"
  echo "✓ Added photo: /$basename — \"$alt\""
}

cmd_photos_reorder() {
  # Takes comma-separated filenames in desired order
  local order="${1:?comma-separated filenames required}"
  require_file
  local new_json
  new_json=$($PYTHON - "$CONTENT_JSON" "$order" <<'PYEOF'
import json, sys, os
path, order_str = sys.argv[1:]
data = json.load(open(path))
order = [x.strip() for x in order_str.split(',')]
photos_by_name = {os.path.basename(p['src']): p for p in data.get('photos', [])}
reordered = []
for name in order:
    if name in photos_by_name:
        reordered.append(photos_by_name[name])
# Append any not mentioned at end
for p in data['photos']:
    if os.path.basename(p['src']) not in order:
        reordered.append(p)
data['photos'] = reordered
print(json.dumps(data, indent=2, ensure_ascii=False))
PYEOF
)
  write_json "$new_json"
  echo "✓ Photos reordered"
}

# ─── Site Info ──────────────────────────────────────────────────

cmd_info_get() {
  require_file
  $PYTHON - "$CONTENT_JSON" <<'PYEOF'
import json, sys
data = json.load(open(sys.argv[1]))
site = data.get('site', {})
for k, v in site.items():
    print(f"  {k}: {v}")
PYEOF
}

cmd_info_set() {
  local key="${1:?field name required}"
  local value="${2:?value required}"
  require_file
  local new_json
  new_json=$($PYTHON - "$CONTENT_JSON" "$key" "$value" <<'PYEOF'
import json, sys
path, key, value = sys.argv[1:]
data = json.load(open(path))
if 'site' not in data:
    data['site'] = {}
data['site'][key] = value
print(json.dumps(data, indent=2, ensure_ascii=False))
PYEOF
)
  write_json "$new_json"
  echo "✓ site.$key updated"
}

# ─── Newsletter ─────────────────────────────────────────────────

cmd_newsletter_set() {
  local field="${1:?field (heading|subheading|text) required}"
  local value="${2:?value required}"
  # Map field names to content.json keys
  local json_key
  case "$field" in
    heading)    json_key="newsletterHeading" ;;
    subheading) json_key="newsletterSubheading" ;;
    text)       json_key="newsletterText" ;;
    *)          json_key="newsletter_$field" ;;
  esac
  require_file
  local new_json
  new_json=$($PYTHON - "$CONTENT_JSON" "$json_key" "$value" <<'PYEOF'
import json, sys
path, key, value = sys.argv[1:]
data = json.load(open(path))
if 'site' not in data:
    data['site'] = {}
data['site'][key] = value
print(json.dumps(data, indent=2, ensure_ascii=False))
PYEOF
)
  write_json "$new_json"
  echo "✓ newsletter.$field updated"
}

# ─── Deploy ─────────────────────────────────────────────────────

cmd_deploy() {
  local msg="${1:-Update site content}"
  cd "$(dirname "$0")"
  git add -A
  git commit -m "$msg"
  git push
  echo "✓ Deployed: $msg"
}

# ─── Router ─────────────────────────────────────────────────────

COMMAND="${1:-help}"
shift || true

case "$COMMAND" in
  stops)
    SUBCOMMAND="${1:-list}"; shift || true
    case "$SUBCOMMAND" in
      list)   cmd_stops_list ;;
      add)    cmd_stops_add "$@" ;;
      remove) cmd_stops_remove "$@" ;;
      clear)  cmd_stops_clear ;;
      *)      die "Unknown stops subcommand: $SUBCOMMAND" ;;
    esac
    ;;
  photos)
    SUBCOMMAND="${1:-list}"; shift || true
    case "$SUBCOMMAND" in
      list)    cmd_photos_list ;;
      add)     cmd_photos_add "$@" ;;
      remove)  cmd_photos_remove "$@" ;;
      reorder) cmd_photos_reorder "$@" ;;
      *)       die "Unknown photos subcommand: $SUBCOMMAND" ;;
    esac
    ;;
  info)
    SUBCOMMAND="${1:-get}"; shift || true
    case "$SUBCOMMAND" in
      get) cmd_info_get ;;
      set) cmd_info_set "$@" ;;
      *)   die "Unknown info subcommand: $SUBCOMMAND" ;;
    esac
    ;;
  newsletter)
    SUBCOMMAND="${1:-}"; shift || true
    case "$SUBCOMMAND" in
      set) cmd_newsletter_set "$@" ;;
      *)   die "Unknown newsletter subcommand: $SUBCOMMAND" ;;
    esac
    ;;
  deploy)
    cmd_deploy "$@"
    ;;
  help|--help|-h)
    cat <<'HELP'
Zuzzkin's Kitchen — Site Manager

USAGE:
  ./manage.sh <command> [args]

STOPS:
  stops list
  stops add "2026-03-22" "Kingston Springs Market" "Kingston Springs, TN" "8:00 AM - 12:00 PM" "" "https://example.com"
  stops remove "2026-03-22"        # by date (YYYY-MM-DD)
  stops remove "Kingston Springs Market"   # by venue name
  stops clear                      # remove all stops

PHOTOS:
  photos list
  photos add "cake.jpg" "Alt text description"      # add to gallery (file must be in public/)
  photos add "cake.jpg" "Alt text" "/tmp/cake.jpg"  # copy file + add to gallery
  photos remove "flower-cake.jpg"                   # removes from gallery (file stays on disk)
  photos reorder "cake.jpg,brownies.jpg,flower-cake.jpg"

INFO:
  info get
  info set tagline "Always Homemade"
  info set location "Kingston Springs, TN"
  info set contactEmail "hello@zuzzkins.com"
  info set contactIntro "Just want to say hi?"

NEWSLETTER:
  newsletter set heading "Join the Rat Pack"
  newsletter set subheading "Sign up for news and scheduling updates."
  newsletter set text "Full newsletter body text..."

DEPLOY:
  deploy "Add: Kingston Springs market March 22"

HELP
    ;;
  *)
    die "Unknown command: $COMMAND. Run './manage.sh help' for usage."
    ;;
esac

#!/bin/sh
# Renders the Play Store graphics from store/graphics/src with headless Chrome.
#   sh store/render.sh
# Raw phone screenshots (1080×2400, from `adb exec-out screencap -p`) go in
# store/graphics/raw/NN-name.png; captions are listed below.
set -e
cd "$(dirname "$0")/graphics"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TMP=$(mktemp -d)

shot() { # shot <html url> <width> <height> <out.jpg>
  "$CHROME" --headless --disable-gpu --hide-scrollbars --allow-file-access-from-files \
    --force-device-scale-factor=1 --window-size="$2,$3" --virtual-time-budget=3000 \
    --screenshot="$TMP/out.png" "$1" 2>/dev/null
  # Play wants no transparency: JPEG has none.
  sips -s format jpeg -s formatOptions 92 "$TMP/out.png" --out "$4" >/dev/null
}

enc() { node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$1"; }

shot "file://$PWD/src/feature-graphic.html" 1024 500 feature-graphic.jpg

frame() { # frame <raw name> <title> <subtitle>
  [ -f "raw/$1.png" ] || { echo "skip $1 (no raw/$1.png)"; return; }
  shot "file://$PWD/src/frame.html?img=../raw/$1.png&title=$(enc "$2")&sub=$(enc "$3")" 1080 1920 "screenshots/$1.jpg"
  echo "screenshots/$1.jpg"
}

mkdir -p screenshots
frame 01-today   "Know what to study today"      "Cardly shows each card just before you’d forget it."
frame 02-study   "Cards for code, words and facts" "Basic, cloze, code and vocabulary cards."
frame 03-answer  "Rate it. Cardly does the rest"  "FSRS picks the best day to see each card again."
frame 04-explore "Start with ready-made decks"   "Git, SQL, Spanish, hiragana, anatomy and more."
frame 05-stats   "Watch your memory grow"        "Streaks, retention and upcoming reviews."
frame 06-decks   "Bring your cards with you"     "Import Anki decks and CSV files. Back up anytime."
rm -rf "$TMP"

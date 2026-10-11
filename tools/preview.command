#!/bin/bash
# Double-click on a Mac to preview the site with all animations.
# Browsers block the site's module scripts on file:// pages, so serve the repo root.
cd "$(dirname "$0")/.." || exit 1
PORT=8064
echo "Previewing at http://localhost:$PORT  (close this window or press Ctrl+C to stop)"
( sleep 1; open "http://localhost:$PORT/" ) &
python3 -m http.server "$PORT"

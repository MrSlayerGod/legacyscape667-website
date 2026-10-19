#!/usr/bin/env sh
set -e
cd "$(dirname "$0")"
echo "LegacyScape Atlas at http://localhost:8000/"
python3 -m http.server 8000

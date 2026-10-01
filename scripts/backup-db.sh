#!/bin/sh
set -e
cd "$(dirname "$0")/.."
mkdir -p backups
OUT="backups/lime_eol-$(date +%Y%m%d-%H%M).sql"
docker compose exec -T db pg_dump -U lime -d lime_eol --clean --if-exists > "$OUT"
echo "wrote $OUT ($(du -h "$OUT" | cut -f1))"

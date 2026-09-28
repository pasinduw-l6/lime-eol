#!/bin/sh
# A dump of the whole database, which is the only copy of anything that
# matters here: the estate, the plans, and the hash-chained change history.
#
# Restore it with:
#   docker compose exec -T db psql -U lime -d lime_eol < backups/<file>.sql
#
# The dump carries password hashes and customer data, so backups/ is
# gitignored and these files are not to be shared casually.
set -e
cd "$(dirname "$0")/.."
mkdir -p backups
OUT="backups/lime_eol-$(date +%Y%m%d-%H%M).sql"
docker compose exec -T db pg_dump -U lime -d lime_eol --clean --if-exists > "$OUT"
echo "wrote $OUT ($(du -h "$OUT" | cut -f1))"

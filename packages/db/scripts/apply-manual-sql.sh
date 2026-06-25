#!/usr/bin/env bash
# apply-manual-sql — aplica los .sql aditivos+idempotentes de manual-sql/ a prod.
# Todos usan IF NOT EXISTS, así que correrlos de más es inofensivo. Es el
# mecanismo del repo (full ZenStack) para cambios que no pasan por migrate.
#
#   bash scripts/apply-manual-sql.sh
set -euo pipefail
cd "$(dirname "$0")/.."   # -> packages/db

ENV_FILE=".env"
[ -f "$ENV_FILE" ] || ENV_FILE="$(git rev-parse --show-toplevel)/packages/db/.env"
[ -f "$ENV_FILE" ] || ENV_FILE="$(git rev-parse --show-toplevel)/apps/api/.env"
[ -f "$ENV_FILE" ] || { echo "ERROR: no encontré .env con DATABASE_URL"; exit 1; }

RAW=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'"'"'"')
PROD="${RAW%%\?*}"

shopt -s nullglob
FILES=(zenstack/manual-sql/*.sql)
if [ ${#FILES[@]} -eq 0 ]; then echo "No hay archivos en manual-sql/"; exit 0; fi

for f in "${FILES[@]}"; do
  echo "== aplicando $f =="
  psql "$PROD" -v ON_ERROR_STOP=1 -f "$f"
done
echo "OK: manual-sql aplicado. Recuerda: pnpm -F @finanzas/db build (sincroniza el cliente generado)."

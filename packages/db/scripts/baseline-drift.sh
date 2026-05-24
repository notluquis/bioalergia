#!/usr/bin/env bash
# Baseline del drift db-push (one-shot, idempotente-ish).
#
# Calcula el SQL que está en prod pero NO en las migraciones (delta db-push),
# lo deja como migración baseline y la marca COMO APLICADA (migrate resolve
# --applied NO ejecuta el SQL; prod ya lo tiene). Usa una DB temporal en el
# mismo Postgres de Railway como shadow (Prisma reproduce ahí el estado de las
# migraciones para diffear). Borra la shadow al final. Preserva el historial.
#
# Correr desde la raíz del repo:  bash packages/db/scripts/baseline-drift.sh
set -euo pipefail
cd "$(dirname "$0")/.."   # -> packages/db

DBURL=$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"')
PROD="${DBURL%%\?*}"
SHADOW=$(printf '%s' "$PROD" | sed -E 's#/[^/?]+$#/drift_shadow#')
PRISMA=$(find ../../node_modules/.pnpm -name prisma -path '*@zenstackhq+cli*/node_modules/.bin/prisma' | head -1)
NAME=20260522030000_baseline_dbpush_drift
DIR="zenstack/migrations/$NAME"

if [ -z "${PRISMA:-}" ]; then echo "ERROR: no encontré el binario prisma"; exit 1; fi
echo "prisma: $PRISMA"
echo "shadow: $(printf '%s' "$SHADOW" | sed -E 's#://[^:]+:[^@]+@#://USER:PASS@#')"

echo "== creando DB shadow temporal =="
psql "$PROD" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS drift_shadow;" -c "CREATE DATABASE drift_shadow;"

echo "== calculando delta (migraciones -> prod) =="
"$PRISMA" migrate diff \
  --from-migrations zenstack/migrations \
  --to-url "$PROD" \
  --shadow-database-url "$SHADOW" \
  --script > /tmp/drift.sql

echo "----- DELTA SQL -----"
cat /tmp/drift.sql
echo "---------------------"

if ! grep -q '[^[:space:]]' /tmp/drift.sql || grep -qi 'empty migration' /tmp/drift.sql; then
  echo "== sin drift: no se crea baseline =="
else
  mkdir -p "$DIR"
  cp /tmp/drift.sql "$DIR/migration.sql"
  echo "== registrando baseline como APLICADA (no ejecuta SQL) =="
  pnpm exec zen migrate resolve --applied "$NAME"
fi

echo "== borrando DB shadow =="
psql "$PROD" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS drift_shadow;"

echo "== estado final =="
pnpm exec zen migrate status

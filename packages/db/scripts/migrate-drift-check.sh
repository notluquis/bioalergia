#!/usr/bin/env bash
# migrate-drift-check — verifica drift entre las migraciones en disco y PROD.
# READ-ONLY sobre prod (solo crea/borra una DB shadow temporal para el replay).
#
# OJO (full ZenStack): este repo aplica cambios aditivos a mano vía psql
# (packages/db/zenstack/manual-sql/*.sql con IF NOT EXISTS) además de las
# migraciones formales. Por eso `migrate diff` puede reportar como "faltantes"
# objetos que prod SÍ tiene (tablas/índices/enums de manual-sql). Eso NO es
# drift dañino: es ruido esperado del replay. Lo que importa es que NO aparezca
# un DROP/ALTER que destruya datos reales de prod.
#
#   bash scripts/migrate-drift-check.sh
set -euo pipefail
cd "$(dirname "$0")/.."   # -> packages/db

ENV_FILE=".env"
[ -f "$ENV_FILE" ] || ENV_FILE="$(git rev-parse --show-toplevel)/packages/db/.env"
[ -f "$ENV_FILE" ] || ENV_FILE="$(git rev-parse --show-toplevel)/apps/api/.env"
[ -f "$ENV_FILE" ] || { echo "ERROR: no encontré .env con DATABASE_URL"; exit 1; }

RAW=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'"'"'"')
PROD="${RAW%%\?*}"   # psql no acepta query params tipo pool_timeout
SHADOW="${PROD%/*}/drift_shadow_check"
PRISMA=$(find ../../node_modules/.pnpm -name prisma -path '*@zenstackhq+cli*/node_modules/.bin/prisma' | head -1)
[ -n "$PRISMA" ] || { echo "ERROR: no encontré el binario prisma del CLI ZenStack"; exit 1; }

cleanup() { psql "$PROD" -q -c "DROP DATABASE IF EXISTS drift_shadow_check;" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "== creando shadow temporal =="
psql "$PROD" -q -c "DROP DATABASE IF EXISTS drift_shadow_check;" -c "CREATE DATABASE drift_shadow_check;"

echo "== diff: migraciones(disco) -> prod =="
DIFF=$("$PRISMA" migrate diff --from-migrations zenstack/migrations --to-url "$PROD" --shadow-database-url "$SHADOW" --script 2>&1 || true)

echo "$DIFF"
echo "------------------------------------------------------------"
# Señales realmente preocupantes: DROP/TRUNCATE/DELETE sobre prod.
DANGER=$(printf '%s\n' "$DIFF" | grep -iE 'DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM' || true)
if [ -n "$DANGER" ]; then
  echo "⚠  El diff incluye sentencias DESTRUCTIVAS. Revisa si reflejan estado real de prod"
  echo "   (suele ser ruido de replay) o un cambio que borraría datos:"
  printf '%s\n' "$DANGER"
else
  echo "OK: el diff no contiene DROP/TRUNCATE/DELETE sobre prod."
fi

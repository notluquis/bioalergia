#!/bin/bash
# Guarda las contraseñas IMAP de las cuentas de importación en el Keychain de macOS.
# Ejecutar una sola vez antes de usar import-eml-backup.ts
#
# Uso: bash scripts/setup-import-keychain.sh

SERVICE="bioalergia-mail-import"

store_password() {
  local account="$1"
  printf "Contraseña para %s: " "$account"
  read -rs password
  echo

  # Eliminar entrada previa si existe (evita duplicados)
  security delete-generic-password -s "$SERVICE" -a "$account" &>/dev/null || true

  security add-generic-password -s "$SERVICE" -a "$account" -w "$password"
  echo "  ✓ Guardada"
}

echo "=== Setup de credenciales IMAP para importación ==="
echo "Servicio Keychain: $SERVICE"
echo ""

store_password "lpulgar@bioalergia.cl"
store_password "jmartinez@bioalergia.cl"
store_password "contacto@bioalergia.cl"
store_password "clinica@bioalergia.cl"

echo ""
echo "Listo. Credenciales guardadas en el Keychain."
echo "La cuenta finanzas@bioalergia.cl usa las mismas credenciales que contacto@bioalergia.cl (routed)."

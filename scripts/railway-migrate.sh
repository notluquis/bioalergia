#!/bin/bash
set -e

echo "========================================="
echo "  Migración MySQL → PostgreSQL"
echo "========================================="
echo ""

# Verificar variables de entorno
if [ -z "$MYSQL_URL" ] || [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: Faltan variables de entorno"
    echo "MYSQL_URL: $MYSQL_URL"
    echo "DATABASE_URL: $DATABASE_URL"
    exit 1
fi

echo "✓ Variables de entorno configuradas"
echo ""

# Hacer backup de MySQL
echo "📦 Haciendo backup de MySQL..."
mysqldump --single-transaction --quick --lock-tables=false \
    -h$(echo $MYSQL_URL | sed 's/.*@\(.*\):.*/\1/') \
    -P$(echo $MYSQL_URL | sed 's/.*:\([0-9]*\)\/.*/\1/') \
    -u$(echo $MYSQL_URL | sed 's/.*:\/\/\(.*\):.*/\1/') \
    -p$(echo $MYSQL_URL | sed 's/.*:\/\/.*:\(.*\)@.*/\1/') \
    $(echo $MYSQL_URL | sed 's/.*\/\(.*\)/\1/') \
    > /tmp/mysql_backup.sql

echo "✓ Backup completado"
echo ""

# Convertir dump a PostgreSQL (básico)
echo "🔄 Adaptando SQL para PostgreSQL..."
sed -i '' 's/`//g' /tmp/mysql_backup.sql
sed -i '' 's/ENGINE=InnoDB//g' /tmp/mysql_backup.sql
sed -i '' 's/AUTO_INCREMENT//g' /tmp/mysql_backup.sql

echo "✓ SQL adaptado"
echo ""

# Importar a PostgreSQL
echo "📥 Importando a PostgreSQL..."
psql $DATABASE_URL -f /tmp/mysql_backup.sql

echo ""
echo "✅ Migración completada!"
echo ""
echo "Próximos pasos:"
echo "1. Actualizar DATABASE_URL en Railway"
echo "2. Verificar que la aplicación funciona"

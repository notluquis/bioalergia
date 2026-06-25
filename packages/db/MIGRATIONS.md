# Migraciones — flujo seguro (full ZenStack)

Objetivo: **deploy SIEMPRE, pero nunca destructivo por sorpresa ni con drift
descontrolado.**

## Reglas de oro

1. **NUNCA `db push` ni `migrate dev` contra prod.** `db push` aplica el schema
   sin crear archivo → genera drift (la DB queda en un estado que ninguna
   migración describe). `migrate dev` quiere RESETEAR (borra datos) cuando
   detecta drift.
2. **`migrate deploy` SÍ es seguro**: solo ejecuta los `.sql` pendientes en
   orden y los registra en `_prisma_migrations`. No infiere, no resetea, no
   borra nada que no esté escrito en el SQL.
3. **Migraciones aditivas + idempotentes**: usa `CREATE TABLE IF NOT EXISTS`,
   `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`. Así re-aplicar
   sobre prod (que tiene drift histórico de `db push`) nunca falla.
4. **Cambios aditivos rápidos**: van en `zenstack/manual-sql/*.sql` (idempotentes
   con `IF NOT EXISTS`) y se aplican con `pnpm manual-sql:apply`. El schema
   autoritativo es `schema.zmodel`; tras aplicar, corre `pnpm -F @finanzas/db build`
   para sincronizar el cliente generado.

## Flujo de deploy

```bash
cd packages/db

# 1. (opcional) verificar drift contra prod — READ-ONLY
pnpm migrate:drift-check

# 2. crear migración SIN aplicar (para revisar el SQL antes)
pnpm zen migrate dev --create-only   # o escribir el migration.sql a mano

# 3. aplicar a prod — el guard corre AUTOMÁTICO antes de deploy
pnpm migrate:deploy
```

`pnpm migrate:deploy` = `migrate-guard` + `zen migrate deploy`. El guard **aborta
el deploy** si una migración pendiente:

- contiene SQL **destructivo** (`DROP TABLE/COLUMN/TYPE`, `TRUNCATE`, `DELETE`,
  `ALTER ... DROP ...`) **sin** la marca de revisión, o
- colisiona en timestamp con otra pendiente (orden ambiguo).

### Permitir una migración destructiva legítima

Agrega como primera línea del `migration.sql`:

```sql
-- SAFE-DESTRUCTIVE: <razón, fecha, autor>
```

Eso documenta la decisión y deja pasar el guard. Sin la marca, no se deploya.

## Scripts

| Script | Qué hace |
|---|---|
| `pnpm migrate:deploy` | guard + `zen migrate deploy` (el camino normal) |
| `pnpm migrate:deploy:raw` | `zen migrate deploy` sin guard (escape, evitar) |
| `pnpm migrate:guard` | solo el guard (chequea migraciones pendientes) |
| `pnpm migrate:drift-check` | diff migraciones(disco) vs prod, read-only |
| `pnpm manual-sql:apply` | aplica `zenstack/manual-sql/*.sql` (idempotente) |

## Alcance del guard

El guard solo evalúa migraciones **pendientes** (en disco pero no aplicadas en
prod). Las ya aplicadas son historia inmutable. Determina las aplicadas vía
`DATABASE_URL` (env del proceso o `.env`, read-only sobre `_prisma_migrations`);
si no hay DB disponible (CI sin secreto), usa `zenstack/migrations/.guard-baseline`
(todo lo `<=` baseline se considera aplicado).

## Estado verificado (2026-06-24)

- 184 migraciones en disco, **todas aplicadas**, 0 pendientes, 0 rotas.
- Las 5 migraciones que `_prisma_migrations` muestra con `rolled_back_at` tienen
  además una fila posterior re-aplicada con éxito → están sanas.
- `migrate diff` reporta diferencias (tablas/índices/enums de `manual-sql`,
  renames de FK), pero la verificación puntual confirmó que **prod ya tiene ese
  estado correcto**: es ruido de replay del shadow, no drift dañino. Esperado
  con full ZenStack + cambios aditivos por `manual-sql`.

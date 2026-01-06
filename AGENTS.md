# AGENTS.md — finanzas-app

> **Instrucciones universales para cualquier agente de IA** (Copilot, Claude, Gemini, Codex, Cursor, etc.)
> Última actualización: Enero 2026

---

## TL;DR (lee esto primero)

```text
Stack:       React 19 + Vite 7 + TypeScript (frontend) | Node 25 + Express + ZenStack 3.1.1 + PostgreSQL (backend)
Desarrollo:  pnpm run dev:full (frontend + backend simultáneo)
Build:       pnpm run build && pnpm run build:server
Verificar:   pnpm run type-check && pnpm run lint
Deploy:      git push (Railway auto-deploy)
```

**5 reglas de oro:**

1. **NUNCA usar `useMemo`/`useCallback`/`React.memo`** salvo casos justificados → React Compiler memoiza automáticamente
2. **NUNCA usar `bg-white`** → usar `bg-base-100` (DaisyUI)
3. **NUNCA crear mock data** → usar APIs reales existentes
4. **SIEMPRE** verificar con `pnpm run type-check` antes de commit
5. **SIEMPRE** usar plugins oficiales de Vite → no third-party Rollup plugins

---

## Stack tecnológico

| Capa     | Tecnología                               | Notas                            |
| -------- | ---------------------------------------- | -------------------------------- |
| Frontend | React 19 + TypeScript + Vite 7           | Entry: `apps/web/src/main.tsx`   |
| Styling  | Tailwind CSS + DaisyUI                   | Themes en `tailwind.config.cjs`  |
| State    | TanStack Query + Zustand                 | Hooks en `src/features/*/hooks/` |
| Backend  | Node 25 + Express + TypeScript           | Entry: `apps/api/src/index.ts`   |
| Database | **PostgreSQL** (via ZenStack 3.1.1)      | Schema: `packages/db/zenstack/schema.zmodel` |
| Auth     | Passkey + email/password + **RBAC/ABAC** | Session: 24h                     |
| Deploy   | Railway (auto-deploy on push)            | Dockerfile con node:current-slim |
| Monorepo | pnpm workspaces + Turbo 2.7.3            | 4 packages (@finanzas/web, @finanzas/api, @finanzas/db, root) |

⚠️ **IMPORTANTE**: La base de datos es **PostgreSQL**, NO MySQL. Usar sintaxis PostgreSQL en raw queries (`TO_CHAR`, `EXTRACT`, etc.)

---

## Comandos esenciales

```bash
# Desarrollo
pnpm run dev          # Frontend solo (Vite)
pnpm run server       # Backend solo
pnpm run dev:full     # Frontend + Backend simultáneo ⭐

# Build y verificación
pnpm run build        # Build frontend (producción)
pnpm run build:server # Build backend
pnpm run type-check   # TypeScript check (OBLIGATORIO antes de commit)
pnpm run lint         # ESLint

# Testing
pnpm run test:withdrawals  # Test integración (requiere RUN_WITHDRAWALS_IT=1)

# Base de datos
cd packages/db && pnpm run build  # Regenerar ZenStack + fix imports (DESPUÉS de cambios en schema)
```

---

## Estructura del proyecto

```text
finanzas-app/
├── apps/
│   ├── web/                # Frontend React 19
│   │   ├── src/
│   │   │   ├── main.tsx    # Entry point + rutas
│   │   │   ├── features/   # Módulos por dominio
│   │   │   │   └── */api.ts       # API calls centralizados
│   │   │   │   └── */hooks/       # Custom hooks
│   │   │   │   └── */types.ts     # TypeScript types
│   │   │   ├── components/ # Componentes compartidos
│   │   │   │   └── ui/     # Primitivos (Button, Input, etc.)
│   │   │   └── pages/      # Páginas de rutas
│   │   ├── vite.config.ts  # Vite 7 config (oficial plugins)
│   │   └── tailwind.config.cjs  # DaisyUI themes
│   │
│   └── api/                # Backend Express
│       ├── src/
│       │   ├── index.ts    # Entry point
│       │   ├── routes/     # Endpoints API
│       │   ├── services/   # Lógica de negocio
│       │   ├── lib/        # Utilidades
│       │   └── config.ts   # Configuración
│       └── tsconfig.json
│
├── packages/
│   └── db/                 # ZenStack schemas
│       ├── zenstack/
│       │   ├── schema.zmodel      # Schema principal
│       │   └── prisma/schema.prisma  # Generado
│       ├── src/zenstack/   # TypeScript generado
│       └── scripts/fix-imports.mjs  # Fix .js extensions
│
├── Dockerfile              # Multi-stage build (parallel)
└── pnpm-workspace.yaml     # Monorepo config
```

---

## Cambios críticos recientes (Enero 2026)

### 🔴 React 19 Compiler (Migration in Progress)

- **NO usar `useMemo`/`useCallback`/`React.memo`** a menos que sea justificado
- React Compiler automáticamente memoiza componentes y valores
- Event handlers inline: `onClick={() => ...}` - compiler los optimiza
- Static data: Mover fuera del componente como `const COLUMNS = [...]`
- **SOLO usar `useMemo`** para cálculos costosos (Map operations complejas, agregaciones pesadas)
- **MANTENER `useEffect`** para side effects legítimos (fetching, subscriptions)

```tsx
// ❌ INCORRECTO - Memoización innecesaria
const onClick = useCallback(() => setValue(x), [x]);
const data = useMemo(() => query.data ?? [], [query.data]);

// ✅ CORRECTO - Let compiler handle it
<Button onClick={() => setValue(x)}>Guardar</Button>
const data = query.data ?? [];

// ✅ CORRECTO - Cálculo costoso justificado
const accountRows = useMemo(() => {
  // 50+ líneas de operaciones Map, grouping, sorting
  return complexAggregation(data);
}, [data]);
```

**Phase 1 completada**: 8 archivos migrados (~28 optimizaciones removidas)
**Remaining**: ~50+ archivos con memoización manual

### 🔴 ZenStack v3.1.1 (NO Prisma directamente)

- Usar `db` del cliente ZenStack (ABAC automático)
- **NO usar `db.$transaction()`** - no expone model delegates
- Para operaciones batch: acceso directo `db.modelName.findMany()`
- Después de actualizar schema: `cd packages/db && pnpm run build`
- Script `fix-imports.mjs` agrega `.js` extensions automáticamente

```typescript
// ❌ INCORRECTO - Transaction no funciona en ZenStack v3
await db.$transaction(async (tx) => {
  const data = await tx.transaction.findMany();
});

// ✅ CORRECTO - Acceso directo
const data = await db.transaction.findMany({
  where: { type: "INCOME" }
}); // Filtra automáticamente por policies ABAC
```

### 🔴 Vite 7 - Solo plugins oficiales

- **NUNCA** usar plugins third-party de Rollup
- Plugins permitidos:
  - `@vitejs/plugin-react` (oficial)
  - `@tailwindcss/vite` (ecosistema oficial)
  - `vite-plugin-pwa` (ecosistema)
  - `vite-plugin-checker` (ecosistema)
- Build config: `reportCompressedSize: false` (Railway/Cloudflare comprimen)

```typescript
// ✅ CORRECTO - vite.config.ts
export default defineConfig({
  plugins: [
    react(), // @vitejs/plugin-react
    tailwindcss(), // @tailwindcss/vite
    checker({ typescript: true }),
    VitePWA({ ...config })
  ],
  build: {
    reportCompressedSize: false, // Railway handles compression
    target: 'esnext'
  }
});
```

### 🔴 Build Optimization (Parallel + Compression)

- Dockerfile usa RUN paralelos para build de web+api simultáneo
- Vite config con `reportCompressedSize: false` (Railway comprima dinámicamente)
- Build time: 80s → 71-74s (6-9s de mejora)
- Docker images: 30-40MB más pequeñas

### 🔴 PostgreSQL Syntax (NO MySQL)

- **TODAS** las raw queries usan sintaxis PostgreSQL
- `TO_CHAR()` en vez de `DATE_FORMAT()`
- `EXTRACT()` para fechas
- Tablas usan nombres de `@@map`: `events` (no `google_calendar_events`), `people` (no `person`)

### 🔴 Calendar sync asíncrono (evita Cloudflare 524)

- `POST /api/calendar/events/sync` retorna **202 Accepted** inmediatamente
- Sync se ejecuta en **background** con async/await promise handling
- Frontend hace **polling cada 5s** del estado via `GET /api/calendar/events/sync/logs`
- Polling máximo: **5 minutos** (60 polls × 5s)
- Evita Error 524 de Cloudflare (timeout >100s en syncs largos)
- NUNCA hacer sync bloqueante - siempre retornar HTTP response antes de 100s

### 🔴 Sync timeout = 15 minutos

- `apps/api/src/services/calendar.ts` usa 15min como timeout para marcar syncs como "stale"
- Cambiado de 5min porque syncs grandes se marcaban como error prematuramente

### 🔴 Patrones de exclusión de calendario

- Definidos en `apps/api/src/config.ts` → `parseExcludePatterns()`
- Excluye automáticamente: "cumpleaños", eventos vacíos, solo fechas
- Se pueden agregar más via `GOOGLE_CALENDAR_EXCLUDE_SUMMARIES` env var

### 🔴 Tabs con `end: true`

- TODOS los tabs en layouts deben tener `end: true` para marcar ruta activa correctamente
- Archivos: `CalendarLayout.tsx`, `HRLayout.tsx`, `ServicesLayout.tsx`, `OperationsLayout.tsx`

### 🟡 Auth: passwordHash nullable

- `packages/db/zenstack/schema.zmodel`: `passwordHash String?` (nullable)
- Usuarios passkey-only tienen `passwordHash = null`
- `apps/api/src/routes/auth.ts` maneja null safely

### 🔴 Amount validation: Int32 limits

- `apps/api/src/modules/calendar/parsers.ts` → `normalizeAmountRaw()` valida rangos
- PostgreSQL INTEGER max: 2,147,483,647 (~2.1 billion)
- Límite razonable: 100M CLP (100,000,000)
- Valores fuera de rango se descartan con warning en logs

### 🟢 Balances diarios (CSV + UI)

- CSV de balances diarios acepta fechas `DD/MM/YYYY` (e.g. `28/1/2025`) y limpia montos con `$`, puntos y comas antes de insertarlos; status por defecto `DRAFT`.
- Página `finanzas/production-balances`: distribución más ancha, historial accesible vía ícono (panel flotante opcional), y toggle “Marcar como final” se adapta en pantallas pequeñas.

### 🟢 Sistema RBAC/ABAC (Roles y Permisos)

- Implementation: **CASL + ZenStack**
- Middleware: `authorize('action', 'Subject')` reemplaza a checks manuales.
- Data Filtering: ZenStack policies filtran automáticamente queries (ABAC).
- Frontend: `useCan()` hook para renderizado condicional.
- Admin UI: `/settings/roles` para crear roles y asignar permisos dinámicamente.

---

## Convenciones obligatorias

### Frontend

```tsx
// ✅ CORRECTO - usar DaisyUI tokens
<div className="bg-base-100 text-base-content card shadow">

// ❌ INCORRECTO - colores hardcodeados
<div className="bg-white text-gray-900">

// ✅ CORRECTO - usar Button component
import Button from "@/components/ui/Button";
<Button variant="primary" size="md">Guardar</Button>

// ❌ INCORRECTO - clases ad-hoc
<button className="btn btn-primary">Guardar</button>
```

### Backend

```typescript
// ✅ CORRECTO - PostgreSQL syntax en raw queries
await prisma.$queryRaw`
  SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as date
  FROM events
  WHERE EXTRACT(YEAR FROM created_at) = 2025
`;

// ❌ INCORRECTO - MySQL syntax
await prisma.$queryRaw`
  SELECT DATE_FORMAT(created_at, '%Y-%m-%d') as date
  FROM google_calendar_events  -- tabla incorrecta
`;

// ✅ CORRECTO - nombres de tablas según @@map
// prisma/schema.prisma: model CalendarEvent { @@map("events") }
// En SQL usar: events (no calendar_events ni google_calendar_events)
```

### Manejo de errores

```typescript
// ✅ CORRECTO - try-catch con logging detallado
try {
  await externalApi.call(data);
} catch (error) {
  console.error("[service:method] Error:", { input: data, error });
  throw error;
}
```

---

## Errores comunes (EVITAR)

| Error                                                | Solución                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| Error 524 Cloudflare timeout durante sync            | Sync ahora es asíncrono (202 Accepted), polling automático del log |
| `DATE_FORMAT is not a function`                      | Usar `TO_CHAR()` (PostgreSQL, no MySQL)                            |
| `Unable to fit value X into a 64-bit signed integer` | Validar amounts ≤ 2,147,483,647 en `normalizeAmountRaw()`          |
| `Value out of range for type integer`                | Mismo que arriba - valores exceden Int32 max                       |
| Tab no se marca como activo                          | Agregar `end: true` al TabItem                                     |
| Sync se marca como error muy rápido                  | Timeout es 15min, no 5min                                          |
| `bg-white` no funciona en dark mode                  | Usar `bg-base-100` (DaisyUI)                                       |
| Commit falla por lint                                | Correr `pnpm run lint --fix` primero                               |
| `Cannot find module` en server                       | Correr `pnpm run build:server`                                     |
| Tabla no existe en raw query                         | Verificar `@@map` en schema.zmodel                                 |
| TypeScript error después de ZenStack update          | Correr `cd packages/db && pnpm run build`                          |

---

## Archivos clave por área

### Calendar

- `src/features/calendar/api.ts` — API calls centralizados, sync retorna 202 Accepted
- `src/features/calendar/hooks/useCalendarEvents.ts` — Estado, sync con polling cada 5s
- `apps/api/src/routes/calendar.ts` — Endpoints, sync ahora asíncrono (background)
- `apps/api/src/lib/google/calendar-queries.ts` — Raw SQL (PostgreSQL)
- `apps/api/src/lib/google/calendar-store.ts` — DB upsert con error logging mejorado
- `apps/api/src/services/calendar.ts` — Sync lock (15min timeout)
- `apps/api/src/modules/calendar/parsers.ts` — Parsing de eventos + validación de amounts (Int32)
- `apps/api/src/config.ts` — Patrones de exclusión

### Auth

- `apps/api/src/routes/auth.ts` — Login, passkey, MFA
- `apps/api/src/routes/roles.ts` — Gestión de roles y permisos
- `apps/api/src/services/authz.ts` — Lógica CASL + ABAC
- `src/features/auth/pages/LoginPage.tsx` — UI login

### Finance

- `apps/api/src/routes/transactions.ts` — Preview/import
- `apps/api/src/services/transactions.ts` — upsertWithdrawals
- `src/features/transactions/` — UI

### Config

- `apps/api/src/config.ts` — Session (24h), JWT, calendar config
- `apps/web/tailwind.config.cjs` — Temas DaisyUI
- `apps/web/vite.config.ts` — PWA, build config

---

## Reglas de seguridad (NO ROMPER)

1. **NO eliminar** `/api/transactions/withdrawals/upload` sin verificar callers externos
2. **NO cambiar** session duration (24h) sin aprobación
3. **NO crear** `public/manifest.json` manual (VitePWA lo genera)
4. **NO modificar** migraciones ya deployadas
5. **NO usar** `--no-verify` en commits de producción
6. **PRESERVAR** respuesta de upserts: `{ inserted, updated, skipped, total }`

---

## Herramientas MCP disponibles

Este proyecto tiene configurados los siguientes MCP (Model Context Protocol) tools:

### 🧠 Sequential Thinking

Para problemas complejos que requieren razonamiento paso a paso:

```text
Usar: mcp_sequentialthi_sequentialthinking
Cuándo: Debugging complejo, diseño de arquitectura, análisis de problemas multi-paso
```

### 📚 Context7 (Documentación actualizada)

Para obtener documentación actualizada de librerías:

```text
Usar: mcp_upstash_conte_get-library-docs
Primero: mcp_upstash_conte_resolve-library-id para obtener el ID

Librerías frecuentes:
- Prisma: /prisma/prisma
- React Query: /tanstack/query
- DaisyUI: /saadeghi/daisyui
- Vite: /vitejs/vite
- Express: /expressjs/express
```

### 🐙 GitHub MCP

Para operaciones con GitHub (PRs, issues, branches):

```text
- mcp_github_search_pull_requests
- mcp_github_create_or_update_file
- activate_repository_management_tools (para más herramientas)
```

**Tip**: Usar Sequential Thinking para planificar cambios complejos, luego Context7 para verificar sintaxis de librerías.

---

## Checklist pre-commit

```bash
pnpm run type-check  # ✓ Sin errores de tipos
pnpm run lint        # ✓ Sin errores de lint
pnpm run build       # ✓ Build exitoso
# Solo entonces:
git add -A && git commit -m "feat: descripción clara"
```

---

_Este archivo es la fuente de verdad para cualquier agente de IA trabajando en este repo._

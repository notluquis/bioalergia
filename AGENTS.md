# AGENTS.md — finanzas-app

> **Instrucciones universales para cualquier agente de IA** (Copilot, Claude, Gemini, Codex, Cursor, etc.)
> Última actualización: Diciembre 2025

---

## TL;DR (lee esto primero)

```text
Stack:       React + Vite + TypeScript (frontend) | Node + Express + Prisma + PostgreSQL (backend)
Desarrollo:  npm run dev:full (frontend + backend simultáneo)
Build:       npm run build && npm run build:server
Verificar:   npm run type-check && npm run lint
Deploy:      git push (Railway auto-deploy)
```

**3 reglas de oro:**

1. **NUNCA usar `bg-white`** → usar `bg-base-100` (DaisyUI)
2. **NUNCA crear mock data** → usar APIs reales existentes
3. **SIEMPRE** verificar con `npm run type-check` antes de commit

---

## Stack tecnológico

| Capa     | Tecnología                                | Notas                            |
| -------- | ----------------------------------------- | -------------------------------- |
| Frontend | React 18 + TypeScript + Vite              | Entry: `src/main.tsx`            |
| Styling  | Tailwind CSS + DaisyUI                    | Themes en `tailwind.config.cjs`  |
| State    | TanStack Query + Zustand                  | Hooks en `src/features/*/hooks/` |
| Backend  | Node + Express + TypeScript               | Entry: `server/index.ts`         |
| Database | **PostgreSQL** (via Prisma)               | Schema: `prisma/schema.prisma`   |
| Auth     | Passkey (WebAuthn) + email/password + MFA | Session: 24h                     |
| Deploy   | Railway (auto-deploy on push)             | Dockerfile con node:current-slim |

⚠️ **IMPORTANTE**: La base de datos es **PostgreSQL**, NO MySQL. Usar sintaxis PostgreSQL en raw queries (`TO_CHAR`, `EXTRACT`, etc.)

---

## Comandos esenciales

```bash
# Desarrollo
npm run dev          # Frontend solo (Vite)
npm run server       # Backend solo
npm run dev:full     # Frontend + Backend simultáneo ⭐

# Build y verificación
npm run build        # Build frontend (producción)
npm run build:server # Build backend
npm run type-check   # TypeScript check (OBLIGATORIO antes de commit)
npm run lint         # ESLint

# Testing
npm run test:withdrawals  # Test integración (requiere RUN_WITHDRAWALS_IT=1)

# Base de datos
npx prisma generate       # Regenerar cliente después de cambios en schema
npx prisma migrate dev    # Crear nueva migración
npx prisma migrate status # Verificar estado de migraciones
```

---

## Estructura del proyecto

```text
finanzas-app/
├── src/                    # Frontend React
│   ├── main.tsx           # Entry point + rutas
│   ├── features/          # Módulos por dominio (calendar, auth, finance...)
│   │   └── */api.ts       # API calls centralizados
│   │   └── */hooks/       # Custom hooks
│   │   └── */types.ts     # TypeScript types
│   ├── components/        # Componentes compartidos
│   │   └── ui/            # Primitivos (Button, Input, etc.)
│   └── pages/             # Páginas de rutas
├── server/                 # Backend Express
│   ├── index.ts           # Entry point
│   ├── routes/            # Endpoints API
│   ├── services/          # Lógica de negocio
│   ├── lib/               # Utilidades
│   └── config.ts          # Configuración (sesiones, JWT, calendar)
├── prisma/
│   └── schema.prisma      # Schema de BD (PostgreSQL)
└── generated/             # Cliente Prisma (NO EDITAR)
```

---

## Cambios críticos recientes (Diciembre 2025)

### 🔴 PostgreSQL (NO MySQL)

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

- `server/services/calendar.ts` usa 15min como timeout para marcar syncs como "stale"
- Cambiado de 5min porque syncs grandes se marcaban como error prematuramente

### 🔴 Patrones de exclusión de calendario

- Definidos en `server/config.ts` → `parseExcludePatterns()`
- Excluye automáticamente: "cumpleaños", eventos vacíos, solo fechas
- Se pueden agregar más via `GOOGLE_CALENDAR_EXCLUDE_SUMMARIES` env var

### 🔴 Tabs con `end: true`

- TODOS los tabs en layouts deben tener `end: true` para marcar ruta activa correctamente
- Archivos: `CalendarLayout.tsx`, `HRLayout.tsx`, `ServicesLayout.tsx`, `OperationsLayout.tsx`

### 🟡 Auth: passwordHash nullable

- `prisma/schema.prisma`: `passwordHash String?` (nullable)
- Usuarios passkey-only tienen `passwordHash = null`
- `server/routes/auth.ts` maneja null safely

### 🔴 Amount validation: Int32 limits

- `server/modules/calendar/parsers.ts` → `normalizeAmountRaw()` valida rangos
- PostgreSQL INTEGER max: 2,147,483,647 (~2.1 billion)
- Límite razonable: 100M CLP (100,000,000)
- Valores fuera de rango se descartan con warning en logs

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
| Commit falla por lint                                | Correr `npm run lint --fix` primero                                |
| `Cannot find module` en server                       | Correr `npm run build:server`                                      |
| Tabla no existe en raw query                         | Verificar `@@map` en schema.prisma                                 |

---

## Archivos clave por área

### Calendar

- `src/features/calendar/api.ts` — API calls centralizados, sync retorna 202 Accepted
- `src/features/calendar/hooks/useCalendarEvents.ts` — Estado, sync con polling cada 5s
- `server/routes/calendar-events.ts` — Endpoints, sync ahora asíncrono (background)
- `server/lib/google-calendar-queries.ts` — Raw SQL (PostgreSQL)
- `server/lib/google-calendar-store.ts` — DB upsert con error logging mejorado
- `server/services/calendar.ts` — Sync lock (15min timeout)
- `server/modules/calendar/parsers.ts` — Parsing de eventos + validación de amounts (Int32)
- `server/config.ts` — Patrones de exclusión

### Auth

- `server/routes/auth.ts` — Login, passkey, MFA
- `server/routes/user-management.ts` — CRUD usuarios
- `src/features/auth/pages/LoginPage.tsx` — UI login

### Finance

- `server/routes/transactions.ts` — Preview/import
- `server/db.ts` — upsertWithdrawals
- `src/features/transactions/` — UI

### Config

- `server/config.ts` — Session (24h), JWT, calendar config
- `tailwind.config.cjs` — Temas DaisyUI
- `vite.config.ts` — PWA, build config

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
npm run type-check  # ✓ Sin errores de tipos
npm run lint        # ✓ Sin errores de lint
npm run build       # ✓ Build exitoso
# Solo entonces:
git add -A && git commit -m "feat: descripción clara"
```

---

_Este archivo es la fuente de verdad para cualquier agente de IA trabajando en este repo._

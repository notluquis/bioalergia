# Antigravity/Gemini Project Context & Rules

> **Unified Instructions for AI Assistants**
> derived from project audit and legacy rule files.

## 1. Project Overview

**Name**: Finanzas App (Monorepo)
**Objective**: Medical/financial management system for a healthcare clinic (Bioalergia).
**Language Preference**: User communicates in **Spanish**. Code is in **English/Spanish** mix (domain terms in Spanish, code structure in English).

---

## 2. Technology Stack (Verified 2026)

### Core

- **Package Manager**: `pnpm` (Workspace enabled)
- **Monorepo Tool**: `turbo`
- **Database**: PostgreSQL (Strictly Postgres, NO MySQL syntax)

### Backend (`apps/api`, `packages/db`)

- **Framework**: **Hono** (Migrated from Express) running on Node.js (`@hono/node-server`).
- **ORM**: **ZenStack v3** (Kysely Adapter)
  - **Runtime**: Pure Kysely (`@zenstackhq/orm`, `kysely`, `pg`). **NO `@prisma/client` runtime dependency.**
  - **Migration**: `zen migrate` (wraps Prisma CLI via `prisma` devDependency).
  - **Schema**: `packages/db/zenstack/schema.zmodel`.
- **Auth**: WebAuthn/Passkeys + Session management.

### Frontend (`apps/intranet`)

- **Framework**: **React 19** + **Vite**.
- **Routing**: **TanStack Router** (File-based routing in `src/routes`).
- **Data Fetching**: **TanStack Query** (v5) + **ZenStack Hooks** (`@finanzas/db/hooks`).
- **State Management**: `zustand`.
- **Forms**: `react-hook-form` + `zod`.
- **Styling**: **Tailwind CSS** + **HeroUI v3 Beta 5**.
- **Dates**: `dayjs`.

---

## 3. Critical Rules (DO NOT VIOLATE)

### 🎨 Styling & UI

1.  **Semantic Tokens ONLY**:
    - ✅ Use: `bg-background`, `bg-content1`, `text-foreground`, `text-default-500`, `text-success`, `bg-danger/10`.
    - ❌ NEVER Use: `bg-white`, `text-gray-900`, hardcoded hex, `bg-base-100` (DaisyUI).
2.  **Contrast**: Use `text-default-500` or `text-foreground/70` for metadata.
3.  **Layout**: Respect safe areas (Harmonic Layout) using `pt-[env(safe-area-inset-top)]`.
4.  **Components**: Use **HeroUI v3** components for all UI elements. Do NOT use DaisyUI or hardcoded CSS.

### 🔐 Security & Access Control

1.  **RBAC (Role-Based Access Control)**:
    - ❌ NEVER hardcode role checks: `if (role === 'GOD')`.
    - ✅ ALWAYS use permission checks: `req.ability.can(...)` (Backend) or `useAuth().can(...)` (Frontend).
2.  **Validation**:
    - All inputs must be validated with **Zod**.
    - Financial amounts must be validated (Postgres `Int` limits).

### 💾 Database & Data Access

1.  **Postgres Syntax**:
    - Use `TO_CHAR()` (not `DATE_FORMAT`).
    - Use `EXTRACT()` for date parts.
2.  **ZenStack Pattern**:
    - **Backend**: Use `db.user.findMany(...)` (Kysely-based ZenStack client).
    - **Frontend**: Use generated hooks: `useFindManyUser()`, `useCreateTransaction()`.
    - **Schema**: Edit `schema.zmodel` (NOT `schema.prisma`). Run `pnpm generate` to update.

### 🏗️ Architecture & Folder Structure

1.  **Feature-Based**: `src/features/{domain}/` (contains `api.ts`, `hooks/`, `components/`, `types.ts`).
2.  **Routing**: Route definitions in `src/routes/` (TanStack Router file-system conventions).
3.  **Exports**: Prefer named exports over `export default`.

---

## 4. Development Workflow

1.  **Start Dev**: `pnpm dev` (Runs backend and frontend).
2.  **Schema Changes**:
    - Edit `packages/db/zenstack/schema.zmodel`.
    - `pnpm generate` (Regenerates types/hooks).
    - `zen migrate dev` (Creates DB migration).
3.  **Lint/Check**: `pnpm type-check` && `pnpm lint`.

## 5. Deployment (Railway "Golden Standard")

**Configuration**:

- **Infrastructure**: Defined in per-app `railway.json` + per-app `Dockerfile`.
- **Strategy**: Dockerfile multi-stage builds (Turbo prune per app).
- **Service**: Single Service (API + Static Frontend).
  - API serves static frontend files from `./public`.

**Golden Rules**:

1.  **Optimization**: Use `turbo prune --scope=...` to isolate dependencies.
2.  **Environment**:
    - Variables managed in Railway Dashboard.
    - Check for `DATABASE_URL`, `PORT`, `NODE_ENV`.
3.  **Health Checks**: Ensure `/health` endpoint is active (Timeout: 30s).
4.  **Persistence**: Postgres database provided by Railway (configured via `DATABASE_URL`).
5.  **Logs**: Monitor Railway logs for `[Hono]` request traces.

## 6. Common Pitfalls to Avoid

- **Prisma Imports**: Do NOT import `@prisma/client` in application code. Use `@finanzas/db` exports.
- **Router Types**: If `Argument of type...` errors appear in routes, run `pnpm dev` to update `routeTree.gen.ts`.
- **Date Handling**: Always use `dayjs`, rarely JS `Date`.

# finanzas-app — Copilot / AI agent quick instructions

Short, actionable guidance so an AI agent can be productive immediately in this repo.

## Recent Critical Changes (2025 Standards)

### 1. Semantic Roles (RBAC)

- **NEVER** check for `role === 'GOD'` or `'ADMIN'`.
- **ALWAYS** use permission checks:
  - Backend: `authorize('manage', 'Employee')`
  - Frontend: `const { can } = useAuth(); if (can('read', 'CalendarEvent')) ...`

### 2. Styling & Layout (Harmonic Design)

- **Harmonic Layout**: Use `pt-[env(safe-area-inset-top)]` for safe areas.
- **Semantic Colors**: Use `bg-base-100` (NOT `bg-white`).
- **Contrast**: Use `text-base-content/70` for metadata.
- **Badges**: Use alpha variants `bg-success/15 text-success` (NOT `bg-emerald-100`).

### 3. React 19 & Architecture

- Code is organized by feature in `src/features/{domain}/`.
- Use `<Context>` providers (new React 19 syntax).
- Heavy components are lazy loaded via `React.lazy`.

---

## 1. High-level architecture

- **Frontend**: React 19 + TypeScript + Vite (`src/`). DaisyUI theme.
- **Backend**: Node + Express + TypeScript (`server/`).
- **Database**: PostgreSQL via Prisma (`server/db.ts`). RAW SQL MUST BE POSTGRESQL.

## 2. Key Developer Commands

- Full Dev: `npm run dev:full`
- Type Check: `npm run type-check` (REQUIRED)
- Lint: `npm run lint` (REQUIRED)

## 3. Project Conventions

- **UI**: DaisyUI semantic classes only (`btn`, `card`, `input`). No hardcoded colors.
- **Forms**: `react-hook-form` + `zod`.
- **API**: Use centralized APIs in `src/features/*/api.ts`.
- **State**: Use `useQuery` hooks in `src/features/*/hooks/`.

## 4. Safety Rules (Critical)

1. **Migrations**: Never modify deployed migrations. Create new ones.
2. **Session**: Do not change 24h duration in `server/config.ts`.
3. **Login**: Maintain minimalist passkey-first design.
4. **Amount Type**: Validate Int32 max (2,147,483,647) for amounts.

## 5. Quick Snippets

### Semantic Button

```tsx
import Button from "@/components/ui/Button";
<Button variant="primary" onClick={save}>
  Save
</Button>;
```

### Safe Area Padding

```tsx
<div className="pt-[env(safe-area-inset-top)]">...</div>
```

### Permission Check

```tsx
const { can } = useAuth();
{
  can("manage", "User") && <Button>Edit User</Button>;
}
```

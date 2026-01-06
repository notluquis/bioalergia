# finanzas-app — Copilot / AI agent quick instructions

Short, actionable guidance so an AI agent can be productive immediately in this repo.

## Recent Critical Changes (2026 Standards)

### 1. React 19 Compiler (MANDATORY)

- **NEVER** use `useMemo`, `useCallback`, or `React.memo` for simple cases.
- **React Compiler** automatically memoizes components and values.
- **ONLY** use `useMemo` for expensive computations (complex Map operations, heavy aggregations).
- **Event handlers**: Write inline `onClick={() => ...}` - compiler stabilizes them.
- **Static data**: Move outside component as `const COLUMNS = [...]`.
- **useEffect**: KEEP for legitimate side effects (data fetching, subscriptions).

Examples:
```tsx
// ❌ WRONG - Unnecessary memoization
const onClick = useCallback(() => setValue(x), [x]);
const data = useMemo(() => query.data ?? [], [query.data]);

// ✅ CORRECT - Let compiler handle it
<Button onClick={() => setValue(x)}>Save</Button>
const data = query.data ?? [];

// ✅ CORRECT - Expensive computation justified
const accountRows = useMemo(() => {
  // 50+ lines of Map operations, grouping, sorting
  return complexAggregation(data);
}, [data]);
```

### 2. Semantic Roles (RBAC/ABAC)

- **NEVER** check for `role === 'GOD'` or `'ADMIN'`.
- **ALWAYS** use permission checks:
  - Backend: `authorize('manage', 'Employee')`
  - Frontend: `const { can } = useAuth(); if (can('read', 'CalendarEvent')) ...`

### 3. Styling & Layout (Harmonic Design)

- **Harmonic Layout**: Use `pt-[env(safe-area-inset-top)]` for safe areas.
- **Semantic Colors**: Use `bg-base-100` (NOT `bg-white`).
- **Contrast**: Use `text-base-content/70` for metadata.
- **Badges**: Use alpha variants `bg-success/15 text-success` (NOT `bg-emerald-100`).

### 4. Architecture & Build

- Code organized by feature in `src/features/{domain}/`.
- Use `<Context>` providers (React 19 syntax).
- Heavy components lazy loaded via `React.lazy`.
- Vite 7 with **official plugins only** (no third-party Rollup plugins).

---

## 1. High-level architecture

- **Frontend**: React 19 + TypeScript + Vite 7 (`apps/web/`). DaisyUI theme.
- **Backend**: Node 25 + Express + TypeScript (`apps/api/`).
- **Database**: PostgreSQL via **ZenStack 3.1.1** (pure Kysely ORM). RAW SQL MUST BE POSTGRESQL.
- **Monorepo**: pnpm workspaces with Turbo 2.7.3.

## 2. Key Developer Commands

- Full Dev: `pnpm run dev:full` (frontend + backend)
- Type Check: `pnpm run type-check` (REQUIRED before commit)
- Lint: `pnpm run lint` (REQUIRED)
- Build: `pnpm run build && pnpm run build:server`
- DB Schema: `cd packages/db && pnpm run build` (regenerates ZenStack + fixes imports)

## 3. Project Conventions

- **UI**: DaisyUI semantic classes only (`btn`, `card`, `input`). No hardcoded colors.
- **Forms**: `react-hook-form` + `zod`.
- **API**: Use centralized APIs in `src/features/*/api.ts`.
- **State**: Use `useQuery` hooks in `src/features/*/hooks/`.
- **Memoization**: Let React Compiler handle it. Only use `useMemo` for expensive operations.

## 4. Safety Rules (Critical)

1. **Migrations**: Never modify deployed migrations. Create new ones.
2. **Session**: Do not change 24h duration in `apps/api/src/config.ts`.
3. **Login**: Maintain minimalist passkey-first design.
4. **Amount Type**: Validate Int32 max (2,147,483,647) for amounts.
5. **ZenStack**: After updating, run `cd packages/db && pnpm run build` (includes fix-imports).
6. **Vite Plugins**: Only use official plugins from Vite ecosystem.

## 5. Quick Snippets

### React Component (2026)

```tsx
// ✅ Modern React 19 - No manual memoization
export function MyComponent({ data }: Props) {
  const filteredData = data.filter(x => x.active); // Compiler memoizes
  
  return (
    <div>
      {filteredData.map(item => (
        <Button key={item.id} onClick={() => handleClick(item)}>
          {item.name}
        </Button>
      ))}
    </div>
  );
}

// Static data outside component
const COLUMNS = [
  { key: "name", label: "Name" },
  { key: "status", label: "Status" },
];
```

### Semantic Button

```tsx
import Button from "@/components/ui/Button";
<Button variant="primary" onClick={() => save()}>Save</Button>
```

### Safe Area Padding

```tsx
<div className="pt-[env(safe-area-inset-top)]">...</div>
```

### Permission Check

```tsx
const { can } = useAuth();
{can("manage", "User") && <Button>Edit User</Button>}
```

### ZenStack Query (ABAC)

```typescript
// Backend - automatic filtering by access policies
const transactions = await db.transaction.findMany({
  where: { type: "INCOME" }
}); // Only returns transactions user can access
```

## 6. Common Pitfalls

❌ **DON'T:**
- Use `useMemo(() => data ?? [], [data])` - unnecessary
- Use `useCallback` for simple event handlers
- Wrap components in `React.memo` - compiler handles it
- Use `bg-white` or hardcoded Tailwind colors
- Use third-party Rollup plugins with Vite 7
- Modify generated ZenStack files manually

✅ **DO:**
- Write inline event handlers: `onClick={() => ...}`
- Move static arrays/objects outside components
- Use semantic DaisyUI colors: `bg-base-100`
- Use official Vite plugins only
- Run `pnpm run build` in packages/db after schema changes
- Check `pnpm run type-check` before committing

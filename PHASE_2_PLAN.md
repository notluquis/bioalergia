# Phase 2: Page Refactoring & PWA Implementation

## Progress Summary (Phase 1)

- ✅ Design system complete (tokens, layout primitives, icons)
- ✅ Tooling configured (Prettier, strict TypeScript, pre-commit hooks)
- ⏳ TypeScript errors: 156 → 42 (73% reduction, 42 remaining)

## Remaining TypeScript Errors (42 total)

**Pattern Analysis:**

- 10 errors: server/db.ts - Object/array possibly undefined
- 12 errors: src/pages/Timesheets.tsx - Object possibly undefined, type mismatches
- 8 errors: src/features/supplies/\* - currentRequest possibly undefined
- 4 errors: src/features/services/\* - schedule.transaction possibly undefined
- 3 errors: src/pages/Loans.tsx, Counterparts.tsx - employee_id possibly undefined
- 3 errors: src/lib/\*.ts - Type 'boolean' assigned to 'string'
- 2 errors: String | undefined → string conversions

**Fix Strategy:**

- Use non-null assertions (!) where values are guaranteed by business logic
- Add optional chaining (?.) for nullable properties
- Add early return guards for critical paths
- Convert string | undefined with || "" fallback

## Phase 2 Roadmap

### 2.1 Complete TypeScript Strict Mode (Est: 2h)

```typescript
// Pattern 1: Non-null assertion for guaranteed values
employee.employee_id! // When employee exists from find()

// Pattern 2: Optional chaining + fallback
currentRequest?.employee_id || 0 // When value might be missing

// Pattern 3: Early guard
const row = data.find(...);
if (!row) return;
// Now row is guaranteed defined
```

### 2.2 Identify Pages for Refactoring (20 pages)

**Existing Pages:**

1. /dashboard (Home.tsx)
2. /employees (Employees.tsx)
3. /counterparts (Counterparts.tsx)
4. /services (Services.tsx)
5. /loans (Loans.tsx)
6. /supplies (Supplies.tsx)
7. /timesheets (Timesheets.tsx)
8. /transactions (Transactions.tsx)
9. /calendar (Calendar.tsx)
10. /reports (Reports.tsx)
11. /settings (Settings.tsx)
12. /optimization-examples (OptimizationExamples.tsx)

**Priority Order:** Counterparts → Services → Loans (simpler CRUD) → Timesheets/Transactions (complex)

### 2.3 Reference Implementation Pattern

**Counterparts.tsx Refactor (First Target):**

```tsx
import { PageHeader, Card, Section, Stack, Inline } from "@/components/Layout";
import { spacing } from "@/design-system/tokens";

export function Counterparts() {
  return (
    <Stack spacing="lg">
      <PageHeader
        title="Contrapartes"
        subtitle="Gestión de empresas y contactos"
        actions={
          <Button variant="primary" size="md" onClick={handleNew}>
            + Nueva Contraparte
          </Button>
        }
      />

      <Section>
        <Card padding="default">
          {/* Search & Filters */}
          <Inline justify="between" align="center" spacing="md">
            <input className="input input-bordered" placeholder="Buscar..." />
            <select className="select select-bordered">...</select>
          </Inline>
        </Card>
      </Section>

      <Section>
        <Card padding="default">
          {/* Table with DaisyUI classes */}
          <table className="table table-zebra">...</table>
        </Card>
      </Section>
    </Stack>
  );
}
```

**Checklist per Page:**

- [ ] Replace manual spacing with `<Stack spacing="md">` or `<Inline spacing="sm">`
- [ ] Wrap content in `<PageHeader>` + `<Section>` + `<Card>`
- [ ] Use `<Button>` wrapper instead of raw `<button>`
- [ ] Replace hardcoded `bg-white` → `bg-base-100`, `rounded-xl` → `card`
- [ ] Forms: use `input input-bordered`, `select select-bordered`
- [ ] Add inline validation on blur
- [ ] Ensure 44px touch targets for mobile
- [ ] Test dark mode (toggle ThemeToggle)

### 2.4 PWA Configuration (Est: 3h)

**Files to Create:**

```
public/manifest.json
public/icons/ (192x192, 512x512 PNG)
public/sw.js (service worker)
```

**manifest.json:**

```json
{
  "name": "Finanzas App",
  "short_name": "Finanzas",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0ea5e9",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

**index.html updates:**

```html
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#0ea5e9" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<link rel="apple-touch-icon" href="/icons/icon-192.png" />
```

### 2.5 iOS Bottom Navigation (Est: 4h)

**Component Structure:**

```tsx
// src/components/Navigation/BottomNav.tsx
export function BottomNav() {
  const { pathname } = useLocation();

  const tabs = [
    { path: "/", icon: Home, label: "Inicio" },
    { path: "/employees", icon: Users, label: "Personal" },
    { path: "/services", icon: Calendar, label: "Servicios" },
    { path: "/reports", icon: ChartBar, label: "Reportes" },
  ];

  return (
    <nav className="btm-nav btm-nav-lg md:hidden fixed bottom-0 z-50 bg-base-100 border-t border-base-300">
      {tabs.map((tab) => (
        <button
          key={tab.path}
          onClick={() => navigate(tab.path)}
          className={cn("flex flex-col items-center gap-1 px-4 py-2", pathname === tab.path && "text-primary")}
        >
          <tab.icon className="w-6 h-6" />
          <span className="text-xs">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
```

**Layout Integration:**

```tsx
// src/App.tsx
<div className="min-h-screen pb-safe-bottom md:pb-0">
  <Sidebar /> {/* Desktop only */}
  <main className="md:ml-64 pb-16 md:pb-0">
    <Routes>...</Routes>
  </main>
  <BottomNav /> {/* Mobile only */}
</div>
```

### 2.6 Database Migration (Est: 4h)

**Steps:**

1. Run `npx prisma db pull` to sync schema.prisma with current DB
2. Generate initial migration: `npx prisma migrate dev --name init`
3. Create repository interfaces in `server/repositories/`
4. Implement repository pattern for each domain
5. Update routes to use repositories instead of direct DB access

**Repository Pattern:**

```typescript
// server/repositories/counterparts.repository.ts
export class CounterpartsRepository {
  async findAll(): Promise<Counterpart[]> {
    return prisma.counterpart.findMany();
  }

  async findById(id: number): Promise<Counterpart | null> {
    return prisma.counterpart.findUnique({ where: { id } });
  }

  async create(data: CreateCounterpart): Promise<Counterpart> {
    return prisma.counterpart.create({ data });
  }

  async update(id: number, data: UpdateCounterpart): Promise<Counterpart> {
    return prisma.counterpart.update({ where: { id }, data });
  }

  async delete(id: number): Promise<void> {
    await prisma.counterpart.delete({ where: { id } });
  }
}
```

### 2.7 Testing Suite (Est: 6h)

**Test Structure:**

```
test/
  unit/
    repositories/
      counterparts.test.ts
      employees.test.ts
    utils/
      rut.test.ts
      currency.test.ts
  integration/
    api/
      counterparts.test.ts
```

**Example Test:**

```typescript
// test/unit/repositories/counterparts.test.ts
describe("CounterpartsRepository", () => {
  let repository: CounterpartsRepository;

  beforeEach(() => {
    repository = new CounterpartsRepository();
  });

  it("should find all counterparts", async () => {
    const result = await repository.findAll();
    expect(result).toBeInstanceOf(Array);
  });

  it("should create a counterpart", async () => {
    const data = { name: "Test Corp", rut: "12345678-9" };
    const result = await repository.create(data);
    expect(result.name).toBe("Test Corp");
  });
});
```

**Coverage Target:** 80% for repositories, services, utilities

## Estimated Timeline

- Phase 2.1: TypeScript cleanup → 2h
- Phase 2.2-2.3: First 5 pages refactored → 8h
- Phase 2.4: PWA setup → 3h
- Phase 2.5: Mobile navigation → 4h
- Phase 2.6: Database migration → 4h
- Phase 2.7: Testing suite → 6h

**Total:** ~27 hours of focused development

## Success Metrics

- ✅ 0 TypeScript errors in strict mode
- ✅ All pages use design system primitives
- ✅ PWA installable on iOS/Android
- ✅ Bottom navigation functional on mobile
- ✅ 80% test coverage for critical paths
- ✅ All API routes use repository pattern

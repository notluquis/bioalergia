# Migration Status - Apple-Grade PWA Transformation

**Started:** November 4, 2025  
**Branch:** `upgrade-css-toolchain`  
**Objective:** Transform finanzas-app into production-ready, mobile-first PWA with pixel-perfect design consistency

---

## ✅ Completed (Phase 1 - Foundation)

### Design System Foundation

- ✅ Created `/src/design-system/tokens.ts` with strict spacing/typography scales (4px grid)
- ✅ Created `/src/design-system/README.md` with Apple-grade design principles
- ✅ Created `/src/design-system/icons.md` documenting 30-icon whitelist
- ✅ Created `/src/design-system/icons.ts` with centralized exports

### Layout Primitives

- ✅ Created `/src/components/Layout/Card.tsx` (padding variants: compact/default/spacious)
- ✅ Created `/src/components/Layout/PageHeader.tsx` (title, description, actions)
- ✅ Created `/src/components/Layout/Section.tsx` (semantic sections)
- ✅ Created `/src/components/Layout/Stack.tsx` (vertical flex with token spacing)
- ✅ Created `/src/components/Layout/Inline.tsx` (horizontal flex with token spacing)
- ✅ Created `/src/components/Layout/Grid.tsx` (responsive grid with breakpoints)

### Tooling & Code Quality

- ✅ Created `.prettierrc.json` (printWidth: 120, semi: true, singleQuote: false)
- ✅ Updated `tsconfig.json` with strict mode + additional checks
- ✅ Configured husky + lint-staged for auto-fix pre-commit hooks
- ✅ Added `rollup-plugin-visualizer` to `vite.config.ts` (bundle analysis at `dist/stats.html`)
- ✅ Removed `date-fns` dependency, replaced with `dayjs` in `/server/modules/calendar/parsers.ts`

### Toast Notification System

- ✅ Created `/src/context/toast-context.tsx` with ToastProvider
- ✅ Implemented DaisyUI alert variants (success, error, warning, info)
- ✅ Added auto-dismiss (5s default), max 3 simultaneous toasts
- ✅ Added slide-in-right animation to `/src/index.css`

---

## ⚠️ Known Issues (Strict TypeScript Errors)

Running `npm run type-check` shows **~70 errors** from strict mode:

- `server/db.ts`: Array access with `noUncheckedIndexedAccess` (e.g., `rows[0]` might be undefined)
- `server/lib/rut.ts`: Possibly undefined string manipulation
- `/src/components/Layout/*.tsx`: Fixed JSX namespace issues (changed to `React.ElementType`)

**Action Required:** Fix type errors before proceeding with page refactoring.

---

## 🔄 In Progress / Next Steps

### Immediate (Week 1)

1. **Fix TypeScript strict mode errors**
   - Add null checks to `server/db.ts` array access
   - Fix `server/lib/rut.ts` optional chaining
   - Ensure all components compile

2. **Refactor Counterparts.tsx as reference**
   - Replace ad-hoc spacing with tokens
   - Use `<PageHeader>`, `<Card>`, `<Section>` primitives
   - Ensure 44px touch targets on buttons/inputs
   - Document pattern for other pages

3. **PWA Configuration**
   - Install `vite-plugin-pwa@^0.21.0`
   - Create `public/manifest.json` with brand colors
   - Add meta tags to `index.html`
   - Create `<OfflineBanner>` component
   - Test on iPhone 14 Pro (Safari) + Pixel 8 (Chrome)

### Short-term (Week 2-3)

4. **iOS-Style Bottom Navigation**
   - Design 5-item bottom tab bar (Home, Finanzas, Servicios, Gestión, Config)
   - Hidden on `lg:` breakpoint (desktop keeps sidebar)
   - Active state: primary color + bold text
   - Safe-area-inset support for iOS home indicator

5. **Batch Page Refactoring**
   - Refactor 20+ pages in `/src/pages/` to use design system
   - Priority order: Counterparts → Timesheets → Services → Employees → Loans
   - Each page PR includes screenshots (light + dark mode)

6. **Prisma Migration**
   - Run `npx prisma db pull` against production DB
   - Add relations/indexes/enums to schema
   - Generate baseline migration
   - Replace `migrationRunner.ts` with `prisma migrate deploy`

### Medium-term (Week 4+)

7. **Repository Pattern**
   - Extract 6 domain repositories (transactions, counterparts, employees, loans, services, inventory)
   - Update route handlers to use repositories
   - Add ESLint rule: `no-restricted-imports` for `../db.js`

8. **Security Hardening**
   - Install `express-rate-limit@^7.1.0`
   - Protect `/api/auth/login` (5 attempts / 15 min)
   - Add global error boundary to `App.tsx`

9. **Unit Tests (80% coverage)**
   - Create `/test/unit/server/` and `/test/unit/src/` structure
   - Critical paths: loans, services, timesheets, auth, RBAC
   - Configure coverage thresholds in `vite.config.ts`

10. **Form Validation**
    - Create `useFormValidation` hook
    - Implement inline blur validation
    - Refactor forms to show errors immediately

---

## 📊 Migration Metrics

| Category           | Status         | Progress        |
| ------------------ | -------------- | --------------- |
| Design Tokens      | ✅ Complete    | 100%            |
| Layout Primitives  | ✅ Complete    | 100%            |
| Icon System        | ✅ Complete    | 100%            |
| Tooling Setup      | ✅ Complete    | 100%            |
| Toast System       | ✅ Complete    | 100%            |
| TypeScript Strict  | ⚠️ Errors      | 0% (70 errors)  |
| Page Refactoring   | ❌ Not Started | 0% (0/20 pages) |
| PWA Configuration  | ❌ Not Started | 0%              |
| iOS Navigation     | ❌ Not Started | 0%              |
| Prisma Migration   | ❌ Not Started | 0%              |
| Repository Pattern | ❌ Not Started | 0% (0/6 repos)  |
| Unit Tests         | ❌ Not Started | 0% coverage     |

---

## 🚀 Commands

```bash
# Development
npm run dev              # Start frontend (Vite)
npm run server           # Start backend
npm run dev:full         # Start both

# Quality Checks
npm run type-check       # TypeScript (70 errors currently)
npm run lint             # ESLint
npm run format           # Prettier
npm run format:check     # Check formatting

# Build
npm run build            # Production build (generates dist/stats.html bundle report)
npm run preview          # Preview production build

# Testing
npm run test             # Run Vitest
npm run test:coverage    # Run with coverage
npm run test:withdrawals # Integration test (needs env vars)

# Migrations
npx prisma db pull       # Introspect existing DB
npx prisma migrate dev   # Create migration
npx prisma migrate deploy # Run migrations (production)
```

---

## 📝 Design Principles Reminder

1. **Use ONLY spacing tokens** - No `p-7`, `gap-5`, `rounded-[13px]`
2. **Touch targets ≥44px** - Button `md` size default, Input `h-11`
3. **Typography with line-height** - `text-2xl leading-8`, never just `text-2xl`
4. **DaisyUI semantic colors only** - `bg-base-100`, `text-primary` (no `#fff`, `rgb()`)
5. **Icons from whitelist** - Import from `/src/design-system/icons.ts`
6. **Component reusability** - Use `<Card>`, `<PageHeader>`, `<Stack>`, etc.
7. **Mobile-first responsive** - Test on 390px (iPhone), 768px (iPad), 1920px (desktop)

---

## 🎯 Success Criteria (MVP)

- [ ] Zero TypeScript errors with strict mode
- [ ] All 20 pages refactored to use design system
- [ ] PWA installable on iOS + Android
- [ ] iOS-style bottom navigation on mobile
- [ ] Prisma migrations replace custom runner
- [ ] 6 domain repositories extracted
- [ ] 80% unit test coverage on business logic
- [ ] Bundle size <500KB gzipped (track with visualizer)
- [ ] Dark mode verified on all pages
- [ ] No design inconsistencies (spacing, colors, typography)

---

**Next Session:** Fix TypeScript strict mode errors, then refactor Counterparts.tsx as reference implementation.

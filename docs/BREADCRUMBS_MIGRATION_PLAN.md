# Migration Plan: Route Files to Router Context Pattern

## Status: Phase 1 Complete ✅

### Phase 1: Header Component ✅
- [x] Update imports (remove BreadcrumbsItem, add Breadcrumbs only)
- [x] Change useMatches() to useRouterState({ select: (s) => s.matches })
- [x] Update helper functions to use match.context instead of match.staticData
- [x] Change JSX to Breadcrumbs.Item dot notation
- [x] Fix TypeScript type errors (use Record<string, unknown> with type guards)
- [x] Verify build succeeds
- [x] Create migration documentation
- [x] Commit changes

**Build status**: ✅ Success (17.56s, 5685 modules, 0 errors)

## Phase 2: Route Files Migration (TODO)

### Priority 1: Simple Routes (10-15 files)
Routes with static breadcrumbs/titles - easiest to migrate first.

**Target files:**
```
_authed/services/create.tsx
_authed/services/agenda.tsx
_authed/services/templates.tsx
_authed/settings/users.tsx
_authed/hr/employees.tsx
_authed/hr/timesheets.tsx
_authed/hr/audit.tsx
_authed/hr/reports.tsx
_authed/operations/inventory.tsx
_authed/operations/supplies.tsx
_authed/calendar/schedule.tsx
_authed/calendar/heatmap.tsx
_authed/calendar/sync-history.tsx
_authed/certificates/medical.tsx
_authed/finanzas/participants.tsx
```

**Migration steps per file:**
1. Find `staticData` object
2. Extract `breadcrumb` and/or `title` properties
3. Keep other staticData properties (nav, permission) unchanged
4. Add or modify `beforeLoad` to return context
5. Include `getTitle: () => "Title"` in context
6. Optionally include `getBreadcrumb: () => "Label"` if different from title
7. Test navigation

**Example transformation:**
```tsx
// BEFORE
export const Route = createFileRoute("/_authed/services/create")({
  staticData: {
    breadcrumb: "Crear",
  },
  beforeLoad: ({ context }) => {
    // existing logic...
  },
  component: () => <CreateServicePage />,
});

// AFTER
export const Route = createFileRoute("/_authed/services/create")({
  beforeLoad: ({ context }) => {
    // existing logic...
    return {
      ...context,
      getTitle: () => "Crear Servicio",
      getBreadcrumb: () => "Crear",
    };
  },
  component: () => <CreateServicePage />,
});
```

### Priority 2: Routes with Dynamic Data (5-10 files)
Routes that use functions in breadcrumb (access loaderData).

**Considerations:**
- Need to coordinate with loader data
- May require accessing parent matches
- More complex type handling

**Example files:**
```
_authed/patients/$id/index.tsx
_authed/patients/$id/new-consultation.tsx
_authed/services/$id.edit.tsx
```

**Pattern for dynamic data:**
```tsx
export const Route = createFileRoute("/_authed/patients/$id")({
  loader: async ({ params }) => {
    const patient = await fetchPatient(params.id);
    return { patient };
  },
  beforeLoad: ({ context, params }) => {
    return {
      ...context,
      getTitle: () => {
        // Access loader data reactively or use fallback
        return "Paciente"; // Can be enhanced with loader data
      },
      getBreadcrumb: () => params.id,
    };
  },
  component: () => <PatientDetailPage />,
});
```

### Priority 3: Parent/Layout Routes (5 files)
Routes that affect navigation structure.

**Files:**
```
_authed.tsx
_authed/services.tsx
_authed/settings.tsx
_authed/hr.tsx
_authed/operations.tsx
```

### Testing Strategy

After each batch of migrations:
1. Run `pnpm build` to verify no compile errors
2. Run `pnpm run biome:check` to verify linter compliance
3. Test navigation in browser (dev mode)
4. Verify breadcrumbs appear correctly
5. Commit batch with descriptive message

### Rollout Plan

**Day 1:**
- Migrate 5 simple routes
- Test thoroughly
- Commit if successful

**Day 2:**
- Migrate remaining simple routes (10 more)
- Test thoroughly
- Commit if successful

**Day 3:**
- Migrate dynamic routes (5-10)
- Test thoroughly
- Commit if successful

**Day 4:**
- Migrate parent/layout routes (5)
- Final testing
- Update BREADCRUMBS_MIGRATION.md with lessons learned

### Validation Checklist

For completion:
- [ ] All routes with breadcrumbs migrated to context pattern
- [ ] No staticData.breadcrumb or staticData.title remaining (grep search confirms)
- [ ] Build succeeds with 0 errors
- [ ] No new linter warnings
- [ ] Breadcrumbs render correctly in browser
- [ ] Navigation works as expected
- [ ] Parent/child route relationships preserved

### Rollback Plan

If issues arise:
1. Git revert to last working commit
2. Document issue in BREADCRUMBS_MIGRATION.md
3. Fix Header.tsx if needed
4. Re-attempt migration with fix

### Current Stats
- Total route files: 60+
- Routes with staticData: 20+ (from grep search)
- Routes to migrate: ~20-25 (estimate)
- Phase 1 complete: Header.tsx ✅
- Phase 2 start: Ready to begin simple route migrations

---

## Notes

1. **Backwards compatibility**: Current implementation supports both patterns temporarily. Routes without context will fall back to showing "Inicio" as default title.

2. **Type safety improvement**: Once all routes migrated, can enhance context types in __root.tsx to make getTitle/getBreadcrumb required for specific route groups.

3. **Performance**: No impact expected - context access is equivalent to staticData access in terms of performance.

4. **Future enhancements**: Can add meta tags (og:title, description) using same pattern in future.

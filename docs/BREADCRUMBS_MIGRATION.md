# Breadcrumbs Migration Guide

## Overview
Migrated from `staticData` pattern to TanStack Router's `context` pattern for better type-safety and modern standards (2026 best practices).

## What Changed in Header.tsx

### 1. Import Update
**Before:**
```tsx
import { Breadcrumbs, BreadcrumbsItem } from "@heroui/react";
import { Link, useMatches, useNavigate, useRouterState } from "@tanstack/react-router";
```

**After:**
```tsx
import { Breadcrumbs } from "@heroui/react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
```

### 2. Hook Usage
**Before:**
```tsx
const matches = useMatches();
```

**After:**
```tsx
const matches = useRouterState({ select: (s) => s.matches });
```

### 3. Helper Functions
**Before (staticData pattern):**
```tsx
const getMatchLabel = (match: {
  staticData: { breadcrumb?: unknown; title?: string };
  loaderData: unknown;
}): string => {
  const { breadcrumb, title } = match.staticData;
  if (typeof breadcrumb === "function") {
    return breadcrumb(match.loaderData);
  }
  if (typeof breadcrumb === "string") {
    return breadcrumb;
  }
  return title || "";
};
```

**After (context pattern):**
```tsx
const getMatchLabel = (match: { context: Record<string, unknown> }): string => {
  const { getBreadcrumb, getTitle } = match.context;
  if (typeof getBreadcrumb === "function") {
    return getBreadcrumb();
  }
  if (typeof getTitle === "function") {
    return getTitle();
  }
  return "";
};
```

### 4. JSX Component
**Before:**
```tsx
<BreadcrumbsItem key={crumb.to || i}>
  {crumb.label}
</BreadcrumbsItem>
```

**After (dot notation):**
```tsx
<Breadcrumbs.Item key={crumb.to || i}>
  {crumb.label}
</Breadcrumbs.Item>
```

## How to Migrate Route Files

### Example 1: Simple Breadcrumb

**Before (staticData):**
```tsx
export const Route = createFileRoute("/_authed/services/create")({
  staticData: {
    breadcrumb: "Crear",
  },
  beforeLoad: ({ context }) => {
    if (!context.auth.can("create", "Service")) {
      const routeApi = getRouteApi("/_authed/services/create");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => <CreateServicePage />,
});
```

**After (context pattern):**
```tsx
export const Route = createFileRoute("/_authed/services/create")({
  beforeLoad: ({ context }) => {
    // Permission check
    if (!context.auth.can("create", "Service")) {
      const routeApi = getRouteApi("/_authed/services/create");
      throw routeApi.redirect({ to: "/" });
    }
    
    // Return context with breadcrumbs
    return {
      ...context,
      getTitle: () => "Crear Servicio",
      getBreadcrumb: () => "Crear",
    };
  },
  component: () => <CreateServicePage />,
});
```

### Example 2: Route with Title

**Before (staticData):**
```tsx
export const Route = createFileRoute("/_authed/settings/users")({
  staticData: {
    title: "Gestión de usuarios",
    nav: { iconKey: "Users", label: "Usuarios", order: 1, section: "Sistema" },
    permission: { action: "read", subject: "User" },
  },
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "User")) {
      const routeApi = getRouteApi("/_authed/settings/users");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => <UserManagementPage />,
});
```

**After (context pattern):**
```tsx
export const Route = createFileRoute("/_authed/settings/users")({
  staticData: {
    // Keep non-breadcrumb staticData unchanged
    nav: { iconKey: "Users", label: "Usuarios", order: 1, section: "Sistema" },
    permission: { action: "read", subject: "User" },
  },
  beforeLoad: ({ context }) => {
    // Permission check
    if (!context.auth.can("read", "User")) {
      const routeApi = getRouteApi("/_authed/settings/users");
      throw routeApi.redirect({ to: "/" });
    }
    
    // Return context with breadcrumbs
    return {
      ...context,
      getTitle: () => "Gestión de usuarios",
      getBreadcrumb: () => "Usuarios", // Optional: different from title
    };
  },
  component: () => <UserManagementPage />,
});
```

### Example 3: Dynamic Breadcrumb from Loader Data

**Before (staticData with function):**
```tsx
export const Route = createFileRoute("/_authed/patients/$id")({
  staticData: {
    breadcrumb: (loaderData) => loaderData.patient.name,
  },
  loader: async ({ params }) => {
    const patient = await fetchPatient(params.id);
    return { patient };
  },
  component: () => <PatientDetailPage />,
});
```

**After (context pattern):**
```tsx
export const Route = createFileRoute("/_authed/patients/$id")({
  loader: async ({ params }) => {
    const patient = await fetchPatient(params.id);
    return { patient };
  },
  beforeLoad: ({ context, matches, params }) => {
    return {
      ...context,
      getTitle: () => {
        // Access loader data from matches if needed
        const currentMatch = matches.find(m => m.routeId === "/_authed/patients/$id");
        return currentMatch?.loaderData?.patient?.name || "Paciente";
      },
      getBreadcrumb: () => {
        const currentMatch = matches.find(m => m.routeId === "/_authed/patients/$id");
        return currentMatch?.loaderData?.patient?.name || params.id;
      },
    };
  },
  component: () => <PatientDetailPage />,
});
```

**Note:** For dynamic data, consider using `useLoaderData()` in component and setting title/breadcrumb reactively, or wait for loader to complete before rendering Header.

## Migration Checklist

For each route file with breadcrumbs:

- [ ] Remove `breadcrumb` from `staticData`
- [ ] Remove `title` from `staticData` (if used for breadcrumbs)
- [ ] Keep other `staticData` properties unchanged (nav, permission, etc.)
- [ ] Add/update `beforeLoad` to return context object
- [ ] Include `getTitle: () => "Your Title"` in returned context
- [ ] Optionally include `getBreadcrumb: () => "Label"` if different from title
- [ ] Spread existing context: `return { ...context, getTitle, getBreadcrumb }`
- [ ] Test breadcrumb navigation works correctly

## Benefits of Context Pattern

1. **Type-Safety**: Better TypeScript inference with `TRouteContext`
2. **Dependency Injection**: Access parent context, modify/extend it
3. **Modern Standards**: Aligns with TanStack Router v1.114+ recommendations
4. **Flexibility**: Can derive values from matches, params, loader data dynamically
5. **Cleaner Separation**: Logic in `beforeLoad`, data in `loader`, UI in `component`

## References

- [TanStack Router Context Docs](https://tanstack.com/router/latest/docs/framework/react/guide/route-context)
- [HeroUI v3 beta 5 Breadcrumbs](https://heroui.com/docs/components/breadcrumbs)
- Header implementation: [apps/intranet/src/components/layouts/Header.tsx](../apps/intranet/src/components/layouts/Header.tsx)

/**
 * Route Generator - Generates React Router routes from config
 *
 * This utility takes the route data and generates
 * the RouteObject[] array needed by createBrowserRouter.
 */

import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Outlet } from "react-router-dom";
import type { RouteObject } from "react-router-dom";
import { ROUTE_DATA, type RouteData, type RoutePermission } from "../../shared/route-data";
import RequirePermission from "@/components/common/RequirePermission";
import PageLoader from "@/components/ui/PageLoader";

/**
 * Pre-register all page and layout modules using Vite's import.meta.glob
 * This allows dynamic imports to work correctly at build time
 */
const pageModules = import.meta.glob([
  "../pages/**/*.tsx",
  "../components/Layout/**/*.tsx",
  "../features/**/pages/**/*.tsx",
]) as Record<string, () => Promise<{ default: React.ComponentType }>>;

/**
 * Converts componentPath from route-data to actual module path
 */
function resolveModulePath(componentPath: string): string {
  // componentPath format: "pages/SomePage" or "components/Layout/SomeLayout"
  return `../${componentPath}.tsx`;
}

/**
 * Wraps an element with permission check if permission is specified
 */
function withPermission(element: ReactNode, permission?: RoutePermission): ReactNode {
  if (!permission) return element;
  return (
    <RequirePermission action={permission.action} subject={permission.subject}>
      {element}
    </RequirePermission>
  );
}

/**
 * Creates a lazy-loaded component with Suspense wrapper from a path string
 */
function createLazyElement(componentPath?: string): ReactNode {
  if (!componentPath) return <Outlet />;

  const modulePath = resolveModulePath(componentPath);
  const moduleLoader = pageModules[modulePath];

  if (!moduleLoader) {
    console.error(`Module not found for path: ${componentPath} (resolved: ${modulePath})`);
    return <div>Page not found: {componentPath}</div>;
  }

  const LazyComponent = lazy(moduleLoader);
  return (
    <Suspense fallback={<PageLoader />}>
      <LazyComponent />
    </Suspense>
  );
}

/**
 * Recursively converts a RouteData to a RouteObject
 */
function dataToRouteObject(data: RouteData): RouteObject {
  // Handle redirects
  if (data.redirectTo) {
    if (data.index) {
      return {
        index: true,
        element: <Navigate to={data.redirectTo} replace />,
      };
    }
    return {
      path: data.path,
      element: <Navigate to={data.redirectTo} replace />,
    };
  }

  // Create the element with lazy loading and permission wrapping
  const element = withPermission(createLazyElement(data.componentPath), data.permission);
  const handle = data.title ? { title: data.title } : undefined;

  // Build index route
  if (data.index) {
    return {
      index: true,
      element,
      handle,
    };
  }

  // Build regular route
  const route: RouteObject = {
    path: data.path,
    element,
    handle,
  };

  // Recursively process children
  if (data.children?.length) {
    route.children = data.children.map(dataToRouteObject);
  }

  return route;
}

/**
 * Generates all route objects from the route data
 *
 * @returns RouteObject[] ready for createBrowserRouter
 */
export function generateRoutes(): RouteObject[] {
  return ROUTE_DATA.map(dataToRouteObject);
}

/**
 * Re-export types for convenience
 */
export type { RouteData, RoutePermission, NavConfig, NavSection } from "../../shared/route-data";

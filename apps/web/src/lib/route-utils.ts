import type { RoutePermission } from "@/types/navigation";

/**
 * Determines if a route is a "technical" route that should NOT appear in navigation.
 *
 * Technical routes include:
 * - Layout routes (prefixed with `_`)
 * - Dynamic detail pages (`$id`, `$postId`, etc.)
 * - Edit pages (`$id.edit`, `edit`)
 * - Create pages (`create`)
 * - Catch-all routes (`$`)
 * - Index routes (usually redirects or parent containers)
 *
 * Based on TanStack Router file-based routing conventions.
 */
export function isTechnicalRoute(fullPath: string): boolean {
  const segments = fullPath.split("/").filter(Boolean);

  for (const segment of segments) {
    // Layout routes (e.g., _authed, _pathlessLayout)
    if (segment.startsWith("_")) {
      return true;
    }

    // Dynamic params (e.g., $id, $postId)
    if (segment.startsWith("$")) {
      return true;
    }

    // Edit pages (e.g., edit, $id.edit)
    if (segment.includes(".edit") || segment === "edit") {
      return true;
    }

    // Create pages
    if (segment === "create") {
      return true;
    }

    // Add pages (similar to create)
    if (segment.includes(".add") || segment === "add") {
      return true;
    }

    // Index routes (usually just containers/redirects)
    if (segment === "index") {
      return true;
    }
  }

  // Catch-all routes
  if (fullPath.endsWith("/$")) {
    return true;
  }

  return false;
}

/**
 * Validates that a route has proper navigation metadata if it's a page route.
 *
 * Page routes (non-technical) MUST have:
 * - `staticData.nav` OR
 * - `staticData.hideFromNav: true` (explicit opt-out)
 *
 * Technical routes are exempt from this requirement.
 */
export function validateRouteNavigation(route: {
  fullPath: string;
  hasNav: boolean;
  hasPermission: boolean;
  hideFromNav?: boolean;
}): { isValid: boolean; message?: string } {
  const { fullPath, hasNav, hasPermission, hideFromNav } = route;

  // Technical routes don't need nav
  if (isTechnicalRoute(fullPath)) {
    return { isValid: true };
  }

  // Page routes with permission MUST have nav or explicit hide
  if (hasPermission && !hasNav && !hideFromNav) {
    return {
      isValid: false,
      message: `Route "${fullPath}" has permission but no nav metadata. Add staticData.nav or staticData.hideFromNav: true`,
    };
  }

  // Page routes with nav MUST have permission
  if (hasNav && !hasPermission) {
    return {
      isValid: false,
      message: `Route "${fullPath}" has nav but no permission. Add staticData.permission`,
    };
  }

  return { isValid: true };
}

/**
 * Extracts all routes from the route tree and validates navigation metadata.
 * Returns a report of missing/invalid routes.
 */
export function auditRouteNavigation(routeTree: any): {
  missingNav: string[];
  missingPermission: string[];
  technicalRoutes: string[];
  validRoutes: string[];
} {
  const missingNav: string[] = [];
  const missingPermission: string[] = [];
  const technicalRoutes: string[] = [];
  const validRoutes: string[] = [];

  function traverse(route: any) {
    const fullPath = route.fullPath || route.path || "/";
    const hasNav = !!route.options?.staticData?.nav;
    const hasPermission = !!route.options?.staticData?.permission;
    const hideFromNav = route.options?.staticData?.hideFromNav === true;

    const validation = validateRouteNavigation({
      fullPath,
      hasNav,
      hasPermission,
      hideFromNav,
    });

    if (isTechnicalRoute(fullPath)) {
      technicalRoutes.push(fullPath);
    } else if (!validation.isValid) {
      if (validation.message?.includes("no nav")) {
        missingNav.push(fullPath);
      } else if (validation.message?.includes("no permission")) {
        missingPermission.push(fullPath);
      }
    } else {
      validRoutes.push(fullPath);
    }

    route.children?.forEach(traverse);
  }

  traverse(routeTree);

  return {
    missingNav,
    missingPermission,
    technicalRoutes,
    validRoutes,
  };
}

/**
 * Generates a list of all permissions from the route tree.
 * Useful for automatically populating /settings/roles.
 */
export function extractPermissionsFromRoutes(routeTree: any): RoutePermission[] {
  const permissions = new Map<string, RoutePermission>();

  function traverse(route: any) {
    if (route.options?.staticData?.permission) {
      const perm = route.options.staticData.permission as RoutePermission;
      const key = `${perm.subject}:${perm.action}`;
      permissions.set(key, perm);
    }
    route.children?.forEach(traverse);
  }

  traverse(routeTree);

  return Array.from(permissions.values());
}

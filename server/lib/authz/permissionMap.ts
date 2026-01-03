/**
 * Permission Map - DEPRECATED
 *
 * This file is kept for backwards compatibility with legacy code that might reference it.
 * The actual source of truth for permissions is now:
 *
 * - shared/route-data.ts (ROUTE_DATA for UI routes, API_PERMISSIONS for API-only)
 *
 * The syncPermissions() function reads from route-data.ts directly.
 */

import { readonly } from "../readonly.js";

/**
 * @deprecated Use API_PERMISSIONS in shared/route-data.ts instead
 */
export const permissionMap = readonly({
  // This is now empty - all permissions come from route-data.ts
  // Keeping the structure for type compatibility
} as const);

export type PermissionKey = keyof typeof permissionMap;

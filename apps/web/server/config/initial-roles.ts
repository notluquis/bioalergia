/**
 * Initial role definitions.
 *
 * Permissions are AUTO-ASSIGNED to SystemAdministrator on every sync.
 * This file only defines the role metadata (name, description).
 *
 * The source of truth for permissions is:
 * - shared/route-data.ts (ROUTE_DATA for UI routes, API_PERMISSIONS for API-only)
 */

type RoleDefinition = {
  name: string;
  description: string;
};

export const INITIAL_ROLES: RoleDefinition[] = [
  {
    name: "SystemAdministrator",
    description: "Administrador del sistema con acceso total (auto-assigned all permissions)",
  },
];

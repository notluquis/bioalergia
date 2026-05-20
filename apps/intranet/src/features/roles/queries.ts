import { queryOptions } from "@tanstack/react-query";

import { fetchEmployees } from "@/features/hr/employees/api";
import { fetchPermissions, fetchRoleUsers, fetchRoles, getRoleMappings } from "./api";

// Single source of truth for the roles feature's query keys (previously
// duplicated across api.ts + queries.ts). Keys are hierarchical, rooted at
// `all`, so ONE invalidateQueries(roleKeys.all) cascades to the roles list,
// the permission catalog, and every per-role users query (TanStack matches by
// prefix). Never hand-write a string-literal roles key at a call site — go
// through these factories so the keys can't drift.
export const roleKeys = {
  all: ["roles"] as const,
  lists: () =>
    queryOptions({
      queryFn: fetchRoles,
      queryKey: [...roleKeys.all, "list"] as const,
    }),
  permissions: () =>
    queryOptions({
      queryFn: fetchPermissions,
      queryKey: [...roleKeys.all, "permissions"] as const,
    }),
};

export const roleQueries = {
  users: (roleId: number) =>
    queryOptions({
      queryFn: () => fetchRoleUsers(roleId),
      queryKey: [...roleKeys.all, roleId, "users"] as const,
    }),
  // Composite view (employees × mappings × roles). Its own cache bucket on
  // purpose — it aggregates three sources, so it is not part of the roles
  // list and is refreshed independently (short staleTime).
  mappings: () =>
    queryOptions({
      queryFn: async () => {
        const [employees, dbMappings, roles] = await Promise.all([
          fetchEmployees(true),
          getRoleMappings(),
          fetchRoles(),
        ]);
        return { dbMappings, employees, roles };
      },
      queryKey: ["role-mappings-data"] as const,
      // Keep data fresh but allow staleness for better UX
      staleTime: 30 * 1000,
    }),
};

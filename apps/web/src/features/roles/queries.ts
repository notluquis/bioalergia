import { queryOptions } from "@tanstack/react-query";

import { fetchPermissions, fetchRoles } from "./api";

export const roleKeys = {
  all: ["roles"] as const,
  lists: () =>
    queryOptions({
      queryKey: ["roles"],
      queryFn: fetchRoles,
    }),
  permissions: () =>
    queryOptions({
      queryKey: ["permissions"],
      queryFn: fetchPermissions,
    }),
};

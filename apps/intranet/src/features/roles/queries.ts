import { queryOptions } from "@tanstack/react-query";

import { fetchPermissions, fetchRoles } from "./api";

export const roleKeys = {
  all: ["roles"] as const,
  lists: () =>
    queryOptions({
      queryFn: fetchRoles,
      queryKey: ["roles"],
    }),
  permissions: () =>
    queryOptions({
      queryFn: fetchPermissions,
      queryKey: ["permissions"],
    }),
};

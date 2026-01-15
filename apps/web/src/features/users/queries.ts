import { queryOptions } from "@tanstack/react-query";

import { fetchUsers } from "./api";

export const userKeys = {
  all: ["users"] as const,
  adminList: () =>
    queryOptions({
      queryKey: ["users", "admin-list"],
      queryFn: fetchUsers,
    }),
};

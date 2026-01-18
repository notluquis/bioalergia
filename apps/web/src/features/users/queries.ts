import { queryOptions } from "@tanstack/react-query";

import { fetchUsers } from "./api";

export const userKeys = {
  adminList: () =>
    queryOptions({
      queryFn: fetchUsers,
      queryKey: ["users", "admin-list"],
    }),
  all: ["users"] as const,
};

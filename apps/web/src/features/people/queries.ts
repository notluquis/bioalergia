import { queryOptions } from "@tanstack/react-query";

import { fetchPerson } from "./api";

export const personKeys = {
  all: ["people"] as const,
  detail: (id: string | undefined) =>
    queryOptions({
      // biome-ignore lint/style/noNonNullAssertion: enabled check
      queryFn: () => fetchPerson(id!),
      queryKey: ["person", id],
    }),
};

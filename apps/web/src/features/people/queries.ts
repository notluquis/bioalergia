import { queryOptions } from "@tanstack/react-query";

import { fetchPerson } from "./api";

export const personKeys = {
  all: ["people"] as const,
  detail: (id: string | undefined) =>
    queryOptions({
      queryFn: () => fetchPerson(id!),
      queryKey: ["person", id],
    }),
};

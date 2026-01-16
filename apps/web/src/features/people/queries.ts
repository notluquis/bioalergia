import { queryOptions } from "@tanstack/react-query";

import { fetchPerson } from "./api";

export const personKeys = {
  all: ["people"] as const,
  detail: (id: string | undefined) =>
    queryOptions({
      queryKey: ["person", id],
      queryFn: () => fetchPerson(id!),
    }),
};

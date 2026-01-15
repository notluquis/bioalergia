import { queryOptions } from "@tanstack/react-query";

import { fetchLoanDetail, fetchLoans } from "./api";

export const loanKeys = {
  all: ["loans"] as const,
  lists: () =>
    queryOptions({
      queryKey: ["loans", "list"],
      queryFn: fetchLoans,
    }),
  detail: (id: string) =>
    queryOptions({
      queryKey: ["loans", "detail", id],
      queryFn: () => fetchLoanDetail(id),
      enabled: !!id,
    }),
};

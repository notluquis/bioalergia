import { queryOptions } from "@tanstack/react-query";

import { fetchLoanDetail, fetchLoans } from "./api";

export const loanKeys = {
  all: ["loans"] as const,
  detail: (id: string) =>
    queryOptions({
      enabled: Boolean(id),
      queryFn: () => fetchLoanDetail(id),
      queryKey: ["loans", "detail", id],
    }),
  lists: () =>
    queryOptions({
      queryFn: fetchLoans,
      queryKey: ["loans", "list"],
    }),
};

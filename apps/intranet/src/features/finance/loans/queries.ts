import { queryOptions } from "@tanstack/react-query";

import { fetchLoanDetail, fetchLoanPaymentCandidates, fetchLoans } from "./api";

export const loanKeys = {
  all: ["loans"] as const,
  candidates: (scheduleId: number) =>
    queryOptions({
      enabled: scheduleId > 0,
      queryFn: () => fetchLoanPaymentCandidates(scheduleId),
      queryKey: ["loans", "payment-candidates", scheduleId],
    }),
  detail: (id: string) =>
    queryOptions({
      queryFn: () => fetchLoanDetail(id),
      queryKey: ["loans", "detail", id],
    }),
  lists: () =>
    queryOptions({
      queryFn: fetchLoans,
      queryKey: ["loans", "list"],
    }),
};

import { queryOptions } from "@tanstack/react-query";

import { personalFinanceApi } from "./api";

export const personalFinanceKeys = {
  all: ["personal-finance"] as const,
  credit: (id: number) => [...personalFinanceKeys.credits(), "detail", id] as const,
  credits: () => [...personalFinanceKeys.all, "credits"] as const,
};

export const personalFinanceQueries = {
  detail: (id: number) =>
    queryOptions({
      queryFn: () => personalFinanceApi.getCredit(id),
      queryKey: personalFinanceKeys.credit(id),
    }),
  list: () =>
    queryOptions({
      queryFn: personalFinanceApi.listCredits,
      queryKey: personalFinanceKeys.credits(),
    }),
};

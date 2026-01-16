import { queryOptions } from "@tanstack/react-query";

import { personalFinanceApi } from "./api";

export const personalFinanceKeys = {
  all: ["personal-finance"] as const,
  credits: () => [...personalFinanceKeys.all, "credits"] as const,
  credit: (id: number) => [...personalFinanceKeys.credits(), "detail", id] as const,
};

export const personalFinanceQueries = {
  list: () =>
    queryOptions({
      queryKey: personalFinanceKeys.credits(),
      queryFn: personalFinanceApi.listCredits,
    }),
  detail: (id: number) =>
    queryOptions({
      queryKey: personalFinanceKeys.credit(id),
      queryFn: () => personalFinanceApi.getCredit(id),
    }),
};

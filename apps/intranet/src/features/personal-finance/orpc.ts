import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type {
  PersonalFinanceContract,
  personalFinanceCreditSchema,
  personalFinanceInstallmentSchema,
} from "@finanzas/orpc-contracts/personal-finance";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import type { z } from "zod";
import { csrfFetch } from "@/lib/csrf-fetch";

export type PersonalFinanceORPCClient = ContractRouterClient<PersonalFinanceContract>;

const personalFinanceORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const personalFinanceORPCClient = createORPCClient(personalFinanceORPCLink, {
  path: ["api", "orpc", "personal-finance", "rpc"],
}) as PersonalFinanceORPCClient;

export type PersonalCreditTransport = z.infer<typeof personalFinanceCreditSchema>;
export type PersonalCreditInstallmentTransport = z.infer<typeof personalFinanceInstallmentSchema>;

export const toPersonalFinanceApiError = toApiError;

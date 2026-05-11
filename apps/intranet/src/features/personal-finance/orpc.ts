import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type {
  PersonalFinanceContract,
  personalFinanceCreditSchema,
  personalFinanceInstallmentSchema,
} from "@finanzas/orpc-contracts/personal-finance";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
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

export function toPersonalFinanceApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof ORPCError) {
    return new ApiError(error.message, error.status, error.data);
  }

  if (error instanceof Error) {
    return new ApiError(error.message, 500);
  }

  return new ApiError("Error inesperado", 500, error);
}

import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import { csrfFetch } from "@/lib/csrf-fetch";

import type { UtilityBillsContract } from "@finanzas/orpc-contracts/utility-bills";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";

const link = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const utilityBillsClient = createORPCClient(link, {
  path: ["api", "orpc", "utility-bills", "rpc"],
}) as ContractRouterClient<UtilityBillsContract>;

export function toUtilityBillsError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof ORPCError) return new ApiError(error.message, error.status, error.data);
  if (error instanceof Error) return new ApiError(error.message, 500);
  return new ApiError("Error inesperado", 500, error);
}

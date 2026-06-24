import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { SecurityAlertsContract } from "@finanzas/orpc-contracts/security-alerts";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

export type SecurityAlertsORPCClient = ContractRouterClient<SecurityAlertsContract>;

const securityAlertsORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const securityAlertsORPCClient = createORPCClient(securityAlertsORPCLink, {
  path: ["api", "orpc", "security-alerts", "rpc"],
}) as SecurityAlertsORPCClient;

export function toSecurityAlertsApiError(error: unknown): ApiError {
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

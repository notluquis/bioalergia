import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { OutreachContract } from "@finanzas/orpc-contracts/outreach";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

export type OutreachORPCClient = ContractRouterClient<OutreachContract>;

const outreachLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const outreachORPCClient = createORPCClient(outreachLink, {
  path: ["api", "orpc", "outreach", "rpc"],
}) as OutreachORPCClient;

export function toOutreachApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof ORPCError) return new ApiError(error.message, error.status, error.data);
  if (error instanceof Error) return new ApiError(error.message, 500);
  return new ApiError("Error inesperado", 500, error);
}

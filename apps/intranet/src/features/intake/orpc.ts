import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { IntakeContract } from "@finanzas/orpc-contracts/intake";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

export type IntakeORPCClient = ContractRouterClient<IntakeContract>;

const intakeORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const intakeORPCClient = createORPCClient(intakeORPCLink, {
  path: ["api", "orpc", "intake", "rpc"],
}) as IntakeORPCClient;

export function toIntakeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof ORPCError) return new ApiError(error.message, error.status, error.data);
  if (error instanceof Error) return new ApiError(error.message, 500);
  return new ApiError("Error inesperado", 500, error);
}

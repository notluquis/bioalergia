import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { EmailContract } from "@finanzas/orpc-contracts/email";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

const emailORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export type EmailORPCClient = ContractRouterClient<EmailContract>;

export const emailORPCClient = createORPCClient(emailORPCLink, {
  path: ["api", "orpc", "email", "rpc"],
}) as EmailORPCClient;

export function toEmailApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof ORPCError) return new ApiError(error.message, error.status, error.data);
  if (error instanceof Error) return new ApiError(error.message, 500);
  return new ApiError("Error inesperado", 500, error);
}

import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { JobRadarContract } from "@finanzas/orpc-contracts/job-radar";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

export type JobRadarORPCClient = ContractRouterClient<JobRadarContract>;

const jobRadarORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const jobRadarORPCClient = createORPCClient(jobRadarORPCLink, {
  path: ["api", "orpc", "job-radar", "rpc"],
}) as JobRadarORPCClient;

export function toJobRadarApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof ORPCError) return new ApiError(error.message, error.status, error.data);
  if (error instanceof Error) return new ApiError(error.message, 500);
  return new ApiError("Error inesperado", 500, error);
}

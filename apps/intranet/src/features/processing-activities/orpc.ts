import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { ProcessingActivitiesContract } from "@finanzas/orpc-contracts/processing-activities";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

export type ProcessingActivitiesORPCClient = ContractRouterClient<ProcessingActivitiesContract>;

const processingActivitiesORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const processingActivitiesORPCClient = createORPCClient(processingActivitiesORPCLink, {
  path: ["api", "orpc", "processing-activities", "rpc"],
}) as ProcessingActivitiesORPCClient;

export function toProcessingActivitiesApiError(error: unknown): ApiError {
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

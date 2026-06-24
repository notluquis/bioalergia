import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { ProcessingActivitiesContract } from "@finanzas/orpc-contracts/processing-activities";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

export type ProcessingActivitiesORPCClient = ContractRouterClient<ProcessingActivitiesContract>;

const processingActivitiesORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const processingActivitiesORPCClient = createORPCClient(processingActivitiesORPCLink, {
  path: ["api", "orpc", "processing-activities", "rpc"],
}) as ProcessingActivitiesORPCClient;

export const toProcessingActivitiesApiError = toApiError;

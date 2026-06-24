import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { JobRadarContract } from "@finanzas/orpc-contracts/job-radar";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

export type JobRadarORPCClient = ContractRouterClient<JobRadarContract>;

const jobRadarORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const jobRadarORPCClient = createORPCClient(jobRadarORPCLink, {
  path: ["api", "orpc", "job-radar", "rpc"],
}) as JobRadarORPCClient;

export const toJobRadarApiError = toApiError;

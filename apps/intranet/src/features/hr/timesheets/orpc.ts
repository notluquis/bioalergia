import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { TimesheetsContract } from "@finanzas/orpc-contracts/timesheets";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

export type TimesheetsORPCClient = ContractRouterClient<TimesheetsContract>;

const timesheetsORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const timesheetsORPCClient = createORPCClient<TimesheetsORPCClient>(timesheetsORPCLink, {
  path: ["api", "orpc", "timesheets", "rpc"],
});

export const toTimesheetsApiError = toApiError;

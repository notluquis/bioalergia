import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { SettingsContract } from "@finanzas/orpc-contracts/settings";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

export type SettingsORPCClient = ContractRouterClient<SettingsContract>;

const settingsORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const settingsORPCClient = createORPCClient(settingsORPCLink, {
  path: ["api", "orpc", "settings", "rpc"],
}) as SettingsORPCClient;

export const toSettingsApiError = toApiError;

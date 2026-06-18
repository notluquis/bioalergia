import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { BackupsContract } from "@finanzas/orpc-contracts/backups";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

export type BackupsORPCClient = ContractRouterClient<BackupsContract>;

const backupsORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const backupsORPCClient = createORPCClient(backupsORPCLink, {
  path: ["api", "orpc", "backups", "rpc"],
}) as BackupsORPCClient;

export const toBackupsApiError = toApiError;

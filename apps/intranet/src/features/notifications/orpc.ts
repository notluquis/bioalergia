import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { NotificationsContract } from "@finanzas/orpc-contracts/notifications";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

const notificationsORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export type NotificationsORPCClient = ContractRouterClient<NotificationsContract>;

export const notificationsORPCClient = createORPCClient(notificationsORPCLink, {
  path: ["api", "orpc", "notifications", "rpc"],
}) as NotificationsORPCClient;

export const toNotificationsApiError = toApiError;

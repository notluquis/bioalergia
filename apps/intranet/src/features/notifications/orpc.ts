import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { NotificationsContract } from "@finanzas/orpc-contracts/notifications";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

const notificationsORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export type NotificationsORPCClient = ContractRouterClient<NotificationsContract>;

export const notificationsORPCClient = createORPCClient(notificationsORPCLink, {
  path: ["api", "orpc", "notifications", "rpc"],
}) as NotificationsORPCClient;

export function toNotificationsApiError(error: unknown): ApiError {
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

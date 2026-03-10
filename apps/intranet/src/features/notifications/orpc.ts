import { createORPCClient, ORPCError } from "@orpc/client";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";

type NotificationsORPCClient = {
  sendTest: (input: { userId?: number }) => Promise<{
    message?: string;
    sent?: number;
    status?: string;
    success?: boolean;
  }>;
  subscribe: (input: {
    subscription: PushSubscriptionJSON;
    userId?: number;
  }) => Promise<{ message?: string; status?: string }>;
  unsubscribe: (input: { endpoint: string }) => Promise<{ message?: string; status?: string }>;
};

const notificationsORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const notificationsORPCClient = createORPCClient<NotificationsORPCClient>(
  notificationsORPCLink,
  {
    path: ["api", "orpc", "notifications", "rpc"],
  },
);

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

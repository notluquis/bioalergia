import { createORPCClient, ORPCError } from "@orpc/client";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";

type TransactionsInsightsORPCClient = {
  participantInsight: (input: { from?: string; id: string; to?: string }) => Promise<{
    counterparts: unknown[];
    monthly: unknown[];
    participant: string;
    status: "ok";
  }>;
  participants: (input?: {
    from?: string;
    limit?: number;
    mode?: "combined" | "incoming" | "outgoing";
    to?: string;
  }) => Promise<{ data: unknown; status: "ok" }>;
  stats: (input: { from: string; to: string }) => Promise<{
    byType: unknown[];
    monthly: unknown[];
    status: "ok";
    totals: Record<string, number>;
  }>;
};

const transactionsInsightsORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const transactionsInsightsORPCClient = createORPCClient<TransactionsInsightsORPCClient>(
  transactionsInsightsORPCLink,
  {
    path: ["api", "orpc", "transactions-insights", "rpc"],
  },
);

export function toTransactionsInsightsApiError(error: unknown): ApiError {
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

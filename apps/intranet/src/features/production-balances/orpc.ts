import { createORPCClient, ORPCError } from "@orpc/client";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type { DailyBalancePayload, ProductionBalanceApiItem } from "./api";

type ProductionBalancesORPCClient = {
  create: (input: DailyBalancePayload) => Promise<{
    item: ProductionBalanceApiItem;
    status: "ok";
  }>;
  list: (input: { from?: string; to?: string }) => Promise<{
    from: string;
    items: ProductionBalanceApiItem[];
    status: "ok";
    to: string;
  }>;
  update: (input: DailyBalancePayload & { id: number }) => Promise<{
    item: ProductionBalanceApiItem;
    status: "ok";
  }>;
};

const productionBalancesORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const productionBalancesORPCClient = createORPCClient<ProductionBalancesORPCClient>(
  productionBalancesORPCLink,
  {
    path: ["api", "orpc", "production-balances", "rpc"],
  },
);

export function toProductionBalancesApiError(error: unknown): ApiError {
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

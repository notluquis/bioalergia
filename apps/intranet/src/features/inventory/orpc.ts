import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { InventoryContract } from "@finanzas/orpc-contracts/inventory";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";

export type InventoryORPCClient = ContractRouterClient<InventoryContract>;

const inventoryORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const inventoryORPCClient = createORPCClient(inventoryORPCLink, {
  path: ["api", "orpc", "inventory", "rpc"],
}) as InventoryORPCClient;

export function toInventoryApiError(error: unknown): ApiError {
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

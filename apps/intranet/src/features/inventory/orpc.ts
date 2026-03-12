import { createORPCClient, ORPCError } from "@orpc/client";
import type { RouterClient } from "@orpc/server";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type { InventoryORPCRouter } from "../../../../api/src/orpc/inventory";

const inventoryORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export type InventoryORPCClient = RouterClient<InventoryORPCRouter>;

export const inventoryORPCClient = createORPCClient<InventoryORPCClient>(inventoryORPCLink, {
  path: ["api", "orpc", "inventory", "rpc"],
});

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

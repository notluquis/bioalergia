import { createORPCClient, ORPCError } from "@orpc/client";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type {
  AllergyInventoryOverview,
  InventoryCategory,
  InventoryItem,
  InventoryMovement,
} from "./types";

type InventoryORPCClient = {
  allergyOverview: () => Promise<{ data: AllergyInventoryOverview[]; status: "ok" }>;
  createCategory: (input: { name: string }) => Promise<{ data: InventoryCategory; status: "ok" }>;
  createItem: (input: Omit<InventoryItem, "id">) => Promise<{ data: InventoryItem; status: "ok" }>;
  createMovement: (input: InventoryMovement) => Promise<{ status: "ok" }>;
  deleteCategory: (input: { id: number }) => Promise<{ status: "ok" }>;
  deleteItem: (input: { id: number }) => Promise<{ status: "ok" }>;
  listCategories: () => Promise<{ data: InventoryCategory[]; status: "ok" }>;
  listItems: () => Promise<{ data: InventoryItem[]; status: "ok" }>;
  updateItem: (input: {
    id: number;
    item: Partial<Omit<InventoryItem, "id">>;
  }) => Promise<{ data: InventoryItem; status: "ok" }>;
};

const inventoryORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

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

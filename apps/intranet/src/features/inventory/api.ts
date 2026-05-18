import type {
  inventoryListMovementsInputSchema,
  inventoryListMovementsResponseSchema,
} from "@finanzas/orpc-contracts/inventory";
import type { z } from "zod";

import { inventoryORPCClient, toInventoryApiError } from "./orpc";
import { InventorySchemas } from "./schemas";
import type {
  AllergyInventoryOverview,
  InventoryCategory,
  InventoryItem,
  InventoryMovement,
} from "./types";

export type ListMovementsInput = z.input<typeof inventoryListMovementsInputSchema>;
export type ListMovementsResponse = z.output<typeof inventoryListMovementsResponseSchema>;
export type InventoryMovementRow = ListMovementsResponse["data"]["movements"][number];

export async function createInventoryCategory(name: string): Promise<InventoryCategory> {
  try {
    const res = await inventoryORPCClient.createCategory({ name });
    return InventorySchemas.CategoryResponse.parse(res).data;
  } catch (error) {
    throw toInventoryApiError(error);
  }
}

export async function createInventoryItem(item: Omit<InventoryItem, "id">): Promise<InventoryItem> {
  try {
    const res = await inventoryORPCClient.createItem(item);
    return InventorySchemas.ItemResponse.parse(res).data;
  } catch (error) {
    throw toInventoryApiError(error);
  }
}

export async function createInventoryMovement(movement: InventoryMovement): Promise<void> {
  try {
    await inventoryORPCClient.createMovement(movement);
  } catch (error) {
    throw toInventoryApiError(error);
  }
}

export async function deleteInventoryCategory(id: number): Promise<void> {
  try {
    await inventoryORPCClient.deleteCategory({ id });
  } catch (error) {
    throw toInventoryApiError(error);
  }
}

export async function deleteInventoryItem(id: number): Promise<void> {
  try {
    await inventoryORPCClient.deleteItem({ id });
  } catch (error) {
    throw toInventoryApiError(error);
  }
}

export async function fetchAllergyOverview(): Promise<AllergyInventoryOverview[]> {
  try {
    const payload = await inventoryORPCClient.allergyOverview();
    return InventorySchemas.AllergyOverviewResponse.parse(payload).data.map((item) => ({
      ...item,
      providers: item.providers.map((provider) => ({
        ...provider,
        last_price_check: provider.last_price_check?.toISOString() ?? null,
        last_stock_check: provider.last_stock_check?.toISOString() ?? null,
      })),
    }));
  } catch (error) {
    throw toInventoryApiError(error);
  }
}

export async function getInventoryCategories(): Promise<InventoryCategory[]> {
  try {
    const res = await inventoryORPCClient.listCategories();
    return InventorySchemas.CategoriesResponse.parse(res).data;
  } catch (error) {
    throw toInventoryApiError(error);
  }
}

export async function getInventoryItems(): Promise<InventoryItem[]> {
  try {
    const res = await inventoryORPCClient.listItems();
    return InventorySchemas.ItemsResponse.parse(res).data;
  } catch (error) {
    throw toInventoryApiError(error);
  }
}

export async function listInventoryMovements(
  input: ListMovementsInput = {}
): Promise<ListMovementsResponse> {
  try {
    const res = await inventoryORPCClient.listMovements(input);
    return res as ListMovementsResponse;
  } catch (error) {
    throw toInventoryApiError(error);
  }
}

export async function updateInventoryItem(
  id: number,
  item: Partial<Omit<InventoryItem, "id">>
): Promise<InventoryItem> {
  try {
    const res = await inventoryORPCClient.updateItem({ id, item });
    return InventorySchemas.ItemResponse.parse(res).data;
  } catch (error) {
    throw toInventoryApiError(error);
  }
}

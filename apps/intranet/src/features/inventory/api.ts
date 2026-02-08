import { apiClient } from "@/lib/api-client";
import { InventorySchemas } from "./schemas";
import type {
  AllergyInventoryOverview,
  InventoryCategory,
  InventoryItem,
  InventoryMovement,
} from "./types";

export async function createInventoryCategory(name: string): Promise<InventoryCategory> {
  const res = await apiClient.post<{ data: InventoryCategory }>(
    "/api/inventory/categories",
    {
      name,
    },
    { responseSchema: InventorySchemas.CategoryResponse },
  );
  return res.data;
}

export async function createInventoryItem(item: Omit<InventoryItem, "id">): Promise<InventoryItem> {
  const res = await apiClient.post<{ data: InventoryItem }>("/api/inventory/items", item, {
    responseSchema: InventorySchemas.ItemResponse,
  });
  return res.data;
}

export async function createInventoryMovement(movement: InventoryMovement): Promise<void> {
  await apiClient.post("/api/inventory/movements", movement, {
    responseSchema: InventorySchemas.StatusResponse,
  });
}

export async function deleteInventoryCategory(id: number): Promise<void> {
  await apiClient.delete(`/api/inventory/categories/${id}`, {
    responseSchema: InventorySchemas.StatusResponse,
  });
}

export async function deleteInventoryItem(id: number): Promise<void> {
  await apiClient.delete(`/api/inventory/items/${id}`, {
    responseSchema: InventorySchemas.StatusResponse,
  });
}

export async function fetchAllergyOverview(): Promise<AllergyInventoryOverview[]> {
  const payload = await apiClient.get<{ data: AllergyInventoryOverview[] }>(
    "/api/inventory/allergy-overview",
    { responseSchema: InventorySchemas.AllergyOverviewResponse },
  );
  return payload.data;
}

export async function getInventoryCategories(): Promise<InventoryCategory[]> {
  const res = await apiClient.get<{ data: InventoryCategory[] }>("/api/inventory/categories", {
    responseSchema: InventorySchemas.CategoriesResponse,
  });
  return res.data;
}

export async function getInventoryItems(): Promise<InventoryItem[]> {
  const res = await apiClient.get<{ data: InventoryItem[] }>("/api/inventory/items", {
    responseSchema: InventorySchemas.ItemsResponse,
  });
  return res.data;
}

export async function updateInventoryItem(
  id: number,
  item: Partial<Omit<InventoryItem, "id">>,
): Promise<InventoryItem> {
  const res = await apiClient.put<{ data: InventoryItem }>(`/api/inventory/items/${id}`, item, {
    responseSchema: InventorySchemas.ItemResponse,
  });
  return res.data;
}

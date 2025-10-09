import { apiClient } from "../../lib/apiClient";
import type { InventoryCategory, InventoryItem, InventoryMovement } from "./types";

type ApiResponse<T> = {
  data: T;
};

export async function getInventoryCategories(): Promise<InventoryCategory[]> {
  const res = await apiClient.get<ApiResponse<InventoryCategory[]>>("/inventory/categories");
  return res.data;
}

export async function createInventoryCategory(name: string): Promise<InventoryCategory> {
  const res = await apiClient.post<ApiResponse<InventoryCategory>>("/inventory/categories", { name });
  return res.data;
}

export async function getInventoryItems(): Promise<InventoryItem[]> {
  const res = await apiClient.get<ApiResponse<InventoryItem[]>>("/inventory/items");
  return res.data;
}

export async function createInventoryItem(item: Omit<InventoryItem, "id">): Promise<InventoryItem> {
  const res = await apiClient.post<ApiResponse<InventoryItem>>("/inventory/items", item);
  return res.data;
}

export async function updateInventoryItem(
  id: number,
  item: Partial<Omit<InventoryItem, "id">>
): Promise<InventoryItem> {
  const res = await apiClient.put<ApiResponse<InventoryItem>>(`/inventory/items/${id}`, item);
  return res.data;
}

export async function deleteInventoryItem(id: number): Promise<void> {
  await apiClient.delete(`/inventory/items/${id}`);
}

export async function createInventoryMovement(movement: InventoryMovement): Promise<void> {
  await apiClient.post("/inventory/movements", movement);
}

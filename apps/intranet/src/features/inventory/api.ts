import { z } from "zod";
import { apiClient } from "@/lib/api-client";

import type {
  AllergyInventoryOverview,
  InventoryCategory,
  InventoryItem,
  InventoryMovement,
} from "./types";

interface ApiResponse<T> {
  data: T;
  message?: string;
  status?: string;
}

const ApiResponseSchema = z.object({
  data: z.unknown(),
  message: z.string().optional(),
  status: z.string().optional(),
});

const StatusResponseSchema = z.looseObject({ status: z.string().optional() });

export async function createInventoryCategory(name: string): Promise<InventoryCategory> {
  const res = await apiClient.post<ApiResponse<InventoryCategory>>(
    "/api/inventory/categories",
    {
      name,
    },
    { responseSchema: ApiResponseSchema },
  );
  return res.data;
}

export async function createInventoryItem(item: Omit<InventoryItem, "id">): Promise<InventoryItem> {
  const res = await apiClient.post<ApiResponse<InventoryItem>>("/api/inventory/items", item, {
    responseSchema: ApiResponseSchema,
  });
  return res.data;
}

export async function createInventoryMovement(movement: InventoryMovement): Promise<void> {
  await apiClient.post("/api/inventory/movements", movement, {
    responseSchema: StatusResponseSchema,
  });
}

export async function deleteInventoryCategory(id: number): Promise<void> {
  await apiClient.delete(`/api/inventory/categories/${id}`, {
    responseSchema: StatusResponseSchema,
  });
}

export async function deleteInventoryItem(id: number): Promise<void> {
  await apiClient.delete(`/api/inventory/items/${id}`, { responseSchema: StatusResponseSchema });
}

export async function fetchAllergyOverview(): Promise<AllergyInventoryOverview[]> {
  const payload = await apiClient.get<ApiResponse<AllergyInventoryOverview[]>>(
    "/api/inventory/allergy-overview",
    { responseSchema: ApiResponseSchema },
  );
  return payload.data ?? [];
}

export async function getInventoryCategories(): Promise<InventoryCategory[]> {
  const res = await apiClient.get<ApiResponse<InventoryCategory[]>>("/api/inventory/categories", {
    responseSchema: ApiResponseSchema,
  });
  return res.data;
}

export async function getInventoryItems(): Promise<InventoryItem[]> {
  const res = await apiClient.get<ApiResponse<InventoryItem[]>>("/api/inventory/items", {
    responseSchema: ApiResponseSchema,
  });
  return res.data;
}

export async function updateInventoryItem(
  id: number,
  item: Partial<Omit<InventoryItem, "id">>,
): Promise<InventoryItem> {
  const res = await apiClient.put<ApiResponse<InventoryItem>>(`/api/inventory/items/${id}`, item, {
    responseSchema: ApiResponseSchema,
  });
  return res.data;
}

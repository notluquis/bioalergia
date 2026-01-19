import { apiClient } from "@/lib/api-client";

import type { CommonSupply, SupplyRequest } from "./types";

export interface SupplyRequestPayload {
  brand?: string;
  model?: string;
  notes?: string;
  quantity: number;
  supplyName: string;
}

export async function createSupplyRequest(payload: SupplyRequestPayload): Promise<void> {
  await apiClient.post("/api/supplies/requests", payload);
}

export async function getCommonSupplies(): Promise<CommonSupply[]> {
  return apiClient.get<CommonSupply[]>("/api/supplies/common");
}

export async function getSupplyRequests(): Promise<SupplyRequest[]> {
  return apiClient.get<SupplyRequest[]>("/api/supplies/requests");
}

export async function updateSupplyRequestStatus(requestId: number, status: SupplyRequest["status"]): Promise<void> {
  await apiClient.put(`/api/supplies/requests/${requestId}/status`, { status });
}

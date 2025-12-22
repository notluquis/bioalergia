import { apiClient } from "@/lib/apiClient";
import type { HealthResponse } from "./types";

export async function fetchSystemHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return apiClient.get<HealthResponse>("/api/health", { signal });
}

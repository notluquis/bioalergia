import { apiClient } from "@/lib/api-client";

import type { HealthResponse } from "./types";

export async function fetchSystemHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return apiClient.get<HealthResponse>("/api/health", { signal });
}

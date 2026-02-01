import { z } from "zod";
import { apiClient } from "@/lib/api-client";

import type { HealthResponse } from "./types";

const HealthResponseSchema = z.object({
  checks: z.object({
    db: z.object({
      latency: z.number().nullable(),
      message: z.string().optional(),
      status: z.enum(["error", "ok"]),
    }),
  }),
  status: z.enum(["degraded", "error", "ok"]),
  timestamp: z.coerce.date(),
});

export async function fetchSystemHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return apiClient.get<HealthResponse>("/api/health", {
    responseSchema: HealthResponseSchema,
    signal,
  });
}

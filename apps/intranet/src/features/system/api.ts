import { z } from "zod";
import type { HealthResponse } from "./types";
import { systemORPCClient, toSystemApiError } from "./orpc";

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
  try {
    void signal;
    return HealthResponseSchema.parse(await systemORPCClient.health());
  } catch (error) {
    throw toSystemApiError(error);
  }
}

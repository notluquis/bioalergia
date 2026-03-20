import { z } from "zod";
import type { HealthResponse, RailwayDeploymentsResponse } from "./types";
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

const RailwayDeploymentStatusSchema = z.enum([
  "BUILDING",
  "CRASHED",
  "DEPLOYING",
  "FAILED",
  "QUEUED",
  "REMOVED",
  "SKIPPED",
  "SLEEPING",
  "SUCCESS",
  "UNKNOWN",
  "WAITING",
]);

const RailwayDeploymentsResponseSchema = z.object({
  checkedAt: z.coerce.date(),
  configured: z.boolean(),
  errorMessage: z.string().nullable(),
  targets: z.array(
    z.object({
      createdAt: z.coerce.date().nullable(),
      deploymentId: z.string().nullable(),
      environmentId: z.string(),
      label: z.string(),
      serviceId: z.string(),
      status: RailwayDeploymentStatusSchema,
    })
  ),
});

export async function fetchSystemHealth(signal?: AbortSignal): Promise<HealthResponse> {
  try {
    void signal;
    return HealthResponseSchema.parse(await systemORPCClient.health());
  } catch (error) {
    throw toSystemApiError(error);
  }
}

export async function fetchRailwayDeployments(
  signal?: AbortSignal
): Promise<RailwayDeploymentsResponse> {
  try {
    void signal;
    return RailwayDeploymentsResponseSchema.parse(await systemORPCClient.deployments());
  } catch (error) {
    throw toSystemApiError(error);
  }
}

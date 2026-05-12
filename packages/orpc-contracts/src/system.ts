import { oc } from "@orpc/contract";
import { z } from "zod";

export const systemHealthResponseSchema = z.object({
  checks: z.object({
    db: z.object({
      latency: z.number().nullable(),
      message: z.string().optional(),
      status: z.enum(["error", "ok"]),
    }),
  }),
  orm: z
    .object({
      slowQueryCount: z.number().int(),
      zodCacheSize: z.number().int(),
    })
    .optional(),
  status: z.enum(["degraded", "error", "ok"]),
  timestamp: z.coerce.date(),
});

export const systemRailwayDeploymentStatusSchema = z.enum([
  "BUILDING",
  "CRASHED",
  "DEPLOYING",
  "FAILED",
  "QUEUED",
  "REMOVED",
  "SKIPPED",
  "SLEEPING",
  "SUCCESS",
  "WAITING",
  "UNKNOWN",
]);

export const systemRailwayDeploymentTargetSchema = z.object({
  createdAt: z.coerce.date().nullable(),
  deploymentId: z.string().nullable(),
  environmentId: z.string(),
  label: z.string(),
  serviceId: z.string(),
  status: systemRailwayDeploymentStatusSchema,
});

export const systemRailwayDeploymentsResponseSchema = z.object({
  checkedAt: z.coerce.date(),
  configured: z.boolean(),
  errorMessage: z.string().nullable(),
  targets: z.array(systemRailwayDeploymentTargetSchema),
});

export const systemContract = {
  deployments: oc
    .route({ method: "GET", path: "/deployments" })
    .output(systemRailwayDeploymentsResponseSchema),
  health: oc.route({ method: "GET", path: "/health" }).output(systemHealthResponseSchema),
};

export type SystemContract = typeof systemContract;

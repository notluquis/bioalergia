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
  status: z.enum(["degraded", "error", "ok"]),
  timestamp: z.coerce.date(),
});

export const systemContract = {
  health: oc.route({ method: "GET", path: "/health" }).output(systemHealthResponseSchema),
};

export type SystemContract = typeof systemContract;

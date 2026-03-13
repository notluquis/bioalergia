import { oc } from "@orpc/contract";
import { z } from "zod";

export const googleDriveStatusSchema = z.object({
  configured: z.boolean(),
  error: z.string().optional(),
  errorCode: z.enum(["invalid_grant", "token_expired", "token_revoked", "unknown"]).optional(),
  source: z.enum(["db", "env", "none"]),
  valid: z.boolean(),
});

export const googleDriveAuthUrlSchema = z.object({
  url: z.url(),
});

export const googleDriveDisconnectSchema = z.object({
  success: z.literal(true),
});

export const integrationsContract = {
  googleDisconnect: oc
    .route({ method: "DELETE", path: "/google/disconnect" })
    .output(googleDriveDisconnectSchema),
  googleStatus: oc.route({ method: "GET", path: "/google/status" }).output(googleDriveStatusSchema),
  googleUrl: oc.route({ method: "GET", path: "/google/url" }).output(googleDriveAuthUrlSchema),
};

export type IntegrationsContract = typeof integrationsContract;

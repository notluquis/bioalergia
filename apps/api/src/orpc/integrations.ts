import { randomBytes } from "node:crypto";
import { db } from "@finanzas/db";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { setCookie } from "hono/cookie";
import { z } from "zod";
import {
  clearDriveClientCache,
  getOAuthClientBase,
  validateOAuthToken,
} from "../lib/google/google-core";
import { logError, logEvent } from "../lib/logger";
import { configureSuperjson } from "../lib/superjson-config";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();

const OAUTH_TOKEN_KEY = "GOOGLE_OAUTH_REFRESH_TOKEN";
const OAUTH_STATE_COOKIE = "oauth_state";

type IntegrationsORPCContext = {
  hono: HonoContext;
};

const base = os.$context<IntegrationsORPCContext>();

const emptySchema = z.object({});

const googleStatusSchema = z.object({
  configured: z.boolean(),
  error: z.string().optional(),
  errorCode: z.enum(["invalid_grant", "token_expired", "token_revoked", "unknown"]).optional(),
  source: z.enum(["db", "env", "none"]),
  valid: z.boolean(),
});

const googleAuthUrlSchema = z.object({
  url: z.string().url(),
});

const disconnectResponseSchema = z.object({
  success: z.literal(true),
});

const integrationsORPCRouterBase = {
  googleDisconnect: base
    .route({
      method: "DELETE",
      path: "/google/disconnect",
      summary: "Disconnect Google Drive integration",
      tags: ["Integrations"],
    })
    .input(emptySchema)
    .output(disconnectResponseSchema)
    .handler(async () => {
      await db.setting
        .delete({
          where: { key: OAUTH_TOKEN_KEY },
        })
        .catch(() => undefined);

      clearDriveClientCache();
      logEvent("google.oauth.disconnected", {});

      return { success: true as const };
    }),

  googleStatus: base
    .route({
      method: "GET",
      path: "/google/status",
      summary: "Get Google Drive OAuth status",
      tags: ["Integrations"],
    })
    .output(googleStatusSchema)
    .handler(async () => validateOAuthToken()),

  googleUrl: base
    .route({
      method: "GET",
      path: "/google/url",
      summary: "Generate Google Drive OAuth URL",
      tags: ["Integrations"],
    })
    .output(googleAuthUrlSchema)
    .handler(async ({ context }) => {
      const oauth2Client = await getOAuthClientBase();
      const state = randomBytes(32).toString("hex");

      setCookie(context.hono, OAUTH_STATE_COOKIE, state, {
        httpOnly: true,
        maxAge: 600,
        path: "/",
        sameSite: "Lax",
        secure: process.env.NODE_ENV === "production",
      });

      const authUrl = oauth2Client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: ["https://www.googleapis.com/auth/drive.file"],
        state,
      });

      logEvent("google.oauth.auth_url_generated", {
        state: `${state.substring(0, 8)}...`,
      });

      return { url: authUrl };
    }),
};

export const integrationsORPCRouter = base
  .prefix("/api/orpc/integrations")
  .router(integrationsORPCRouterBase);

export const integrationsORPCHandler = new SuperJSONRPCHandler(integrationsORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "orpc.integrations",
      });
    }),
  ],
});

export const integrationsOpenAPIHandler = new OpenAPIHandler(integrationsORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Integrations oRPC",
          description: "Contratos oRPC/OpenAPI para integraciones OAuth y estado de conectividad.",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "openapi.integrations",
      });
    }),
  ],
});

import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import {
  mlConnectUrlResponseSchema,
  mlConnectionStatusSchema,
  mlContract,
  mlPredictCategoryInputSchema,
  mlPredictCategoryResponseSchema,
  mlPublishInputSchema,
  mlPublishResponseSchema,
  mlStatusResponseSchema,
} from "@finanzas/orpc-contracts/ml";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { randomBytes } from "node:crypto";
import type { Context as HonoContext } from "hono";
import { getSessionUser } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  buildAuthorizationUrl,
  disconnectMl,
  getConnectionStatus,
} from "../modules/mercadolibre/auth.ts";
import { predictCategory } from "../modules/mercadolibre/client.ts";
import { publishProductToMl } from "../modules/mercadolibre/sync.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

// In-memory state store para OAuth CSRF — TTL 10min. Single-process API.
const stateStore = new Map<string, number>();
const STATE_TTL_MS = 10 * 60 * 1000;

function pruneStates() {
  const now = Date.now();
  for (const [k, ts] of stateStore.entries()) {
    if (now - ts > STATE_TTL_MS) stateStore.delete(k);
  }
}

export function issueOAuthState(): string {
  pruneStates();
  const state = randomBytes(24).toString("base64url");
  stateStore.set(state, Date.now());
  return state;
}

export function verifyOAuthState(state: string): boolean {
  pruneStates();
  const ts = stateStore.get(state);
  if (!ts) return false;
  stateStore.delete(state);
  return Date.now() - ts <= STATE_TTL_MS;
}

type MlORPCContext = { hono: HonoContext };
const base = os.$context<MlORPCContext>();

const requireStaff = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);
  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  }
  return next({ context: { ...context, user } });
});

const statusRoute = requireStaff
  .route({ method: "GET", path: "/status", summary: "ML connection status", tags: ["ML"] })
  .output(mlConnectionStatusSchema)
  .handler(async () => {
    const s = await getConnectionStatus();
    if (s.connected) {
      return {
        data: {
          connected: true as const,
          ml_user_id: s.mlUserId,
          expires_at: s.expiresAt,
          scope: s.scope ?? null,
        },
        status: "ok" as const,
      };
    }
    return { data: { connected: false as const }, status: "ok" as const };
  });

const connectRoute = requireStaff
  .route({
    method: "POST",
    path: "/connect",
    summary: "Get OAuth URL",
    tags: ["ML"],
  })
  .output(mlConnectUrlResponseSchema)
  .handler(async () => {
    const state = issueOAuthState();
    return {
      data: { authorization_url: buildAuthorizationUrl(state), state },
      status: "ok" as const,
    };
  });

const disconnectRoute = requireStaff
  .route({ method: "POST", path: "/disconnect", summary: "Disconnect ML", tags: ["ML"] })
  .output(mlStatusResponseSchema)
  .handler(async () => {
    await disconnectMl();
    return { status: "ok" as const };
  });

const publishRoute = requireStaff
  .route({ method: "POST", path: "/publish", summary: "Publish product to ML", tags: ["ML"] })
  .input(mlPublishInputSchema)
  .output(mlPublishResponseSchema)
  .handler(async ({ input }) => {
    const res = await publishProductToMl(input.product_id, {
      categoryId: input.ml_category_id,
    });
    return {
      data: { ml_item_id: res.mlItemId, permalink: res.permalink },
      status: "ok" as const,
    };
  });

const predictRoute = requireStaff
  .route({
    method: "POST",
    path: "/predict-category",
    summary: "Predict ML category",
    tags: ["ML"],
  })
  .input(mlPredictCategoryInputSchema)
  .output(mlPredictCategoryResponseSchema)
  .handler(async ({ input }) => {
    const pred = await predictCategory(input.query);
    return {
      data: pred ? { category_id: pred.category_id, category_name: pred.category_name } : null,
      status: "ok" as const,
    };
  });

const mlORPCRouterBase = {
  status: statusRoute,
  connect: connectRoute,
  disconnect: disconnectRoute,
  publishProduct: publishRoute,
  predictCategory: predictRoute,
};

void mlContract; // keep contract reference for type-link clarity

export const mlORPCRouter = base.prefix("/api/orpc/ml").tag("ML").router(mlORPCRouterBase);

export const mlORPCHandler = new SuperJSONRPCHandler(mlORPCRouter, {
  interceptors: [onError((error) => logError("ml.orpc.rpc", error, {}))],
});

export const mlOpenAPIHandler = new OpenAPIHandler(mlORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      docsTitle: "Bioalergia ML API Reference",
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: { info: { title: "Bioalergia ML API", version: "1.0.0" } },
    }),
  ],
  interceptors: [onError((error) => logError("ml.orpc.openapi", error, {}))],
});

export type MlORPCRouter = typeof mlORPCRouter;

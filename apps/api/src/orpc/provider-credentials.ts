import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import {
  listProviderCredentialsInputSchema,
  listProviderCredentialsResponseSchema,
  providerCredentialDetailResponseSchema,
  providerCredentialPayloadSchema,
  testCredentialResponseSchema,
} from "@finanzas/orpc-contracts/provider-credentials";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser } from "../auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  createProviderCredential,
  deleteProviderCredential,
  listProviderCredentials,
  testCredential,
  updateProviderCredential,
} from "../services/provider-credentials.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type ProviderCredentialsORPCContext = { hono: HonoContext };

const base = os.$context<ProviderCredentialsORPCContext>();

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);
  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "Unauthorized" });
  }
  return next({ context: { ...context, user } });
});

const idInput = z.object({ id: z.number().int() });

const routerBase = {
  create: authed
    .route({ method: "POST", path: "/" })
    .input(providerCredentialPayloadSchema)
    .output(providerCredentialDetailResponseSchema)
    .handler(async ({ input }) => {
      const credential = await createProviderCredential(input);
      return { credential, status: "ok" as const };
    }),

  delete: authed
    .route({ method: "DELETE", path: "/{id}" })
    .input(idInput)
    .output(z.object({ status: z.literal("ok") }))
    .handler(async ({ input }) => {
      await deleteProviderCredential(input.id);
      return { status: "ok" as const };
    }),

  list: authed
    .route({ method: "GET", path: "/" })
    .input(listProviderCredentialsInputSchema)
    .output(listProviderCredentialsResponseSchema)
    .handler(async ({ input }) => {
      const credentials = await listProviderCredentials({
        provider: input.provider,
        scope: input.scope,
      });
      return { credentials, status: "ok" as const };
    }),

  test: authed
    .route({ method: "POST", path: "/{id}/test" })
    .input(idInput)
    .output(testCredentialResponseSchema)
    .handler(async ({ input }) => {
      return testCredential(input.id);
    }),

  update: authed
    .route({ method: "PUT", path: "/{id}" })
    .input(
      z.object({
        id: z.number().int(),
        payload: providerCredentialPayloadSchema.partial().extend({
          secret: z.string().optional(),
        }),
      })
    )
    .output(providerCredentialDetailResponseSchema)
    .handler(async ({ input }) => {
      const credential = await updateProviderCredential(input.id, input.payload);
      return { credential, status: "ok" as const };
    }),
};

export const providerCredentialsORPCRouter = base
  .prefix("/api/orpc/provider-credentials")
  .router(routerBase);

export const providerCredentialsORPCHandler = new SuperJSONRPCHandler(
  providerCredentialsORPCRouter,
  {
    interceptors: [
      onError((error) => {
        logError("provider-credentials.orpc", error, {});
      }),
    ],
  }
);

export const providerCredentialsOpenAPIHandler = new OpenAPIHandler(
  providerCredentialsORPCRouter,
  {
    plugins: [
      new OpenAPIReferencePlugin({
        schemaConverters: [new ZodToJsonSchemaConverter()],
      }),
    ],
  }
);

export type ProviderCredentialsORPCRouter = typeof providerCredentialsORPCRouter;

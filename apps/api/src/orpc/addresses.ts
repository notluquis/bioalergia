import {
  addressDeleteResponseSchema,
  addressIdInputSchema,
  addressListResponseSchema,
  addressResponseSchema,
  createAddressInputSchema,
  listAddressesInputSchema,
  setPrimaryAddressInputSchema,
  updateAddressInputSchema,
} from "@finanzas/orpc-contracts/addresses";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import type { z } from "zod";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  createAddress,
  deleteAddress,
  geocodeAddressById,
  listAddresses,
  setPrimaryAddress,
  updateAddress,
} from "../services/addresses.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type AddressesORPCContext = {
  hono: HonoContext;
};

const base = os.$context<AddressesORPCContext>();

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);

  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  }

  return next({
    context: { ...context, user },
  });
});

const readPersons = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user, "read", "Person");
  if (!canRead) throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  return next();
});

const updatePersons = authed.use(async ({ context, next }) => {
  const canUpdate = await hasPermission(context.user, "update", "Person");
  if (!canUpdate) throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  return next();
});

const addressesORPCRouterBase = {
  create: updatePersons
    .route({ method: "POST", path: "/", tags: ["Addresses"] })
    .input(createAddressInputSchema)
    .output(addressResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof createAddressInputSchema> }) => {
      return createAddress(input);
    }),

  delete: updatePersons
    .route({ method: "DELETE", path: "/{id}", tags: ["Addresses"] })
    .input(addressIdInputSchema)
    .output(addressDeleteResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof addressIdInputSchema> }) => {
      return deleteAddress(input.id);
    }),

  list: readPersons
    .route({ method: "GET", path: "/", tags: ["Addresses"] })
    .input(listAddressesInputSchema)
    .output(addressListResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof listAddressesInputSchema> }) => {
      return listAddresses(input.personId);
    }),

  setPrimary: updatePersons
    .route({ method: "POST", path: "/{id}/primary", tags: ["Addresses"] })
    .input(setPrimaryAddressInputSchema)
    .output(addressResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof setPrimaryAddressInputSchema> }) => {
      return setPrimaryAddress(input);
    }),

  update: updatePersons
    .route({ method: "PUT", path: "/{id}", tags: ["Addresses"] })
    .input(updateAddressInputSchema)
    .output(addressResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof updateAddressInputSchema> }) => {
      return updateAddress(input);
    }),

  geocode: updatePersons
    .route({ method: "POST", path: "/{id}/geocode", tags: ["Addresses"] })
    .input(addressIdInputSchema)
    .output(addressResponseSchema)
    .handler(async ({ input }) => {
      return geocodeAddressById(input.id);
    }),
};

export const addressesORPCRouter = base
  .prefix("/api/orpc/addresses")
  .tag("Addresses")
  .router(addressesORPCRouterBase);

export const addressesORPCHandler = new SuperJSONRPCHandler(addressesORPCRouter, {
  interceptors: [
    onError((error) => {
      logError("addresses.orpc", error, {});
    }),
  ],
});

export const addressesOpenAPIHandler = new OpenAPIHandler(addressesORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      docsTitle: "Bioalergia Addresses API Reference",
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Addresses oRPC",
          description: "Direcciones estructuradas por persona.",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError("addresses.openapi", error, {});
    }),
  ],
});

export type AddressesORPCRouter = typeof addressesORPCRouter;

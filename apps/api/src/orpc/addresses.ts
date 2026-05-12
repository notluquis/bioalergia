import { db } from "@finanzas/db";
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
import { Decimal } from "decimal.js";
import { getSessionUser, hasPermission } from "../auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import { geocodeAddress } from "../services/shipments.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

/**
 * Best-effort geocoding via Chilexpress' /addresses/georeference endpoint.
 * Failures are swallowed (logged) so address persistence never blocks on
 * a slow/unavailable carrier API. Returns the lat/lng/addressId triple
 * when Chilexpress can place the address; otherwise null.
 */
async function tryGeocodeAddress(input: {
  street: string;
  number: string;
  comuna: string;
}): Promise<{ latitude: Decimal; longitude: Decimal; chilexpressAddressId: number | null } | null> {
  try {
    const result = await geocodeAddress({
      streetName: input.street,
      countyName: input.comuna,
      number: input.number,
    });
    if (!result || !result.latitude || !result.longitude) return null;
    return {
      latitude: new Decimal(result.latitude),
      longitude: new Decimal(result.longitude),
      chilexpressAddressId: result.addressId ?? null,
    };
  } catch (error) {
    logError("addresses.geocode.failed", error, { input });
    return null;
  }
}

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

async function ensurePersonExists(personId: number) {
  const exists = await db.person.findUnique({ where: { id: personId }, select: { id: true } });
  if (!exists) {
    throw new ORPCError("NOT_FOUND", { message: "Persona no encontrada" });
  }
}

async function ensureSinglePrimary(personId: number, keepId: number) {
  await db.address.updateMany({
    where: { personId, isPrimary: true, id: { not: keepId } },
    data: { isPrimary: false },
  });
}

const addressesORPCRouterBase = {
  create: updatePersons
    .route({ method: "POST", path: "/", tags: ["Addresses"] })
    .input(createAddressInputSchema)
    .output(addressResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof createAddressInputSchema> }) => {
      await ensurePersonExists(input.personId);

      const existingCount = await db.address.count({ where: { personId: input.personId } });
      const shouldBePrimary = existingCount === 0 || input.isPrimary === true;

      const geo = await tryGeocodeAddress({
        street: input.street,
        number: input.number,
        comuna: input.comuna,
      });

      const address = await db.address.create({
        data: {
          personId: input.personId,
          label: input.label ?? "Principal",
          street: input.street,
          number: input.number,
          supplement: input.supplement ?? null,
          reference: input.reference ?? null,
          postalCode: input.postalCode ?? null,
          comuna: input.comuna,
          region: input.region,
          coverageCode: input.coverageCode ?? null,
          regionCode: input.regionCode ?? null,
          ineRegionCode: input.ineRegionCode ?? null,
          ineCountyCode: input.ineCountyCode ?? null,
          supportsCashOnDelivery: input.supportsCashOnDelivery ?? null,
          supportsReturn: input.supportsReturn ?? null,
          latitude: geo?.latitude ?? null,
          longitude: geo?.longitude ?? null,
          chilexpressAddressId: geo?.chilexpressAddressId ?? null,
          countryCode: input.countryCode ?? "CL",
          isPrimary: shouldBePrimary,
          isActive: true,
        },
      });

      if (shouldBePrimary) {
        await ensureSinglePrimary(input.personId, address.id);
      }

      return { address };
    }),

  delete: updatePersons
    .route({ method: "DELETE", path: "/{id}", tags: ["Addresses"] })
    .input(addressIdInputSchema)
    .output(addressDeleteResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof addressIdInputSchema> }) => {
      const existing = await db.address.findUnique({ where: { id: input.id } });
      if (!existing) {
        throw new ORPCError("NOT_FOUND", { message: "Dirección no encontrada" });
      }
      await db.address.delete({ where: { id: input.id } });

      // Promote first remaining as primary if we deleted the primary
      if (existing.isPrimary) {
        const next = await db.address.findFirst({
          where: { personId: existing.personId, isActive: true },
          orderBy: { createdAt: "asc" },
        });
        if (next) {
          await db.address.update({ where: { id: next.id }, data: { isPrimary: true } });
        }
      }

      return { status: "ok" as const };
    }),

  list: readPersons
    .route({ method: "GET", path: "/", tags: ["Addresses"] })
    .input(listAddressesInputSchema)
    .output(addressListResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof listAddressesInputSchema> }) => {
      const addresses = await db.address.findMany({
        where: { personId: input.personId },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      });
      return { addresses };
    }),

  setPrimary: updatePersons
    .route({ method: "POST", path: "/{id}/primary", tags: ["Addresses"] })
    .input(setPrimaryAddressInputSchema)
    .output(addressResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof setPrimaryAddressInputSchema> }) => {
      const existing = await db.address.findUnique({ where: { id: input.id } });
      if (!existing || existing.personId !== input.personId) {
        throw new ORPCError("NOT_FOUND", { message: "Dirección no encontrada" });
      }
      await ensureSinglePrimary(input.personId, input.id);
      const address = await db.address.update({
        where: { id: input.id },
        data: { isPrimary: true },
      });
      return { address };
    }),

  update: updatePersons
    .route({ method: "PUT", path: "/{id}", tags: ["Addresses"] })
    .input(updateAddressInputSchema)
    .output(addressResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof updateAddressInputSchema> }) => {
      const existing = await db.address.findUnique({ where: { id: input.id } });
      if (!existing) {
        throw new ORPCError("NOT_FOUND", { message: "Dirección no encontrada" });
      }

      // Re-geocode when street/number/comuna change so cached lat/lng
      // doesn't drift from the actual address.
      const street = input.payload.street ?? existing.street;
      const number = input.payload.number ?? existing.number;
      const comuna = input.payload.comuna ?? existing.comuna;
      const shouldGeocode =
        input.payload.street !== undefined ||
        input.payload.number !== undefined ||
        input.payload.comuna !== undefined;
      const geo = shouldGeocode ? await tryGeocodeAddress({ street, number, comuna }) : null;

      const address = await db.address.update({
        where: { id: input.id },
        data: {
          ...input.payload,
          ...(geo
            ? {
                latitude: geo.latitude,
                longitude: geo.longitude,
                chilexpressAddressId: geo.chilexpressAddressId,
              }
            : {}),
        },
      });

      if (input.payload.isPrimary === true) {
        await ensureSinglePrimary(existing.personId, address.id);
      }

      return { address };
    }),

  geocode: updatePersons
    .route({ method: "POST", path: "/{id}/geocode", tags: ["Addresses"] })
    .input(addressIdInputSchema)
    .output(addressResponseSchema)
    .handler(async ({ input }) => {
      const existing = await db.address.findUnique({ where: { id: input.id } });
      if (!existing) {
        throw new ORPCError("NOT_FOUND", { message: "Dirección no encontrada" });
      }
      const geo = await tryGeocodeAddress({
        street: existing.street,
        number: existing.number,
        comuna: existing.comuna,
      });
      const address = await db.address.update({
        where: { id: input.id },
        data: geo
          ? {
              latitude: geo.latitude,
              longitude: geo.longitude,
              chilexpressAddressId: geo.chilexpressAddressId,
            }
          : {},
      });
      return { address };
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

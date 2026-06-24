import { db } from "@finanzas/db";
import type {
  createAddressInputSchema,
  setPrimaryAddressInputSchema,
  updateAddressInputSchema,
} from "@finanzas/orpc-contracts/addresses";
import { Decimal } from "decimal.js";
import type { z } from "zod";
import { DomainError } from "../lib/errors.ts";
import { logError } from "../lib/logger.ts";
import { geocodeAddress } from "./shipments.ts";

// Lógica de negocio de direcciones, fuera de los handlers oRPC. Los servicios
// validan existencia y lanzan DomainError (mapeado a HTTP por
// orpc/error.ts::toORPCError vía el SuperJSONRPCHandler); los handlers quedan
// finos (authz guard → service → return). La integración con Chilexpress
// (georeferencia) vive acá tal cual, best-effort.

type CreateAddressPayload = z.input<typeof createAddressInputSchema>;
type UpdateAddressInput = z.input<typeof updateAddressInputSchema>;
type SetPrimaryAddressInput = z.input<typeof setPrimaryAddressInputSchema>;

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

async function ensurePersonExists(personId: number) {
  const exists = await db.person.findUnique({ where: { id: personId }, select: { id: true } });
  if (!exists) {
    throw new DomainError("NOT_FOUND", "Persona no encontrada");
  }
}

async function ensureSinglePrimary(personId: number, keepId: number) {
  await db.address.updateMany({
    where: { personId, isPrimary: true, id: { not: keepId } },
    data: { isPrimary: false },
  });
}

export async function createAddress(input: CreateAddressPayload) {
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
}

export async function deleteAddress(id: number) {
  const existing = await db.address.findUnique({ where: { id } });
  if (!existing) {
    throw new DomainError("NOT_FOUND", "Dirección no encontrada");
  }
  await db.address.delete({ where: { id } });

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
}

export async function listAddresses(personId: number) {
  const addresses = await db.address.findMany({
    where: { personId },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });
  return { addresses };
}

export async function setPrimaryAddress(input: SetPrimaryAddressInput) {
  const existing = await db.address.findUnique({ where: { id: input.id } });
  if (!existing || existing.personId !== input.personId) {
    throw new DomainError("NOT_FOUND", "Dirección no encontrada");
  }
  await ensureSinglePrimary(input.personId, input.id);
  const address = await db.address.update({
    where: { id: input.id },
    data: { isPrimary: true },
  });
  return { address };
}

export async function updateAddress(input: UpdateAddressInput) {
  const existing = await db.address.findUnique({ where: { id: input.id } });
  if (!existing) {
    throw new DomainError("NOT_FOUND", "Dirección no encontrada");
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
}

export async function geocodeAddressById(id: number) {
  const existing = await db.address.findUnique({ where: { id } });
  if (!existing) {
    throw new DomainError("NOT_FOUND", "Dirección no encontrada");
  }
  const geo = await tryGeocodeAddress({
    street: existing.street,
    number: existing.number,
    comuna: existing.comuna,
  });
  const address = await db.address.update({
    where: { id },
    data: geo
      ? {
          latitude: geo.latitude,
          longitude: geo.longitude,
          chilexpressAddressId: geo.chilexpressAddressId,
        }
      : {},
  });
  return { address };
}

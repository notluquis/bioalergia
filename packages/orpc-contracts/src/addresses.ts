import { oc } from "@orpc/contract";
import { z } from "zod";

export const addressSchema = z.object({
  id: z.number().int(),
  personId: z.number().int(),
  label: z.string(),
  street: z.string(),
  number: z.string(),
  supplement: z.string().nullable(),
  reference: z.string().nullable(),
  postalCode: z.string().nullable(),
  comuna: z.string(),
  region: z.string(),
  coverageCode: z.string().nullable(),
  regionCode: z.string().nullable(),
  ineRegionCode: z.number().int().nullable(),
  ineCountyCode: z.number().int().nullable(),
  supportsCashOnDelivery: z.boolean().nullable(),
  supportsReturn: z.boolean().nullable(),
  latitude: z.unknown().nullable(),
  longitude: z.unknown().nullable(),
  chilexpressAddressId: z.number().int().nullable(),
  countryCode: z.string(),
  isPrimary: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const createAddressInputSchema = z.object({
  personId: z.number().int(),
  label: z.string().min(1).max(60).default("Principal"),
  street: z.string().min(1).max(160),
  number: z.string().min(1).max(20),
  supplement: z.string().max(120).nullable().optional(),
  reference: z.string().max(255).nullable().optional(),
  postalCode: z.string().max(20).nullable().optional(),
  comuna: z.string().min(1).max(120),
  region: z.string().min(1).max(160),
  coverageCode: z.string().max(20).nullable().optional(),
  regionCode: z.string().max(20).nullable().optional(),
  ineRegionCode: z.number().int().nullable().optional(),
  ineCountyCode: z.number().int().nullable().optional(),
  supportsCashOnDelivery: z.boolean().nullable().optional(),
  supportsReturn: z.boolean().nullable().optional(),
  countryCode: z.string().min(2).max(2).default("CL"),
  isPrimary: z.boolean().default(false),
});

export const updateAddressInputSchema = z.object({
  id: z.number().int(),
  payload: createAddressInputSchema.omit({ personId: true }).partial(),
});

export const addressIdInputSchema = z.object({
  id: z.number().int(),
});

export const listAddressesInputSchema = z.object({
  personId: z.number().int(),
});

export const setPrimaryAddressInputSchema = z.object({
  id: z.number().int(),
  personId: z.number().int(),
});

export const addressResponseSchema = z.object({
  address: addressSchema,
});

export const addressListResponseSchema = z.object({
  addresses: z.array(addressSchema),
});

export const addressDeleteResponseSchema = z.object({
  status: z.literal("ok"),
});

export const addressesContract = {
  create: oc
    .route({ method: "POST", path: "/" })
    .input(createAddressInputSchema)
    .output(addressResponseSchema),
  delete: oc
    .route({ method: "DELETE", path: "/{id}" })
    .input(addressIdInputSchema)
    .output(addressDeleteResponseSchema),
  geocode: oc
    .route({ method: "POST", path: "/{id}/geocode" })
    .input(addressIdInputSchema)
    .output(addressResponseSchema),
  list: oc
    .route({ method: "GET", path: "/" })
    .input(listAddressesInputSchema)
    .output(addressListResponseSchema),
  setPrimary: oc
    .route({ method: "POST", path: "/{id}/primary" })
    .input(setPrimaryAddressInputSchema)
    .output(addressResponseSchema),
  update: oc
    .route({ method: "PUT", path: "/{id}" })
    .input(updateAddressInputSchema)
    .output(addressResponseSchema),
};

export type AddressesContract = typeof addressesContract;

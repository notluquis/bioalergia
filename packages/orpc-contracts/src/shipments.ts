import { oc } from "@orpc/contract";
import { z } from "zod";

// ─── Coverage ─────────────────────────────────────────────────────────────────

export const cxRegionSchema = z.object({
  regionId: z.string(),
  regionName: z.string(),
});

export const cxCommuneSchema = z.object({
  countyCode: z.string(),
  countyName: z.string(),
  regionId: z.string(),
  coverageRegionCode: z.string(),
});

export const cxCommercialOfficeSchema = z.object({
  commercialOfficeId: z.string(),
  commercialOfficeName: z.string(),
  street: z.string(),
  number: z.string(),
  commune: z.string(),
  region: z.string(),
  schedules: z.string(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

// ─── Quote ────────────────────────────────────────────────────────────────────

export const cxServiceOptionSchema = z.object({
  serviceTypeCode: z.string(),
  serviceDescription: z.string(),
  serviceValue: z.number(),
  deliveryTime: z.string().optional(),
});

export const quoteShipmentInputSchema = z.object({
  originCoverageCode: z.string(),
  destinationCoverageCode: z.string(),
  weight: z.number().positive(),
  height: z.number().positive(),
  width: z.number().positive(),
  length: z.number().positive(),
  declaredValue: z.number().min(0),
});

export const quoteShipmentOutputSchema = z.object({
  services: z.array(cxServiceOptionSchema),
});

// ─── Create shipment ──────────────────────────────────────────────────────────

export const createShipmentInputSchema = z.object({
  patientId: z.number().int(),
  // Delivery mode: "office" = pickup at Chilexpress sucursal (legacy default).
  //                "home"   = home delivery to a structured Address row.
  deliveryMode: z.enum(["home", "office"]).default("office"),
  serviceTypeCode: z.string(),
  serviceDescription: z.string(),
  destinationCoverageCode: z.string(),
  // Required only when deliveryMode === "office".
  commercialOfficeId: z.string().optional(),
  commercialOfficeName: z.string().optional(),
  // Required only when deliveryMode === "home". Pulled from the patient's
  // Address[] so we have street/number/supplement and the canonical
  // coverageCode already resolved at registration time.
  addressId: z.number().int().optional(),
  recipientName: z.string().min(1),
  recipientPhone: z.string().min(1),
  recipientEmail: z.string().optional(),
  weight: z.number().positive(),
  height: z.number().positive(),
  width: z.number().positive(),
  length: z.number().positive(),
  declaredValue: z.number().min(0),
  cashOnDelivery: z.number().min(0),
  contentDescription: z.string().min(1),
});

export const shipmentSchema = z.object({
  id: z.number().int(),
  patientId: z.number().int(),
  otNumber: z.string(),
  serviceTypeCode: z.string(),
  serviceDescription: z.string(),
  cashOnDelivery: z.number(),
  declaredValue: z.number(),
  weight: z.number(),
  height: z.number(),
  width: z.number(),
  length: z.number(),
  recipientName: z.string(),
  recipientPhone: z.string(),
  recipientEmail: z.string().nullable(),
  commercialOfficeId: z.string(),
  commercialOfficeName: z.string(),
  coverageCode: z.string(),
  contentDescription: z.string(),
  labelBase64: z.string().nullable(),
  status: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createShipmentOutputSchema = z.object({
  shipment: shipmentSchema,
  otNumber: z.string(),
  labelBase64: z.string().nullable(),
});

// ─── List ──────────────────────────────────────────────────────────────────────

export const listShipmentsInputSchema = z.object({
  patientId: z.number().int(),
});

export const listShipmentsOutputSchema = z.object({
  shipments: z.array(shipmentSchema),
});

export const shipmentWithPatientSchema = shipmentSchema.extend({
  patientName: z.string(),
  patientRut: z.string().nullable(),
});

export const listAllShipmentsOutputSchema = z.object({
  shipments: z.array(shipmentWithPatientSchema),
});

// ─── Contract ─────────────────────────────────────────────────────────────────

export const shipmentsContract = {
  getRegions: oc
    .route({ method: "GET", path: "/regions" })
    .output(z.object({ regions: z.array(cxRegionSchema) })),

  getCommunes: oc
    .route({ method: "GET", path: "/communes" })
    .input(z.object({ regionId: z.string() }))
    .output(z.object({ communes: z.array(cxCommuneSchema) })),

  getCommercialOffices: oc
    .route({ method: "GET", path: "/commercial-offices" })
    .input(z.object({ regionCode: z.string(), countyName: z.string() }))
    .output(z.object({ offices: z.array(cxCommercialOfficeSchema) })),

  quote: oc
    .route({ method: "POST", path: "/quote" })
    .input(quoteShipmentInputSchema)
    .output(quoteShipmentOutputSchema),

  create: oc
    .route({ method: "POST", path: "/" })
    .input(createShipmentInputSchema)
    .output(createShipmentOutputSchema),

  list: oc
    .route({ method: "GET", path: "/" })
    .input(listShipmentsInputSchema)
    .output(listShipmentsOutputSchema),

  listAll: oc
    .route({ method: "GET", path: "/all" })
    .output(listAllShipmentsOutputSchema),
};

export type ShipmentsContract = typeof shipmentsContract;

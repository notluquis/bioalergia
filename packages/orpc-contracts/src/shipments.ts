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
  regionCode: z.string().optional(),
  coverageRegionCode: z.string(),
  coverageName: z.string().optional(),
  ineCountyCode: z.number().optional(),
  supportsCashOnDelivery: z.boolean(),
  supportsReturn: z.boolean(),
});

export const cxOfficeBusinessHourSchema = z.object({
  day: z.string(),
  initialStartHour: z.string(),
  initialEndHour: z.string(),
  finalStartHour: z.string(),
  finalEndHour: z.string(),
});

export const cxOfficeServiceSchema = z.object({
  serviceTypeCode: z.number(),
  serviceDescription: z.string(),
  serviceStatusCode: z.number(),
});

export const cxCommercialOfficeSchema = z.object({
  commercialOfficeId: z.string(),
  commercialOfficeName: z.string(),
  officeType: z.number(),
  street: z.string(),
  number: z.string(),
  complement: z.string().optional(),
  commune: z.string(),
  region: z.string(),
  regionCode: z.string(),
  countyCode: z.string().optional(),
  manager: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  distance: z.number().optional(),
  officeCode: z.number().optional(),
  ineCountyId: z.number().optional(),
  businessHour: z.array(cxOfficeBusinessHourSchema),
  services: z.array(cxOfficeServiceSchema),
  schedules: z.string(),
});

export const cxNearbyOfficeSchema = z.object({
  distance: z.string(),
  office: cxCommercialOfficeSchema,
});

export const cxStreetSchema = z.object({
  streetId: z.number(),
  streetName: z.string(),
  countyName: z.string().optional(),
  roadType: z.string().optional(),
});

export const cxStreetNumberSchema = z.object({
  number: z.number(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  addressId: z.number(),
});

export const cxGeocodeSchema = z.object({
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  addressId: z.number().optional(),
});

export const cxTrackingEventSchema = z.object({
  date: z.string().optional(),
  name: z.string().optional(),
  location: z.string().optional(),
});

export const cxTrackingResultSchema = z.object({
  statusCodeReference: z.string().optional(),
  statusDescription: z.string().optional(),
  events: z.array(cxTrackingEventSchema),
});

export const cxReprintLabelResultSchema = z.object({
  label: z.string().optional(),
  barcode: z.string().optional(),
  reference: z.string().optional(),
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
  serviceFullDesc: z.string().nullable().optional(),
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
  certificateNumber: z.number().int().nullable().optional(),
  reference: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  labelBase64: z.string().nullable(),
  labelType: z.number().int().nullable().optional(),
  trackingStatus: z.string().nullable().optional(),
  trackingUpdatedAt: z.coerce.date().nullable().optional(),
  status: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const createShipmentOutputSchema = z.object({
  shipment: shipmentSchema,
  otNumber: z.string(),
  barcode: z.string().nullable(),
  certificateNumber: z.number().int().nullable(),
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
    .input(z.object({ regionId: z.string(), type: z.enum(["1", "2"]).optional() }))
    .output(z.object({ communes: z.array(cxCommuneSchema) })),

  getCommercialOffices: oc
    .route({ method: "GET", path: "/commercial-offices" })
    .input(
      z.object({
        regionCode: z.string(),
        countyName: z.string(),
        type: z.enum(["0", "4"]).optional(),
      })
    )
    .output(z.object({ offices: z.array(cxCommercialOfficeSchema) })),

  getNearbyOffices: oc
    .route({ method: "GET", path: "/nearby-offices" })
    .input(z.object({ addressId: z.number().int() }))
    .output(z.object({ offices: z.array(cxNearbyOfficeSchema) })),

  searchStreets: oc
    .route({ method: "GET", path: "/streets" })
    .input(z.object({ countyName: z.string(), query: z.string().min(2) }))
    .output(z.object({ streets: z.array(cxStreetSchema) })),

  getStreetNumbers: oc
    .route({ method: "GET", path: "/streets/{streetNameId}/numbers" })
    .input(z.object({ streetNameId: z.number().int() }))
    .output(z.object({ numbers: z.array(cxStreetNumberSchema) })),

  geocodeAddress: oc
    .route({ method: "POST", path: "/geocode" })
    .input(
      z.object({
        streetName: z.string().min(1),
        countyName: z.string().min(1),
        number: z.string().min(1),
      })
    )
    .output(z.object({ result: cxGeocodeSchema.nullable() })),

  reprintLabel: oc
    .route({ method: "POST", path: "/{shipmentId}/reprint-label" })
    .input(z.object({ shipmentId: z.number().int() }))
    .output(z.object({ result: cxReprintLabelResultSchema })),

  trackShipment: oc
    .route({ method: "GET", path: "/{shipmentId}/tracking" })
    .input(z.object({ shipmentId: z.number().int() }))
    .output(z.object({ tracking: cxTrackingResultSchema })),

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

  listAll: oc.route({ method: "GET", path: "/all" }).output(listAllShipmentsOutputSchema),
};

export type ShipmentsContract = typeof shipmentsContract;

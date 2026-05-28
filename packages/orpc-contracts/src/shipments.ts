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
  hour: z.string().optional(),
  dateTime: z.string().optional(),
  description: z.string().optional(),
  clientDescription: z.string().optional(),
  eventCode: z.string().optional(),
  compEventCode: z.string().optional(),
  clientEventCode: z.string().optional(),
  motive: z.string().optional(),
  location: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  officeId: z.string().optional(),
  certificadoEntrega: z.string().optional(),
});

export const cxTrackingResultSchema = z.object({
  statusDescription: z.string().optional(),
  status: z.string().optional(),
  locationStatus: z.string().optional(),
  service: z.string().optional(),
  product: z.string().optional(),
  dimensions: z.string().optional(),
  weight: z.string().optional(),
  certificateNumber: z.string().optional(),
  reference: z.string().optional(),
  delivery: z
    .object({
      receptorName: z.string().optional(),
      receptorRut: z.string().optional(),
      deliveryDate: z.string().optional(),
      deliveryHour: z.string().optional(),
      deliveryDateTime: z.string().optional(),
    })
    .optional(),
  address: z
    .object({
      address: z.string().optional(),
      destinationCoverageCode: z.string().optional(),
      originCoverageCode: z.string().optional(),
      latitude: z.string().optional(),
      longitude: z.string().optional(),
    })
    .optional(),
  events: z.array(cxTrackingEventSchema),
});

export const cxReprintLabelResultSchema = z.object({
  label: z.string().optional(),
  barcode: z.string().optional(),
  reference: z.string().optional(),
});

// ─── Quote ────────────────────────────────────────────────────────────────────

// Optional add-on service (e.g. "Cobertura Extendida" at +$600) that
// Chilexpress can attach to a base service. Operator opts-in at quote
// time; we persist the chosen ones so the OT request mirrors them.
export const cxAdditionalServiceSchema = z.object({
  serviceTypeCode: z.coerce.number(),
  serviceDescription: z.coerce.string(),
  serviceValue: z.coerce.number(),
  required: z.boolean().optional(),
});

export const cxServiceOptionSchema = z.object({
  // Chilexpress returns mixed types depending on the service tier and
  // sandbox/prod env. coerce keeps the oRPC output validator from
  // tripping ("Error al cotizar: Output validation failed").
  serviceTypeCode: z.coerce.string(),
  serviceDescription: z.coerce.string(),
  serviceValue: z.coerce.number(),
  deliveryTime: z.coerce.string().optional(),
  // Volumetric weight applied when (largo×ancho×alto/4000) > peso
  // real. UI surfaces this so the operator understands why the price
  // is higher than expected.
  didUseVolumetricWeight: z.boolean().optional(),
  finalWeight: z.coerce.number().optional(),
  // Free-text Chilexpress can put about restrictions or surcharges.
  conditions: z.coerce.string().optional(),
  // 0 = home delivery, 1 = pickup at sucursal (matches our
  // deliveryMode but echoed by Chilexpress).
  deliveryType: z.coerce.number().optional(),
  additionalServices: z.array(cxAdditionalServiceSchema).optional(),
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
  // Optional Chilexpress add-on services the operator opted into at
  // the quote step (e.g. 417 = "Cobertura Extendida"). Each entry is
  // a serviceTypeCode from cxAdditionalServiceSchema; the server
  // attaches them to the package on /transport-orders.
  additionalServiceCodes: z.array(z.number().int()).optional(),
  // Sum of each opted-in serviceValue from the same quote response.
  // Persisted on the shipment row so revenue reports can attribute
  // the surcharge without re-quoting after the fact.
  additionalServicesCost: z.number().min(0).optional(),
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
  additionalServiceCodes: z.array(z.number().int()).default([]),
  additionalServicesCost: z.number().default(0),
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

// ─── Manifiesto (certificado de transporte) ───────────────────────────────────

export const activeManifestSchema = z.object({
  certificateNumber: z.string(),
  openedAt: z.string(),
});

export const openManifestOutputSchema = z.object({
  certificateNumber: z.string(),
  statusDescription: z.string().optional(),
  openedAt: z.string(),
  alreadyOpen: z.boolean(),
});

export const closeManifestInputSchema = z.object({
  certificateNumber: z.union([z.string(), z.number()]).optional(),
  certificateType: z.union([z.literal(1), z.literal(2)]).optional(),
  dropNumber: z.number().int().optional(),
});

// Chilexpress devuelve tipos mixtos (certificateNumber como número, montos a
// veces string, campos null/ausentes). coerce + .catch() hacen cada campo
// resiliente: un valor inesperado cae al fallback en vez de 500ear todo el
// response en el boundary. Es un passthrough de API externa no confiable.
const cxStr = () => z.coerce.string().nullish().catch(undefined);
const cxNum = () => z.coerce.number().nullish().catch(undefined);
export const closedCertificateSchema = z.object({
  certificateNumber: cxStr(),
  printedDate: cxStr(),
  rutNumber: cxNum(),
  businessName: cxStr(),
  amountOfPieces: cxNum(),
  customerCardNumber: cxNum(),
  dropNumber: cxNum(),
  pickupAddress: cxStr(),
  binaryImage: cxStr(),
  imagePdf: cxStr(),
  detail: z
    .array(
      z.object({
        product: cxStr(),
        service: cxStr(),
        amount: cxNum(),
      })
    )
    .nullish()
    .catch(undefined),
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

  refreshAllTracking: oc
    .route({ method: "POST", path: "/tracking/refresh-all" })
    .output(z.object({ updated: z.number().int(), total: z.number().int() })),

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

  getActiveCertificate: oc
    .route({ method: "GET", path: "/certificates/active" })
    .output(z.object({ active: activeManifestSchema.nullable() })),

  openCertificate: oc
    .route({ method: "POST", path: "/certificates/open" })
    .output(openManifestOutputSchema),

  closeCertificate: oc
    .route({ method: "POST", path: "/certificates/close" })
    .input(closeManifestInputSchema)
    .output(closedCertificateSchema),

  getCertificate: oc
    .route({ method: "GET", path: "/certificates/{certificateNumber}" })
    .input(z.object({ certificateNumber: z.string() }))
    .output(closedCertificateSchema),
};

export type ShipmentsContract = typeof shipmentsContract;

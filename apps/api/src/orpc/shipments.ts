import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import {
  createShipmentInputSchema,
  createShipmentOutputSchema,
  cxCommercialOfficeSchema,
  cxCommuneSchema,
  cxGeocodeSchema,
  cxNearbyOfficeSchema,
  cxRegionSchema,
  cxReprintLabelResultSchema,
  cxStreetNumberSchema,
  cxStreetSchema,
  cxTrackingResultSchema,
  listShipmentsInputSchema,
  quoteShipmentInputSchema,
  quoteShipmentOutputSchema,
  shipmentSchema,
} from "@finanzas/orpc-contracts/shipments";
import { z } from "zod";
import { logError } from "../lib/logger.ts";
import {
  closeShipmentCertificate,
  createShipment,
  fetchCommercialOffices,
  fetchCommunes,
  fetchNearbyOffices,
  fetchRegions,
  fetchStreetNumbers,
  fetchStreets,
  geocodeAddress,
  getShipmentCertificate,
  listAllShipments,
  listShipmentsByPatient,
  openShipmentCertificate,
  quoteShipment,
  refreshShipmentTracking,
  reprintShipmentLabel,
} from "../services/shipments.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

export type { CreateShipmentInput } from "../services/shipments.ts";

// Re-use the canonical contract schemas so the server output matches the
// shape the intranet client expects byte-for-byte.
const serializedShipmentSchema = shipmentSchema;
const regionSchema = cxRegionSchema;
const communeSchema = cxCommuneSchema;
const officeSchema = cxCommercialOfficeSchema;

const base = os.$context<Record<string, never>>();
const emptySchema = z.object({});

const closedCertificateSchema = z.object({
  certificateNumber: z.string().optional(),
  printedDate: z.string().optional(),
  rutNumber: z.number().optional(),
  businessName: z.string().optional(),
  amountOfPieces: z.number().optional(),
  customerCardNumber: z.number().optional(),
  dropNumber: z.number().optional(),
  pickupAddress: z.string().optional(),
  binaryImage: z.string().optional(),
  imagePdf: z.string().optional(),
  detail: z
    .array(
      z.object({
        product: z.string().optional(),
        service: z.string().optional(),
        amount: z.number().optional(),
      })
    )
    .optional(),
});

const shipmentsRouterBase = {
  getRegions: base
    .route({
      method: "GET",
      path: "/regions",
      summary: "List ChileExpress regions",
      tags: ["Shipments"],
    })
    .input(emptySchema)
    .output(z.object({ regions: z.array(regionSchema) }))
    .handler(async () => {
      const regions = await fetchRegions();
      return { regions };
    }),

  getCommunes: base
    .route({
      method: "GET",
      path: "/communes",
      summary: "List communes by region",
      tags: ["Shipments"],
    })
    .input(z.object({ regionId: z.string(), type: z.enum(["1", "2"]).optional() }))
    .output(z.object({ communes: z.array(communeSchema) }))
    .handler(async ({ input }) => {
      const communes = await fetchCommunes(
        input.regionId,
        input.type ? (Number(input.type) as 1 | 2) : 1
      );
      return { communes };
    }),

  getCommercialOffices: base
    .route({
      method: "GET",
      path: "/commercial-offices",
      summary: "List ChileExpress offices",
      tags: ["Shipments"],
    })
    .input(
      z.object({
        regionCode: z.string(),
        countyName: z.string(),
        type: z.enum(["0", "4"]).optional(),
      })
    )
    .output(z.object({ offices: z.array(officeSchema) }))
    .handler(async ({ input }) => {
      const offices = await fetchCommercialOffices({
        regionCode: input.regionCode,
        countyName: input.countyName,
        type: input.type ? (Number(input.type) as 0 | 4) : 0,
      });
      return { offices };
    }),

  getNearbyOffices: base
    .route({ method: "GET", path: "/nearby-offices", tags: ["Shipments"] })
    .input(z.object({ addressId: z.number().int() }))
    .output(z.object({ offices: z.array(cxNearbyOfficeSchema) }))
    .handler(async ({ input }) => {
      const offices = await fetchNearbyOffices(input.addressId);
      return { offices };
    }),

  searchStreets: base
    .route({ method: "GET", path: "/streets", tags: ["Shipments"] })
    .input(z.object({ countyName: z.string(), query: z.string().min(2) }))
    .output(z.object({ streets: z.array(cxStreetSchema) }))
    .handler(async ({ input }) => {
      const streets = await fetchStreets(input);
      return { streets };
    }),

  getStreetNumbers: base
    .route({ method: "GET", path: "/streets/{streetNameId}/numbers", tags: ["Shipments"] })
    .input(z.object({ streetNameId: z.number().int() }))
    .output(z.object({ numbers: z.array(cxStreetNumberSchema) }))
    .handler(async ({ input }) => {
      const numbers = await fetchStreetNumbers(input.streetNameId);
      return { numbers };
    }),

  geocodeAddress: base
    .route({ method: "POST", path: "/geocode", tags: ["Shipments"] })
    .input(
      z.object({
        streetName: z.string().min(1),
        countyName: z.string().min(1),
        number: z.string().min(1),
      })
    )
    .output(z.object({ result: cxGeocodeSchema.nullable() }))
    .handler(async ({ input }) => {
      const result = await geocodeAddress(input);
      return { result };
    }),

  reprintLabel: base
    .route({ method: "POST", path: "/{shipmentId}/reprint-label", tags: ["Shipments"] })
    .input(z.object({ shipmentId: z.number().int() }))
    .output(z.object({ result: cxReprintLabelResultSchema }))
    .handler(async ({ input }) => {
      const result = await reprintShipmentLabel(input.shipmentId);
      return { result };
    }),

  trackShipment: base
    .route({ method: "GET", path: "/{shipmentId}/tracking", tags: ["Shipments"] })
    .input(z.object({ shipmentId: z.number().int() }))
    .output(z.object({ tracking: cxTrackingResultSchema }))
    .handler(async ({ input }) => {
      const tracking = await refreshShipmentTracking(input.shipmentId);
      return { tracking };
    }),

  quote: base
    .route({ method: "POST", path: "/quote", summary: "Quote shipment cost", tags: ["Shipments"] })
    .input(quoteShipmentInputSchema)
    .output(quoteShipmentOutputSchema)
    .handler(async ({ input }) => {
      const services = await quoteShipment(input);
      return { services };
    }),

  create: base
    .route({
      method: "POST",
      path: "/",
      summary: "Create ChileExpress transport order",
      tags: ["Shipments"],
    })
    .input(createShipmentInputSchema)
    .output(createShipmentOutputSchema)
    .handler(async ({ input }) => {
      return createShipment(input);
    }),

  list: base
    .route({ method: "GET", path: "/", summary: "List shipments by patient", tags: ["Shipments"] })
    .input(listShipmentsInputSchema)
    .output(z.object({ shipments: z.array(serializedShipmentSchema) }))
    .handler(async ({ input }) => {
      const shipments = await listShipmentsByPatient(input.patientId);
      return { shipments };
    }),

  listAll: base
    .route({ method: "GET", path: "/all", summary: "List all shipments", tags: ["Shipments"] })
    .output(
      z.object({
        shipments: z.array(
          serializedShipmentSchema.extend({
            patientName: z.string(),
            patientRut: z.string().nullable(),
          })
        ),
      })
    )
    .handler(async () => {
      const shipments = await listAllShipments();
      return { shipments };
    }),

  // ─── Manifiesto (certificados de transporte) ────────────────────────────
  //
  // Flujo Chilexpress: abrir certificado → OTs lo referencian → cerrar al final
  // del día → obtener PDF base64 del manifiesto. Reconsulta via getCertificate.

  openCertificate: base
    .route({
      method: "POST",
      path: "/certificates/open",
      summary: "Abrir certificado (manifiesto) Chilexpress",
      tags: ["Shipments"],
    })
    .input(emptySchema)
    .output(
      z.object({
        certificateNumber: z.string(),
        statusDescription: z.string().optional(),
      })
    )
    .handler(async () => openShipmentCertificate()),

  closeCertificate: base
    .route({
      method: "POST",
      path: "/certificates/close",
      summary: "Cerrar certificado y obtener PDF del manifiesto",
      tags: ["Shipments"],
    })
    .input(
      z.object({
        certificateNumber: z.union([z.string(), z.number()]),
        certificateType: z.union([z.literal(1), z.literal(2)]).optional(),
        dropNumber: z.number().int().optional(),
      })
    )
    .output(closedCertificateSchema)
    .handler(async ({ input }) => closeShipmentCertificate(input)),

  getCertificate: base
    .route({
      method: "GET",
      path: "/certificates/{certificateNumber}",
      summary: "Consultar certificado cerrado (PDF + detalle)",
      tags: ["Shipments"],
    })
    .input(z.object({ certificateNumber: z.string() }))
    .output(closedCertificateSchema)
    .handler(async ({ input }) => getShipmentCertificate(input.certificateNumber)),
};

export const shipmentsORPCRouter = base.prefix("/api/orpc/shipments").router(shipmentsRouterBase);

export const shipmentsORPCHandler = new SuperJSONRPCHandler(shipmentsORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, { module: "api", operation: "orpc.shipments" });
    }),
  ],
});

export const shipmentsOpenAPIHandler = new OpenAPIHandler(shipmentsORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Shipments oRPC",
          description: "Integración ChileExpress: cobertura, cotización y órdenes de transporte.",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, { module: "api", operation: "openapi.shipments" });
    }),
  ],
});

export type ShipmentsORPCRouter = typeof shipmentsORPCRouter;

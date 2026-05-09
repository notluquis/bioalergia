import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import {
  createShipmentInputSchema,
  listShipmentsInputSchema,
  quoteShipmentInputSchema,
  quoteShipmentOutputSchema,
} from "@finanzas/orpc-contracts/shipments";
import { z } from "zod";
import { logError } from "../lib/logger";
import {
  createShipment,
  fetchCommercialOffices,
  fetchCommunes,
  fetchRegions,
  listAllShipments,
  listShipmentsByPatient,
  quoteShipment,
} from "../services/shipments";
import { configureSuperjson } from "../lib/superjson-config";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();

export type CreateShipmentInput = z.infer<typeof createShipmentInputSchema>;

const serializedShipmentSchema = z.object({
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

const base = os.$context<Record<string, never>>();
const emptySchema = z.object({});

const regionSchema = z.object({ regionId: z.string(), regionName: z.string() });
const communeSchema = z.object({
  countyCode: z.string(),
  countyName: z.string(),
  regionId: z.string(),
  coverageRegionCode: z.string(),
});
const officeSchema = z.object({
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

const shipmentsRouterBase = {
  getRegions: base
    .route({ method: "GET", path: "/regions", summary: "List ChileExpress regions", tags: ["Shipments"] })
    .input(emptySchema)
    .output(z.object({ regions: z.array(regionSchema) }))
    .handler(async () => {
      const regions = await fetchRegions();
      return { regions };
    }),

  getCommunes: base
    .route({ method: "GET", path: "/communes", summary: "List communes by region", tags: ["Shipments"] })
    .input(z.object({ regionId: z.string() }))
    .output(z.object({ communes: z.array(communeSchema) }))
    .handler(async ({ input }) => {
      const communes = await fetchCommunes(input.regionId);
      return { communes };
    }),

  getCommercialOffices: base
    .route({ method: "GET", path: "/commercial-offices", summary: "List ChileExpress offices", tags: ["Shipments"] })
    .input(z.object({ regionCode: z.string(), countyName: z.string() }))
    .output(z.object({ offices: z.array(officeSchema) }))
    .handler(async ({ input }) => {
      const offices = await fetchCommercialOffices({
        regionCode: input.regionCode,
        countyName: input.countyName,
      });
      return { offices };
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
    .route({ method: "POST", path: "/", summary: "Create ChileExpress transport order", tags: ["Shipments"] })
    .input(createShipmentInputSchema)
    .output(z.object({ shipment: serializedShipmentSchema, otNumber: z.string(), labelBase64: z.string().nullable() }))
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
          }),
        ),
      }),
    )
    .handler(async () => {
      const shipments = await listAllShipments();
      return { shipments };
    }),
};

export const shipmentsORPCRouter = base
  .prefix("/api/orpc/shipments")
  .router(shipmentsRouterBase);

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

import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { db } from "@finanzas/db";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { logError } from "../lib/logger";
import { configureSuperjson } from "../lib/superjson-config";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();

type CertificatesORPCContext = {
  hono: HonoContext;
};

const base = os.$context<CertificatesORPCContext>();

const certificateVerifyInputSchema = z.object({
  id: z.string().min(1),
});

const certificateVerifyResponseSchema = z.union([
  z.object({
    diagnosis: z.string(),
    doctor: z.object({
      name: z.string(),
      specialty: z.string().optional(),
    }),
    issuedAt: z.coerce.date(),
    patient: z.object({
      name: z.string(),
    }),
    purpose: z.string(),
    restDays: z.number().nullable().optional(),
    restEndDate: z.coerce.date().nullable().optional(),
    restStartDate: z.coerce.date().nullable().optional(),
    valid: z.literal(true),
  }),
  z.object({
    error: z.string().optional(),
    valid: z.literal(false),
  }),
]);

const certificatesORPCRouterBase = {
  verify: base
    .route({
      method: "GET",
      path: "/verify/{id}",
      summary: "Verify medical certificate authenticity",
      tags: ["Certificates"],
    })
    .input(certificateVerifyInputSchema)
    .output(certificateVerifyResponseSchema)
    .handler(async ({ input }) => {
      const certificate = await db.medicalCertificate.findUnique({
        where: { id: input.id },
        include: {
          issuer: {
            include: {
              person: true,
            },
          },
        },
      });

      if (!certificate) {
        return {
          error: "Certificado no encontrado",
          valid: false as const,
        };
      }

      if (!certificate.issuer?.person) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Certificado sin emisor válido",
        });
      }

      return {
        diagnosis: certificate.diagnosis,
        doctor: {
          name: certificate.issuer.person.names,
          specialty: "Especialista en Alergología e Inmunología Clínica",
        },
        issuedAt: certificate.issuedAt,
        patient: {
          name: certificate.patientName,
        },
        purpose: certificate.purpose,
        restDays: certificate.restDays,
        restEndDate: certificate.restEndDate,
        restStartDate: certificate.restStartDate,
        valid: true as const,
      };
    }),
};

export const certificatesORPCRouter =
  base.prefix("/api/orpc/certificates").router(certificatesORPCRouterBase);

export const certificatesORPCHandler = new SuperJSONRPCHandler(certificatesORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "orpc.certificates",
      });
    }),
  ],
});

export const certificatesOpenAPIHandler = new OpenAPIHandler(certificatesORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Certificates oRPC",
          description: "Contratos oRPC/OpenAPI para verificación de certificados médicos.",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "openapi.certificates",
      });
    }),
  ],
});

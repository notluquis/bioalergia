import {
  annulPrescriptionResponseSchema,
  certificateVerifyInputSchema,
  certificateVerifyResponseSchema,
  certificateIdInputSchema,
  emailPrescriptionInputSchema,
  emailPrescriptionResponseSchema,
  generateMedicalCertificateInputSchema,
  generateMedicalPrescriptionInputSchema,
  listMedicalCertificatesInputSchema,
  listMedicalPrescriptionsInputSchema,
  medicalCertificateListResponseSchema,
  medicalPrescriptionGenerateResponseSchema,
  medicalPrescriptionListResponseSchema,
  prescriptionIdInputSchema,
} from "@finanzas/orpc-contracts/certificates";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os as orpcOs } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  deleteMedicalCertificate,
  generateMedicalCertificate,
  listMedicalCertificates,
  verifyMedicalCertificate,
} from "../services/certificates.ts";
import {
  annulPrescription,
  createMedicalPrescription,
  emailPrescription,
  listMedicalPrescriptions,
} from "../services/prescriptions.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type CertificatesORPCContext = {
  hono: HonoContext;
};

const base = orpcOs.$context<CertificatesORPCContext>();

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);
  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  }

  return next({
    context: {
      ...context,
      user,
    },
  });
});

const createMedicalCertificates = authed.use(async ({ context, next }) => {
  const canCreate = await hasPermission(context.user, "create", "MedicalCertificate");
  if (!canCreate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }
  return next();
});

const readMedicalCertificates = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user, "read", "MedicalCertificate");
  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }
  return next();
});

const deleteMedicalCertificates = authed.use(async ({ context, next }) => {
  const canDelete = await hasPermission(context.user, "delete", "MedicalCertificate");
  if (!canDelete) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }
  return next();
});

const certificatesORPCRouterBase = {
  generateMedical: createMedicalCertificates
    .route({
      method: "POST",
      path: "/medical",
      summary: "Generate a signed medical certificate PDF",
      tags: ["Certificates"],
    })
    .input(generateMedicalCertificateInputSchema)
    .output(z.file())
    .handler(async ({ context, input }) => generateMedicalCertificate(input, context.user.id)),

  generatePrescription: createMedicalCertificates
    .route({
      method: "POST",
      path: "/prescription",
      summary: "Generate a medical prescription PDF",
      tags: ["Certificates"],
    })
    .input(generateMedicalPrescriptionInputSchema)
    .output(medicalPrescriptionGenerateResponseSchema)
    .handler(async ({ context, input }) => createMedicalPrescription(input, context.user.id)),

  annulPrescription: createMedicalCertificates
    .route({
      method: "POST",
      path: "/prescription/{id}/annul",
      summary: "Annul a medical prescription (soft, keeps audit record)",
      tags: ["Certificates"],
    })
    .input(prescriptionIdInputSchema)
    .output(annulPrescriptionResponseSchema)
    .handler(async ({ input }) => annulPrescription(input.id)),

  emailPrescription: createMedicalCertificates
    .route({
      method: "POST",
      path: "/prescription/{id}/email",
      summary: "Email a medical prescription PDF to the patient",
      tags: ["Certificates"],
    })
    .input(emailPrescriptionInputSchema)
    .output(emailPrescriptionResponseSchema)
    .handler(async ({ input }) =>
      emailPrescription({ id: input.id, to: input.to, message: input.message })
    ),

  listPrescriptions: readMedicalCertificates
    .route({
      method: "GET",
      path: "/prescriptions",
      summary: "List medical prescriptions",
      tags: ["Certificates"],
    })
    .input(listMedicalPrescriptionsInputSchema)
    .output(medicalPrescriptionListResponseSchema)
    .handler(async ({ input }) => listMedicalPrescriptions(input)),

  listMedical: readMedicalCertificates
    .route({
      method: "GET",
      path: "/medical",
      summary: "List medical certificates",
      tags: ["Certificates"],
    })
    .input(listMedicalCertificatesInputSchema)
    .output(medicalCertificateListResponseSchema)
    .handler(async ({ input }) => listMedicalCertificates(input)),

  deleteMedical: deleteMedicalCertificates
    .route({
      method: "DELETE",
      path: "/medical/{id}",
      summary: "Delete a medical certificate",
      tags: ["Certificates"],
    })
    .input(certificateIdInputSchema)
    .output(z.object({ ok: z.boolean() }))
    .handler(async ({ input }) => deleteMedicalCertificate(input.id)),

  verify: base
    .route({
      method: "GET",
      path: "/verify/{id}",
      summary: "Verify medical certificate authenticity",
      tags: ["Certificates"],
    })
    .input(certificateVerifyInputSchema)
    .output(certificateVerifyResponseSchema)
    .handler(async ({ input }) => verifyMedicalCertificate(input.id)),
};

export const certificatesORPCRouter = base
  .prefix("/api/orpc/certificates")
  .router(certificatesORPCRouterBase);

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
          description: "Contratos oRPC/OpenAPI para certificados médicos.",
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

export type CertificatesORPCRouter = typeof certificatesORPCRouter;

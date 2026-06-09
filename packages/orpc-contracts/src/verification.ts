import { oc } from "@orpc/contract";
import { z } from "zod";

// Verificación pública unificada de documentos (recetas + certificados).
// El input es el código corto BA-XXXX-XXXX (o un cuid legacy de certificado).
// `h` opcional = hash SHA-256 esperado del PDF, para el badge de integridad.
export const verifyDocumentInputSchema = z.object({
  code: z.string().min(1).max(64),
  h: z.string().min(1).max(128).optional(),
});

const documentTypeSchema = z.enum(["prescription", "certificate"]);

// Proyección MÍNIMA segura: sin nombre completo, sin RUT COMPLETO, sin
// contenido clínico (diagnóstico/medicamentos). RUT sólo parcial (enmascarado).
export const verifyDocumentResponseSchema = z.union([
  z.object({
    valid: z.literal(true),
    documentType: documentTypeSchema,
    documentLabel: z.string(),
    issuedAt: z.coerce.date(),
    doctor: z.object({
      name: z.string(),
      specialty: z.string(),
      license: z.string().optional(),
    }),
    patientInitials: z.string(),
    patientRutMasked: z.string().optional(),
    prescriptionType: z.string().optional(),
    folio: z.string().optional(),
    pdfIntact: z.boolean().optional(),
  }),
  z.object({
    valid: z.literal(false),
  }),
]);

export const verificationContract = {
  verify: oc
    .route({ method: "GET", path: "/verify/{code}" })
    .input(verifyDocumentInputSchema)
    .output(verifyDocumentResponseSchema),
};

export type VerificationContract = typeof verificationContract;

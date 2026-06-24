import { oc } from "@orpc/contract";
import { z } from "zod";

// Consentimiento informado CLÍNICO (Ley 20.584) — por procedimiento concreto.
// NO es el consentimiento de datos personales (consentContract). Registra el
// procedimiento, riesgos, alternativas y la decisión del titular.
export const clinicalConsentProcedureSchema = z.enum([
  "SCIT",
  "SKIN_TEST",
  "PATCH_TEST",
  "PROCEDURE",
  "OTHER",
]);

export const clinicalConsentStatusSchema = z.enum(["PENDING", "SIGNED", "REFUSED", "REVOKED"]);

// Estados a los que el operador puede mover una solicitud (no PENDING).
export const clinicalConsentDecisionSchema = z.enum(["SIGNED", "REFUSED", "REVOKED"]);

export const clinicalConsentSignatureSchema = z.enum([
  "PRESENCIAL_FISICA",
  "ELECTRONICA_SIMPLE",
  "VERBAL_REGISTRADA",
]);

export const clinicalConsentSchema = z.object({
  id: z.string(),
  patientId: z.number().int(),
  patientName: z.string(),
  procedureType: clinicalConsentProcedureSchema,
  procedureName: z.string(),
  templateVersion: z.string(),
  contentSnapshot: z.string(),
  risksDisclosed: z.string().nullable(),
  alternativesDisclosed: z.string().nullable(),
  status: clinicalConsentStatusSchema,
  signatureMethod: clinicalConsentSignatureSchema,
  signerName: z.string(),
  signerRut: z.string().nullable(),
  signerRelationship: z.string().nullable(),
  clinicianId: z.number().int().nullable(),
  signedAt: z.date().nullable(),
  refusedReason: z.string().nullable(),
  revokedAt: z.date().nullable(),
  notes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const clinicalConsentListInputSchema = z.object({
  patientId: z.number().int().optional(),
  status: clinicalConsentStatusSchema.optional(),
});

export const clinicalConsentListResponseSchema = z.object({
  consents: z.array(clinicalConsentSchema),
});

export const clinicalConsentCreateInputSchema = z.object({
  patientId: z.number().int(),
  procedureType: clinicalConsentProcedureSchema,
  procedureName: z.string().min(1),
  templateVersion: z.string().min(1),
  contentSnapshot: z.string().min(1),
  risksDisclosed: z.string().optional(),
  alternativesDisclosed: z.string().optional(),
  signatureMethod: clinicalConsentSignatureSchema,
  signerName: z.string().min(1),
  signerRut: z.string().optional(),
  signerRelationship: z.string().optional(),
  clinicianId: z.number().int().optional(),
  notes: z.string().optional(),
});

export const clinicalConsentDecideInputSchema = z.object({
  id: z.string().min(1),
  status: clinicalConsentDecisionSchema,
  refusedReason: z.string().optional(),
});

export const clinicalConsentContract = {
  list: oc
    .route({ method: "GET", path: "/consents" })
    .input(clinicalConsentListInputSchema)
    .output(clinicalConsentListResponseSchema),
  create: oc
    .route({ method: "POST", path: "/consents" })
    .input(clinicalConsentCreateInputSchema)
    .output(clinicalConsentSchema),
  decide: oc
    .route({ method: "POST", path: "/consents/decide" })
    .input(clinicalConsentDecideInputSchema)
    .output(clinicalConsentSchema),
};

export type ClinicalConsentContract = typeof clinicalConsentContract;
export type ClinicalConsentDto = z.infer<typeof clinicalConsentSchema>;
export type ClinicalConsentProcedure = z.infer<typeof clinicalConsentProcedureSchema>;
export type ClinicalConsentStatus = z.infer<typeof clinicalConsentStatusSchema>;
export type ClinicalConsentDecision = z.infer<typeof clinicalConsentDecisionSchema>;
export type ClinicalConsentSignature = z.infer<typeof clinicalConsentSignatureSchema>;
export type ClinicalConsentCreateInput = z.infer<typeof clinicalConsentCreateInputSchema>;

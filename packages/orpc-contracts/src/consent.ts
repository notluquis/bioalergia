import { oc } from "@orpc/contract";
import { z } from "zod";

// Registro de consentimiento para tratamiento de DATOS personales (Ley 21.719).
// NO es el consentimiento informado clínico de un procedimiento. Historia
// auditable: propósito, fecha, canal, versión del texto y revocación.
export const consentPurposeSchema = z.enum([
  "MARKETING_EMAIL",
  "MARKETING_WHATSAPP",
  "MARKETING_SMS",
  "DATA_PROCESSING_SECONDARY",
  "RESEARCH",
  "DATA_SHARING",
  // Recordatorios de adherencia SCIT/SLIT — propósito distinto de marketing
  // (gate del envío en services/adherence-reminders.ts).
  "ADHERENCE_REMINDER",
  // eDiary de síntomas (P2) — recolección de datos sensibles de salud +
  // scoring automatizado (CSMS). Gate EIPD (docs/EIPD_EDIARY.md). Granularidad
  // por finalidad: registro clínico (este) separable del scoring/comunicaciones.
  "SYMPTOM_DIARY",
]);

export const consentChannelSchema = z.enum([
  "WEB",
  "PRESENCIAL",
  "EMAIL",
  "WHATSAPP",
  "PHONE",
  "IMPORT",
]);

export const consentStatusSchema = z.enum(["GRANTED", "WITHDRAWN"]);

export const consentRecordSchema = z.object({
  id: z.string(),
  personId: z.number().int(),
  personName: z.string(),
  personEmail: z.string().nullable(),
  purpose: consentPurposeSchema,
  status: consentStatusSchema,
  grantedAt: z.date(),
  withdrawnAt: z.date().nullable(),
  channel: consentChannelSchema,
  policyVersion: z.string(),
  evidenceText: z.string().nullable(),
  source: z.string().nullable(),
  recordedBy: z.number().int().nullable(),
  createdAt: z.date(),
});

export const consentListInputSchema = z.object({
  personId: z.number().int().optional(),
  purpose: consentPurposeSchema.optional(),
  status: consentStatusSchema.optional(),
});

export const consentListResponseSchema = z.object({
  records: z.array(consentRecordSchema),
});

export const consentRecordInputSchema = z.object({
  personId: z.number().int(),
  purpose: consentPurposeSchema,
  channel: consentChannelSchema,
  policyVersion: z.string().min(1),
  evidenceText: z.string().optional(),
  source: z.string().optional(),
});

export const consentWithdrawInputSchema = z.object({
  id: z.string().min(1),
});

export const consentContract = {
  list: oc
    .route({ method: "GET", path: "/records" })
    .input(consentListInputSchema)
    .output(consentListResponseSchema),
  record: oc
    .route({ method: "POST", path: "/records" })
    .input(consentRecordInputSchema)
    .output(consentRecordSchema),
  withdraw: oc
    .route({ method: "POST", path: "/records/withdraw" })
    .input(consentWithdrawInputSchema)
    .output(consentRecordSchema),
};

export type ConsentContract = typeof consentContract;
export type ConsentRecordDto = z.infer<typeof consentRecordSchema>;
export type ConsentPurpose = z.infer<typeof consentPurposeSchema>;
export type ConsentChannel = z.infer<typeof consentChannelSchema>;
export type ConsentStatus = z.infer<typeof consentStatusSchema>;
export type ConsentRecordInput = z.infer<typeof consentRecordInputSchema>;

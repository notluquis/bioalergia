import { oc } from "@orpc/contract";
import { z } from "zod";

/**
 * Salud ocupacional stage-C — resultado INDIVIDUAL (compliance-by-design).
 * Todo staff clínico. Los hard gates legales viven en el service
 * (services/occupational-testing.ts), no aquí. El empleador NUNCA consume estos
 * endpoints: su única vista es la divulgación agregada/consentida (stage-B).
 */

export const occTestingReasonSchema = z.enum([
  "PRE_EMPLEO",
  "PERIODICO",
  "ALEATORIO",
  "POST_ACCIDENTE",
  "SOSPECHA_RAZONABLE",
  "RETORNO",
  "CONTROL_POLICIAL",
  "OTRO",
]);
export const occRequestSourceSchema = z.enum([
  "ORDEN_MEDICA",
  "SOLICITUD_EMPLEADOR",
  "ORDEN_JUDICIAL",
  "SUPERVISOR_FAENA",
]);
export const occRegulatoryBasisSchema = z.enum([
  "DS_132_ART_40",
  "RIOHS",
  "LEY_18290",
  "DS_44_PROGRAMA",
  "POLITICA_EMPRESA",
]);
export const occMandateTypeSchema = z.enum([
  "MANDATED_BY_LAW",
  "PERMITTED_VIA_RIOHS",
  "COMPANY_POLICY",
]);
export const occOrderStatusSchema = z.enum([
  "DRAFT",
  "CONSENT_PENDING",
  "COLLECTED",
  "IN_TRANSIT",
  "RECEIVED",
  "SCREENING",
  "PRESUMPTIVE_POSITIVE",
  "CONFIRMATION_PENDING",
  "MEDICAL_REVIEW",
  "RESULTED",
  "INVALID",
  "CANCELLED",
]);
export const occFinalResultSchema = z.enum([
  "PENDING",
  "NEGATIVE",
  "POSITIVE",
  "NEGATIVE_MEDICALLY_EXPLAINED",
  "INVALID",
]);
export const occSampleKindSchema = z.enum(["MUESTRA", "CONTRAMUESTRA"]);
export const occMatrixSchema = z.enum(["ORINA", "SANGRE", "SALIVA", "ALIENTO"]);
export const occCustodyActionSchema = z.enum([
  "COLLECT",
  "SPLIT",
  "SEAL",
  "DONOR_VERIFY",
  "HANDOFF",
  "TRANSPORT",
  "RECEIVE",
  "SEAL_CHECK",
  "ALIQUOT",
  "STORE",
  "DESTROY",
]);
export const occConfirmMethodSchema = z.enum(["GC_MS", "LC_MS_MS"]);
export const occConsentPurposeSchema = z.enum([
  "TEST",
  "EMPLOYER_DISCLOSURE",
  "SUBSTANCE_LEVEL_DISCLOSURE",
  "IDENTITY_LINK",
]);

// ── DTOs ─────────────────────────────────────────────────────────────
export const occSubjectSchema = z.object({
  id: z.number().int(),
  subjectCode: z.string(),
  personId: z.number().int().nullable(),
  createdAt: z.coerce.date(),
});
export const occOrderSchema = z.object({
  id: z.number().int(),
  subjectId: z.number().int(),
  programId: z.number().int().nullable(),
  companyId: z.number().int().nullable(),
  testingReason: occTestingReasonSchema,
  requestSource: occRequestSourceSchema,
  regulatoryBasis: occRegulatoryBasisSchema,
  mandateType: occMandateTypeSchema,
  riohsClauseRef: z.string().nullable(),
  status: occOrderStatusSchema,
  finalResult: occFinalResultSchema,
  refusalFlag: z.boolean(),
  notes: z.string().nullable(),
  createdAt: z.coerce.date(),
  lastEntryAt: z.coerce.date(),
});
export const occSampleSchema = z.object({
  id: z.number().int(),
  orderId: z.number().int(),
  kind: occSampleKindSchema,
  containerCode: z.string(),
  matrix: occMatrixSchema,
  sealId: z.string().nullable(),
  sealIntact: z.boolean(),
  primaryAliquotOf: z.number().int().nullable(),
  createdAt: z.coerce.date(),
});
export const occCustodyEventSchema = z.object({
  id: z.number().int(),
  orderId: z.number().int(),
  sampleId: z.number().int().nullable(),
  action: occCustodyActionSchema,
  actorRole: z.string().nullable(),
  signatureRef: z.string().nullable(),
  sealIntact: z.boolean().nullable(),
  location: z.string().nullable(),
  notes: z.string().nullable(),
  occurredAt: z.coerce.date(),
});

// ── Inputs ───────────────────────────────────────────────────────────
export const createOccSubjectInputSchema = z.object({
  subjectCode: z.string().min(1).max(80),
  personId: z.number().int().nullable().optional(),
});
export const createOccOrderInputSchema = z.object({
  subjectId: z.number().int(),
  programId: z.number().int().nullable().optional(),
  companyId: z.number().int().nullable().optional(),
  testingReason: occTestingReasonSchema,
  requestSource: occRequestSourceSchema,
  regulatoryBasis: occRegulatoryBasisSchema,
  mandateType: occMandateTypeSchema,
  riohsClauseRef: z.string().max(2000).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export const addOccSampleInputSchema = z.object({
  orderId: z.number().int(),
  kind: occSampleKindSchema,
  containerCode: z.string().min(1).max(80),
  matrix: occMatrixSchema.optional(),
  sealId: z.string().max(80).nullable().optional(),
  primaryAliquotOf: z.number().int().nullable().optional(),
});
export const addOccCustodyEventInputSchema = z.object({
  orderId: z.number().int(),
  sampleId: z.number().int().nullable().optional(),
  action: occCustodyActionSchema,
  actorRole: z.string().max(120).nullable().optional(),
  signatureRef: z.string().max(200).nullable().optional(),
  sealIntact: z.boolean().nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});
export const recordScreeningInputSchema = z.object({
  orderId: z.number().int(),
  method: z.string().max(80).optional(),
  panel: z.array(z.unknown()),
  outcome: z.enum(["NEGATIVE", "PRESUMPTIVE_POSITIVE"]),
  labId: z.string().max(120).nullable().optional(),
});
export const recordConfirmatoryInputSchema = z.object({
  orderId: z.number().int(),
  method: occConfirmMethodSchema,
  sampleId: z.number().int(),
  analytes: z.array(z.unknown()),
  outcome: z.enum(["NEGATIVE", "POSITIVE"]),
  confirmingLabId: z.string().max(120).nullable().optional(),
  isoAccredited: z.boolean().optional(),
});
export const recordMedicalReviewInputSchema = z.object({
  orderId: z.number().int(),
  declaredMeds: z.array(z.unknown()).nullable().optional(),
  decision: z.enum(["CONFIRMED_POSITIVE", "EXPLAINED_BY_RX"]),
  rationale: z.string().min(1).max(2000),
});
export const recordOccConsentInputSchema = z.object({
  orderId: z.number().int(),
  purpose: occConsentPurposeSchema,
  granted: z.boolean(),
  scope: z.unknown().optional(),
  evidenceRef: z.string().max(200).nullable().optional(),
});
export const revokeOccConsentInputSchema = z.object({ consentId: z.number().int() });
export const discloseToEmployerInputSchema = z.object({
  orderId: z.number().int(),
  payloadKind: z.enum(["AGGREGATE", "FITNESS_OUTCOME", "SUBSTANCE_DETAIL"]),
});
export const occOrderIdInputSchema = z.object({ orderId: z.number().int() });
export const listOccOrdersInputSchema = z.object({ programId: z.number().int().optional() });

// ── Responses ────────────────────────────────────────────────────────
export const occSubjectResponseSchema = z.object({ subject: occSubjectSchema });
export const occOrderResponseSchema = z.object({ order: occOrderSchema });
export const occOrderListResponseSchema = z.object({ orders: z.array(occOrderSchema) });
export const occSampleResponseSchema = z.object({ sample: occSampleSchema });
export const occCustodyEventResponseSchema = z.object({ event: occCustodyEventSchema });
export const occOkResponseSchema = z.object({ ok: z.literal(true) });
export const occOrderDetailResponseSchema = z.object({
  order: occOrderSchema,
  subject: occSubjectSchema,
  samples: z.array(occSampleSchema),
  custodyEvents: z.array(occCustodyEventSchema),
});

export const occupationalTestingContract = {
  createSubject: oc
    .route({ method: "POST", path: "/subjects" })
    .input(createOccSubjectInputSchema)
    .output(occSubjectResponseSchema),
  createOrder: oc
    .route({ method: "POST", path: "/orders" })
    .input(createOccOrderInputSchema)
    .output(occOrderResponseSchema),
  listOrders: oc
    .route({ method: "POST", path: "/orders/list" })
    .input(listOccOrdersInputSchema)
    .output(occOrderListResponseSchema),
  getOrder: oc
    .route({ method: "POST", path: "/orders/detail" })
    .input(occOrderIdInputSchema)
    .output(occOrderDetailResponseSchema),
  addSample: oc
    .route({ method: "POST", path: "/samples" })
    .input(addOccSampleInputSchema)
    .output(occSampleResponseSchema),
  addCustodyEvent: oc
    .route({ method: "POST", path: "/custody" })
    .input(addOccCustodyEventInputSchema)
    .output(occCustodyEventResponseSchema),
  recordScreening: oc
    .route({ method: "POST", path: "/screening" })
    .input(recordScreeningInputSchema)
    .output(occOrderResponseSchema),
  recordConfirmatory: oc
    .route({ method: "POST", path: "/confirmatory" })
    .input(recordConfirmatoryInputSchema)
    .output(occOrderResponseSchema),
  recordMedicalReview: oc
    .route({ method: "POST", path: "/medical-review" })
    .input(recordMedicalReviewInputSchema)
    .output(occOrderResponseSchema),
  recordConsent: oc
    .route({ method: "POST", path: "/consents" })
    .input(recordOccConsentInputSchema)
    .output(occOkResponseSchema),
  revokeConsent: oc
    .route({ method: "POST", path: "/consents/revoke" })
    .input(revokeOccConsentInputSchema)
    .output(occOkResponseSchema),
  discloseToEmployer: oc
    .route({ method: "POST", path: "/disclose" })
    .input(discloseToEmployerInputSchema)
    .output(occOkResponseSchema),
};

export type OccupationalTestingContract = typeof occupationalTestingContract;
export type OccOrderDto = z.infer<typeof occOrderSchema>;
export type OccSubjectDto = z.infer<typeof occSubjectSchema>;
export type OccSampleDto = z.infer<typeof occSampleSchema>;
export type OccCustodyEventDto = z.infer<typeof occCustodyEventSchema>;
export type CreateOccOrderInput = z.infer<typeof createOccOrderInputSchema>;

import { z } from "zod";

// ── Validación local de respuestas API ────────────────────────────────
// Convención intranet: las respuestas se validan con schemas locales
// (z.strictObject), NO con el contrato oRPC. Fechas superjson = z.coerce.date().

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

export const OccSubjectSchema = z.strictObject({
  id: z.number(),
  subjectCode: z.string(),
  personId: z.number().nullable(),
  createdAt: z.coerce.date(),
});

export const OccOrderSchema = z.strictObject({
  id: z.number(),
  subjectId: z.number(),
  programId: z.number().nullable(),
  companyId: z.number().nullable(),
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

export const OccSampleSchema = z.strictObject({
  id: z.number(),
  orderId: z.number(),
  kind: occSampleKindSchema,
  containerCode: z.string(),
  matrix: occMatrixSchema,
  sealId: z.string().nullable(),
  sealIntact: z.boolean(),
  primaryAliquotOf: z.number().nullable(),
  createdAt: z.coerce.date(),
});

export const OccCustodyEventSchema = z.strictObject({
  id: z.number(),
  orderId: z.number(),
  sampleId: z.number().nullable(),
  action: occCustodyActionSchema,
  actorRole: z.string().nullable(),
  signatureRef: z.string().nullable(),
  sealIntact: z.boolean().nullable(),
  location: z.string().nullable(),
  notes: z.string().nullable(),
  occurredAt: z.coerce.date(),
});

export const OccTestingSchemas = {
  SubjectResponse: z.strictObject({ subject: OccSubjectSchema }),
  OrderResponse: z.strictObject({ order: OccOrderSchema }),
  OrderListResponse: z.strictObject({ orders: z.array(OccOrderSchema) }),
  SampleResponse: z.strictObject({ sample: OccSampleSchema }),
  CustodyEventResponse: z.strictObject({ event: OccCustodyEventSchema }),
  OkResponse: z.strictObject({ ok: z.literal(true) }),
  OrderDetailResponse: z.strictObject({
    order: OccOrderSchema,
    subject: OccSubjectSchema,
    samples: z.array(OccSampleSchema),
    custodyEvents: z.array(OccCustodyEventSchema),
  }),
};

export type OccSubject = z.infer<typeof OccSubjectSchema>;
export type OccOrder = z.infer<typeof OccOrderSchema>;
export type OccSample = z.infer<typeof OccSampleSchema>;
export type OccCustodyEvent = z.infer<typeof OccCustodyEventSchema>;
export type OccOrderStatus = z.infer<typeof occOrderStatusSchema>;
export type OccFinalResult = z.infer<typeof occFinalResultSchema>;
export type OccTestingReason = z.infer<typeof occTestingReasonSchema>;
export type OccRequestSource = z.infer<typeof occRequestSourceSchema>;
export type OccRegulatoryBasis = z.infer<typeof occRegulatoryBasisSchema>;
export type OccMandateType = z.infer<typeof occMandateTypeSchema>;
export type OccSampleKind = z.infer<typeof occSampleKindSchema>;
export type OccMatrix = z.infer<typeof occMatrixSchema>;
export type OccCustodyAction = z.infer<typeof occCustodyActionSchema>;

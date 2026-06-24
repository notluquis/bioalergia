import { oc } from "@orpc/contract";
import { z } from "zod";

// Registro de Actividades de Tratamiento (RAT) — Ley 21.719. Inventario de
// cada actividad de tratamiento de datos personales: finalidad, base de
// licitud, categorías de datos/titulares, destinatarios, plazo de
// conservación, medidas de seguridad y transferencia internacional.
export const processingActivityLegalBasisSchema = z.enum([
  "CONSENT",
  "CONTRACT",
  "LEGAL_OBLIGATION",
  "VITAL_INTEREST",
  "LEGITIMATE_INTEREST",
  "HEALTH_CARE",
]);

export const processingActivitySchema = z.object({
  id: z.string(),
  name: z.string(),
  purpose: z.string(),
  legalBasis: processingActivityLegalBasisSchema,
  dataCategories: z.string(),
  dataSubjects: z.string(),
  recipients: z.string().nullable(),
  retentionPeriod: z.string().nullable(),
  securityMeasures: z.string().nullable(),
  internationalTransfer: z.boolean(),
  isActive: z.boolean(),
  notes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const processingActivitiesListResponseSchema = z.object({
  activities: z.array(processingActivitySchema),
});

export const upsertProcessingActivityInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  purpose: z.string().min(1),
  legalBasis: processingActivityLegalBasisSchema,
  dataCategories: z.string().min(1),
  dataSubjects: z.string().min(1),
  recipients: z.string().optional(),
  retentionPeriod: z.string().optional(),
  securityMeasures: z.string().optional(),
  internationalTransfer: z.boolean(),
  isActive: z.boolean(),
  notes: z.string().optional(),
});

export const processingActivityIdInputSchema = z.object({ id: z.string().min(1) });

export const processingActivityStatusResponseSchema = z.object({
  status: z.string(),
});

export const processingActivitiesContract = {
  list: oc
    .route({ method: "GET", path: "/activities" })
    .output(processingActivitiesListResponseSchema),
  upsert: oc
    .route({ method: "POST", path: "/activities" })
    .input(upsertProcessingActivityInputSchema)
    .output(processingActivitySchema),
  remove: oc
    .route({ method: "DELETE", path: "/activities" })
    .input(processingActivityIdInputSchema)
    .output(processingActivityStatusResponseSchema),
};

export type ProcessingActivitiesContract = typeof processingActivitiesContract;
export type ProcessingActivityDto = z.infer<typeof processingActivitySchema>;
export type ProcessingActivityLegalBasis = z.infer<typeof processingActivityLegalBasisSchema>;
export type UpsertProcessingActivityInput = z.infer<typeof upsertProcessingActivityInputSchema>;

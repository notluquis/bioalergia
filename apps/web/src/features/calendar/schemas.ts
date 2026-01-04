import { z } from "zod";

// Note: CATEGORY_CHOICES and TREATMENT_STAGE_CHOICES are fetched from
// /api/calendar/classification-options (single source of truth in parsers.ts)

export const classificationSchema = z.object({
  category: z.string().optional().nullable(),
  amountExpected: z.string().optional().nullable(),
  amountPaid: z.string().optional().nullable(),
  attended: z.boolean(),
  dosage: z.string().optional().nullable(),
  treatmentStage: z.string().optional().nullable(),
});

export const classificationArraySchema = z.object({
  entries: z.array(classificationSchema),
});

export type FormValues = z.infer<typeof classificationArraySchema>;

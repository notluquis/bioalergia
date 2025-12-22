import { z } from "zod";

export const CATEGORY_CHOICES = ["Tratamiento subcutáneo"];
export const TREATMENT_STAGE_CHOICES = ["Mantención", "Inducción"];

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

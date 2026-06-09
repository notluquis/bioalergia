import { oc } from "@orpc/contract";
import { z } from "zod";

export const medicationSearchInputSchema = z.object({
  limit: z.number().int().min(1).max(50).optional(),
  q: z.string().min(1).max(120),
});

export const medicationResultSchema = z.object({
  activeIngredient: z.string().nullable().optional(),
  form: z.string().nullable().optional(),
  genericName: z.string().nullable().optional(),
  id: z.string(),
  laboratory: z.string().nullable().optional(),
  name: z.string(),
  presentation: z.string().nullable().optional(),
});

export const medicationSearchResponseSchema = z.object({
  results: z.array(medicationResultSchema),
});

export const medicationsContract = {
  search: oc
    .route({ method: "GET", path: "/search" })
    .input(medicationSearchInputSchema)
    .output(medicationSearchResponseSchema),
};

export type MedicationsContract = typeof medicationsContract;
export type MedicationResult = z.infer<typeof medicationResultSchema>;

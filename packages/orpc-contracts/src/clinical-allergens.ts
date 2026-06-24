import { oc } from "@orpc/contract";
import { z } from "zod";

/**
 * Catálogo clínico de alérgenos (`ClinicalAllergen`) — CRUD admin. La data base
 * (239 filas) viene del seed `lista_alergenos.xlsx`. El `id` es String (slug/uuid).
 * `deactivateAllergen` hace soft-delete (`isActive=false`) porque las filas están
 * referenciadas por `ExamReportReaction` (FK) — no se hace hard delete.
 */

export const allergenIdInputSchema = z.object({ id: z.string() });
export const allergenOkResponseSchema = z.object({ ok: z.literal(true) });

export const clinicalAllergenAliasSchema = z.object({
  id: z.string(),
  alias: z.string(),
  aliasType: z.string(),
});

export const clinicalAllergenSchema = z.object({
  id: z.string(),
  scientificName: z.string().nullable(),
  commonName: z.string(),
  englishName: z.string().nullable(),
  category: z.string(),
  categoryEn: z.string().nullable(),
  pollenType: z.string().nullable(),
  pollenTypeEn: z.string().nullable(),
  tags: z.array(z.string()),
  isActive: z.boolean(),
  aliases: z.array(clinicalAllergenAliasSchema),
});

export const clinicalAllergenAliasInputSchema = z.object({
  alias: z.string().min(1),
  aliasType: z.string().default("MANUAL"),
});

export const createClinicalAllergenInputSchema = z.object({
  scientificName: z.string().nullable().optional(),
  commonName: z.string().min(1),
  englishName: z.string().nullable().optional(),
  category: z.string().min(1),
  categoryEn: z.string().nullable().optional(),
  pollenType: z.string().nullable().optional(),
  pollenTypeEn: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  aliases: z.array(clinicalAllergenAliasInputSchema).optional(),
});

export const updateClinicalAllergenInputSchema = createClinicalAllergenInputSchema
  .partial()
  .extend({ id: z.string() });

export const clinicalAllergenListInputSchema = z
  .object({
    q: z.string().optional(),
    category: z.string().optional(),
    includeInactive: z.boolean().optional(),
  })
  .optional();

export const clinicalAllergenListResponseSchema = z.object({
  allergens: z.array(clinicalAllergenSchema),
});
export const clinicalAllergenResponseSchema = z.object({ allergen: clinicalAllergenSchema });

export const clinicalAllergensContract = {
  listAllergens: oc
    .route({ method: "GET", path: "/allergens" })
    .input(clinicalAllergenListInputSchema)
    .output(clinicalAllergenListResponseSchema),
  getAllergen: oc
    .route({ method: "GET", path: "/allergens/{id}" })
    .input(allergenIdInputSchema)
    .output(clinicalAllergenResponseSchema),
  createAllergen: oc
    .route({ method: "POST", path: "/allergens" })
    .input(createClinicalAllergenInputSchema)
    .output(clinicalAllergenResponseSchema),
  updateAllergen: oc
    .route({ method: "POST", path: "/allergens/{id}/update" })
    .input(updateClinicalAllergenInputSchema)
    .output(clinicalAllergenResponseSchema),
  deactivateAllergen: oc
    .route({ method: "POST", path: "/allergens/{id}/deactivate" })
    .input(allergenIdInputSchema)
    .output(clinicalAllergenResponseSchema),
};

export type ClinicalAllergensContract = typeof clinicalAllergensContract;
export type ClinicalAllergenDto = z.infer<typeof clinicalAllergenSchema>;
export type CreateClinicalAllergenInput = z.infer<typeof createClinicalAllergenInputSchema>;
export type UpdateClinicalAllergenInput = z.infer<typeof updateClinicalAllergenInputSchema>;

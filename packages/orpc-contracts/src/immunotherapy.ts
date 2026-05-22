import { oc } from "@orpc/contract";
import { z } from "zod";

/**
 * Inmunoterapia subcutánea (ITA) — presupuesto anual al paciente.
 *
 * El cobro es por DOSIS, con etapas configurables POR PRODUCTO
 * (Clustoid/Roxall, Alxoid, …), 100% editables desde DB (sin precios
 * hardcodeados). Cada producto define:
 *   - etapas de inicio (dosis escalonadas, cantidad fija) +
 *   - una etapa de mantención (cantidad anual por defecto, precio base a
 *     `maintenanceTargetMl`, ajustable proporcional por `maintenanceStepMl`).
 *
 * El presupuesto se persiste reusando el modelo `Budget` (ligado al
 * paciente); el desglose va en `Budget.notes` (JSON) + se imprime en el PDF.
 * El vial (costo interno) NO se cobra al paciente y no se modela aquí.
 */

export const vaccineProductSchema = z.enum([
  "CLUSTOID",
  "CLUSTOID_FORTE",
  "CLUSTOID_B120",
  "ALXOID",
  "ORAL_TEC",
]);

// ── Dose stage ───────────────────────────────────────────────────────
export const doseStageSchema = z.object({
  id: z.number().int(),
  productId: z.number().int(),
  label: z.string(),
  unitPrice: z.number(),
  defaultQty: z.number().int(),
  isMaintenance: z.boolean(),
  sortOrder: z.number().int(),
});

export const doseStageInputSchema = z.object({
  label: z.string().min(1),
  unitPrice: z.number().min(0),
  defaultQty: z.number().int().min(1),
  isMaintenance: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
});

// ── Product ──────────────────────────────────────────────────────────
export const productSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  lab: z.string().nullable(),
  vaccineProduct: vaccineProductSchema.nullable(),
  concentrationUtMl: z.number().int().nullable(),
  perAllergen: z.boolean(),
  maxAllergens: z.number().int().nullable(),
  maintenanceTargetMl: z.number(),
  maintenanceStepMl: z.number(),
  maintenanceDefaultQty: z.number().int(),
  defaultDiscountPct: z.number().nullable(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
  stages: z.array(doseStageSchema),
});

export const createProductInputSchema = z.object({
  name: z.string().min(1),
  lab: z.string().nullable().optional(),
  vaccineProduct: vaccineProductSchema.nullable().optional(),
  concentrationUtMl: z.number().int().min(0).nullable().optional(),
  perAllergen: z.boolean().default(false),
  maxAllergens: z.number().int().min(1).nullable().optional(),
  maintenanceTargetMl: z.number().min(0).default(0.5),
  maintenanceStepMl: z.number().min(0).default(0.25),
  maintenanceDefaultQty: z.number().int().min(0).default(11),
  defaultDiscountPct: z.number().min(0).max(100).nullable().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
  stages: z.array(doseStageInputSchema).min(1),
});

export const updateProductInputSchema = createProductInputSchema.partial().extend({
  id: z.number().int(),
});

export const idInputSchema = z.object({ id: z.number().int() });

export const productListResponseSchema = z.object({ products: z.array(productSchema) });
export const productResponseSchema = z.object({ product: productSchema });
export const okResponseSchema = z.object({ ok: z.literal(true) });

// ── Allergen catalog (lite, for the picker) ──────────────────────────
export const allergenLiteSchema = z.object({
  id: z.string(),
  commonName: z.string(),
  scientificName: z.string().nullable(),
});
export const allergenListResponseSchema = z.object({
  allergens: z.array(allergenLiteSchema),
});
export const allergenListInputSchema = z
  .object({ q: z.string().optional() })
  .optional();

// ── Quote / budget ───────────────────────────────────────────────────
// Secciones del PDF que se pueden ocultar (el total siempre se muestra).
export const hideableSectionSchema = z.enum([
  "intro",
  "allergens",
  "concentration",
  "lab",
  "prices", // columnas precio unitario + subtotal
  "breakdown", // tabla de dosis completa
  "discount",
  "maintenanceMl",
  "terms",
  "patientRut",
  "signatures",
]);
export type HideableSection = z.infer<typeof hideableSectionSchema>;

// Override puntual de una etapa para una cotización (qty y/o precio).
export const stageOverrideSchema = z.object({
  stageId: z.number().int(),
  qty: z.number().int().min(0).optional(),
  unitPrice: z.number().min(0).optional(),
});

export const quoteInputSchema = z.object({
  productId: z.number().int(),
  // Volumen de la dosis de mantención (mL). Si se omite usa el target del
  // producto; el precio de la etapa de mantención se ajusta proporcional.
  maintenanceMl: z.number().min(0).optional(),
  // Cantidad de dosis de mantención al año (override del default del producto).
  maintenanceQty: z.number().int().min(0).optional(),
  stageOverrides: z.array(stageOverrideSchema).optional(),
  // Porcentaje de descuento; si se omite usa defaultDiscountPct del producto.
  discountPct: z.number().min(0).max(100).optional(),
  allergenIds: z.array(z.string()).optional(),
  // Secciones a OCULTAR en el PDF (los datos se siguen calculando/guardando).
  hiddenSections: z.array(hideableSectionSchema).optional(),
});

export const quoteLineSchema = z.object({
  stageId: z.number().int().nullable(),
  label: z.string(),
  quantity: z.number().int(),
  unitPrice: z.number(),
  subtotal: z.number(),
  isMaintenance: z.boolean(),
});

export const quoteResultSchema = z.object({
  productId: z.number().int(),
  productName: z.string(),
  concentrationUtMl: z.number().int().nullable(),
  perAllergen: z.boolean(),
  maintenanceMl: z.number(),
  lines: z.array(quoteLineSchema),
  subtotal: z.number(),
  discountPct: z.number(),
  discountAmount: z.number(),
  total: z.number(),
  allergens: z.array(allergenLiteSchema),
  hiddenSections: z.array(hideableSectionSchema),
});

export const createBudgetInputSchema = quoteInputSchema.extend({
  patientId: z.number().int(),
  title: z.string().min(1).optional(),
  // Datos para interpolar la plantilla de introducción del PDF.
  parentName: z.string().optional(),
  diagnosis: z.string().optional(),
});

export const budgetCreatedResponseSchema = z.object({
  budgetId: z.number().int(),
  quote: quoteResultSchema,
  status: z.literal("ok"),
});

// ── Términos / prestador (ClinicSettings singleton) ──────────────────
export const clinicTermsSchema = z.object({
  legalName: z.string().nullable(),
  legalRut: z.string().nullable(),
  immunoBudgetTerms: z.string().nullable(),
  immunoBudgetIntro: z.string().nullable(),
});
export const updateClinicTermsInputSchema = z.object({
  legalName: z.string().nullable().optional(),
  legalRut: z.string().nullable().optional(),
  immunoBudgetTerms: z.string().nullable().optional(),
  immunoBudgetIntro: z.string().nullable().optional(),
});

// ── Contract ─────────────────────────────────────────────────────────
export const immunotherapyContract = {
  // Productos (catálogo editable)
  listProducts: oc
    .route({ method: "GET", path: "/products" })
    .output(productListResponseSchema),
  createProduct: oc
    .route({ method: "POST", path: "/products" })
    .input(createProductInputSchema)
    .output(productResponseSchema),
  updateProduct: oc
    .route({ method: "POST", path: "/products/{id}/update" })
    .input(updateProductInputSchema)
    .output(productResponseSchema),
  deleteProduct: oc
    .route({ method: "DELETE", path: "/products/{id}" })
    .input(idInputSchema)
    .output(okResponseSchema),
  // Catálogo de alérgenos
  listAllergens: oc
    .route({ method: "GET", path: "/allergens" })
    .input(allergenListInputSchema)
    .output(allergenListResponseSchema),
  // Cotización
  quote: oc
    .route({ method: "POST", path: "/quote" })
    .input(quoteInputSchema)
    .output(quoteResultSchema),
  createBudget: oc
    .route({ method: "POST", path: "/budgets" })
    .input(createBudgetInputSchema)
    .output(budgetCreatedResponseSchema),
  generatePdf: oc
    .route({ method: "POST", path: "/pdf" })
    .input(createBudgetInputSchema)
    .output(z.file()),
  // Términos económicos + prestador (editable, singleton)
  getTerms: oc.route({ method: "GET", path: "/terms" }).output(clinicTermsSchema),
  updateTerms: oc
    .route({ method: "POST", path: "/terms/update" })
    .input(updateClinicTermsInputSchema)
    .output(clinicTermsSchema),
};

export type ImmunotherapyContract = typeof immunotherapyContract;
export type QuoteInput = z.infer<typeof quoteInputSchema>;
export type QuoteResult = z.infer<typeof quoteResultSchema>;
export type CreateBudgetInput = z.infer<typeof createBudgetInputSchema>;
export type ProductDto = z.infer<typeof productSchema>;
export type CreateProductInput = z.infer<typeof createProductInputSchema>;
export type UpdateProductInput = z.infer<typeof updateProductInputSchema>;

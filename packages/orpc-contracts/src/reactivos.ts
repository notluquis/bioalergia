import { oc } from "@orpc/contract";
import { z } from "zod";

/**
 * Reactivos — superficie PÚBLICA de venta a empresas (vitrina + captación de
 * leads) + bandeja de leads para staff.
 *
 * El catálogo administrativo de reactivos es `QuoteProduct` (ver `quotes.ts`);
 * acá sólo se expone la VITRINA pública, que **omite el precio** (`unitPrice`
 * nunca sale del API). La vitrina lee `QuoteProduct` con `publishedOnSite=true`.
 * `createLead` es público (sin auth, rate-limitado + honeypot); `listLeads` /
 * `updateLeadStatus` requieren permiso sobre el subject `ReactivoLead`.
 */

// ── Vitrina pública (SIN precio) ─────────────────────────────────────
export const reactivoVitrinaAllergenSchema = z.object({
  id: z.string(),
  commonName: z.string(),
  scientificName: z.string().nullable(),
  category: z.string(),
});

export const reactivoVitrinaItemSchema = z.object({
  id: z.number().int(),
  slug: z.string().nullable(),
  code: z.string().nullable(),
  brand: z.string().nullable(),
  category: z.string().nullable(),
  name: z.string(),
  format: z.string().nullable(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  allergen: reactivoVitrinaAllergenSchema.nullable(),
});

export const reactivoVitrinaResponseSchema = z.object({
  items: z.array(reactivoVitrinaItemSchema),
});

// ── Lead público ("Quiero reactivos") ────────────────────────────────
export const createReactivoLeadInputSchema = z.object({
  empresa: z.string().min(1).max(200),
  contactName: z.string().min(1).max(120),
  email: z.string().email().max(160),
  phone: z.string().max(40).nullable().optional(),
  rut: z.string().max(20).nullable().optional(),
  message: z.string().max(2000).nullable().optional(),
  productsOfInterest: z.array(z.string().max(200)).max(50).default([]),
  // Honeypot — debe venir vacío. Los bots lo llenan → se descarta silencioso.
  website: z.string().max(0).optional(),
});

export const createReactivoLeadResponseSchema = z.object({
  ok: z.literal(true),
  id: z.number().int(),
});

// ── Bandeja de leads (staff) ─────────────────────────────────────────
export const reactivoLeadStatusSchema = z.enum(["NUEVO", "CONTACTADO", "COTIZADO", "CERRADO"]);

export const reactivoLeadSchema = z.object({
  id: z.number().int(),
  empresa: z.string(),
  contactName: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  rut: z.string().nullable(),
  message: z.string().nullable(),
  productsOfInterest: z.array(z.string()),
  status: reactivoLeadStatusSchema,
  source: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const reactivoLeadListResponseSchema = z.object({
  leads: z.array(reactivoLeadSchema),
});
export const reactivoLeadResponseSchema = z.object({ lead: reactivoLeadSchema });
export const updateReactivoLeadStatusInputSchema = z.object({
  id: z.number().int(),
  status: reactivoLeadStatusSchema,
});

// ── Contract ─────────────────────────────────────────────────────────
export const reactivosContract = {
  // Público
  listVitrina: oc.route({ method: "GET", path: "/vitrina" }).output(reactivoVitrinaResponseSchema),
  createLead: oc
    .route({ method: "POST", path: "/leads" })
    .input(createReactivoLeadInputSchema)
    .output(createReactivoLeadResponseSchema),
  // Staff
  listLeads: oc.route({ method: "GET", path: "/leads" }).output(reactivoLeadListResponseSchema),
  updateLeadStatus: oc
    .route({ method: "POST", path: "/leads/{id}/status" })
    .input(updateReactivoLeadStatusInputSchema)
    .output(reactivoLeadResponseSchema),
};

export type ReactivosContract = typeof reactivosContract;
export type ReactivoVitrinaItemDto = z.infer<typeof reactivoVitrinaItemSchema>;
export type CreateReactivoLeadInput = z.infer<typeof createReactivoLeadInputSchema>;
export type ReactivoLeadDto = z.infer<typeof reactivoLeadSchema>;
export type ReactivoLeadStatus = z.infer<typeof reactivoLeadStatusSchema>;
export type UpdateReactivoLeadStatusInput = z.infer<typeof updateReactivoLeadStatusInputSchema>;

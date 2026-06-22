import { oc } from "@orpc/contract";
import { z } from "zod";

/**
 * Salud ocupacional (P7 stage-A) — captación de leads B2B de testeo de
 * drogas/alcohol + reactivos. `createLead` es público (sin auth, honeypot +
 * ratelimit); `listLeads`/`updateLeadStatus` requieren permiso sobre
 * `OccupationalLead`. El motor de testeo/cadena-de-custodia/confirmatorio
 * (stage-B) está bloqueado por revisión legal — no se modela aquí.
 */

export const occupationalSectorSchema = z.enum([
  "MINERIA",
  "TRANSPORTE",
  "CONSTRUCCION",
  "GENERAL",
  "OTRO",
]);

export const occupationalLeadStatusSchema = z.enum([
  "NUEVO",
  "CONTACTADO",
  "COTIZADO",
  "CERRADO",
]);

// ── Lead público ─────────────────────────────────────────────────────
export const createOccupationalLeadInputSchema = z.object({
  empresa: z.string().min(1).max(200),
  contactName: z.string().min(1).max(120),
  email: z.string().email().max(160),
  phone: z.string().max(40).nullable().optional(),
  rut: z.string().max(20).nullable().optional(),
  sector: occupationalSectorSchema.default("GENERAL"),
  headcount: z.number().int().min(1).max(1_000_000).nullable().optional(),
  message: z.string().max(2000).nullable().optional(),
  // Honeypot — debe venir vacío.
  website: z.string().max(0).optional(),
});

export const createOccupationalLeadResponseSchema = z.object({
  ok: z.literal(true),
  id: z.number().int(),
});

// ── Bandeja de leads (staff) ─────────────────────────────────────────
export const occupationalLeadSchema = z.object({
  id: z.number().int(),
  empresa: z.string(),
  contactName: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  rut: z.string().nullable(),
  sector: occupationalSectorSchema,
  headcount: z.number().int().nullable(),
  message: z.string().nullable(),
  status: occupationalLeadStatusSchema,
  source: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const occupationalLeadListResponseSchema = z.object({
  leads: z.array(occupationalLeadSchema),
});
export const occupationalLeadResponseSchema = z.object({ lead: occupationalLeadSchema });
export const updateOccupationalLeadStatusInputSchema = z.object({
  id: z.number().int(),
  status: occupationalLeadStatusSchema,
});

// ── Contract ─────────────────────────────────────────────────────────
export const occupationalContract = {
  createLead: oc
    .route({ method: "POST", path: "/leads" })
    .input(createOccupationalLeadInputSchema)
    .output(createOccupationalLeadResponseSchema),
  listLeads: oc.route({ method: "GET", path: "/leads" }).output(occupationalLeadListResponseSchema),
  updateLeadStatus: oc
    .route({ method: "POST", path: "/leads/{id}/status" })
    .input(updateOccupationalLeadStatusInputSchema)
    .output(occupationalLeadResponseSchema),
};

export type OccupationalContract = typeof occupationalContract;
export type CreateOccupationalLeadInput = z.infer<typeof createOccupationalLeadInputSchema>;
export type OccupationalLeadDto = z.infer<typeof occupationalLeadSchema>;
export type OccupationalSector = z.infer<typeof occupationalSectorSchema>;
export type OccupationalLeadStatus = z.infer<typeof occupationalLeadStatusSchema>;
export type UpdateOccupationalLeadStatusInput = z.infer<
  typeof updateOccupationalLeadStatusInputSchema
>;

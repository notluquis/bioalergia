import { oc } from "@orpc/contract";
import { z } from "zod";

/**
 * Superficie PÚBLICA de la clínica (sitio web, sin auth). Tres familias:
 *
 *  - `priceList`: lista de precios a la vista (Ley 20.584). Lee `PriceListItem`
 *    activos y devuelve SOLO los campos públicos (sin ids internos ni flags).
 *  - `createComplaint`: formulario de reclamos del paciente (Decreto 35/2012).
 *    Persiste en el modelo `Complaint` con canal WEB; la bandeja staff vive en
 *    `complaints.ts` (/admin/compliance?tab=reclamos).
 *  - `createDataRightsRequest`: ejercicio de derechos del titular (Ley 21.719).
 *    Persiste en `DataRightsRequest`; la bandeja staff vive en `data-rights.ts`.
 *  - `createContact`: contacto general. NO persiste datos de salud; sólo notifica
 *    al equipo por correo (minimización del Art. ... Ley 21.719).
 *
 * Todos los `create*` son públicos: honeypot `website` (debe venir vacío; si un
 * bot lo llena, se descarta en silencio) + consentimiento explícito donde aplica.
 */

// ── Lista de precios pública (a la vista, Ley 20.584) ────────────────
export const publicPriceItemSchema = z.object({
  name: z.string(),
  category: z.string(),
  unit: z.string(),
  priceClp: z.number().int(),
  notes: z.string().nullable(),
});

export const publicPriceListResponseSchema = z.object({
  items: z.array(publicPriceItemSchema),
  /** Fecha de la última actualización de cualquier ítem activo (ISO o null). */
  updatedAt: z.coerce.date().nullable(),
});

// ── Reclamo público (Decreto 35/2012, Ley 20.584) ────────────────────
export const createPublicComplaintInputSchema = z.object({
  complainantName: z.string().min(1).max(160),
  complainantRut: z.string().max(20).nullable().optional(),
  contact: z.string().min(1).max(200),
  category: z.string().max(120).nullable().optional(),
  description: z.string().min(1).max(4000),
  // Honeypot — debe venir vacío.
  website: z.string().max(0).optional(),
});

// ── Ejercicio de derechos del titular (Ley 21.719) ───────────────────
export const publicDataRightsTypeSchema = z.enum([
  "ACCESS",
  "RECTIFICATION",
  "DELETION",
  "PORTABILITY",
  "OPPOSITION",
  "BLOCKING",
]);

export const createPublicDataRightsInputSchema = z.object({
  type: publicDataRightsTypeSchema,
  requesterName: z.string().min(1).max(160),
  requesterRut: z.string().max(20).nullable().optional(),
  requesterEmail: z.string().email().max(200),
  notes: z.string().max(4000).nullable().optional(),
  // Honeypot — debe venir vacío.
  website: z.string().max(0).optional(),
});

// ── Contacto general (sin datos de salud) ────────────────────────────
export const createPublicContactInputSchema = z.object({
  name: z.string().min(1).max(160),
  email: z.string().email().max(200),
  phone: z.string().max(40).nullable().optional(),
  message: z.string().min(1).max(4000),
  // Consentimiento explícito al tratamiento (Ley 21.719). Debe ser true.
  consent: z.literal(true),
  // Honeypot — debe venir vacío.
  website: z.string().max(0).optional(),
});

export const publicOkResponseSchema = z.object({ ok: z.literal(true) });

// ── Contract ─────────────────────────────────────────────────────────
export const publicClinicContract = {
  priceList: oc
    .route({ method: "GET", path: "/price-list" })
    .output(publicPriceListResponseSchema),
  createComplaint: oc
    .route({ method: "POST", path: "/complaints" })
    .input(createPublicComplaintInputSchema)
    .output(publicOkResponseSchema),
  createDataRightsRequest: oc
    .route({ method: "POST", path: "/data-rights" })
    .input(createPublicDataRightsInputSchema)
    .output(publicOkResponseSchema),
  createContact: oc
    .route({ method: "POST", path: "/contact" })
    .input(createPublicContactInputSchema)
    .output(publicOkResponseSchema),
};

export type PublicClinicContract = typeof publicClinicContract;
export type PublicPriceItemDto = z.infer<typeof publicPriceItemSchema>;
export type CreatePublicComplaintInput = z.infer<typeof createPublicComplaintInputSchema>;
export type CreatePublicDataRightsInput = z.infer<typeof createPublicDataRightsInputSchema>;
export type CreatePublicContactInput = z.infer<typeof createPublicContactInputSchema>;

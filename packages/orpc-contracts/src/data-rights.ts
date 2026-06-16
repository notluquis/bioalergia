import { oc } from "@orpc/contract";
import { z } from "zod";

// Solicitudes de derechos del titular (Ley 21.719): Acceso, Rectificación,
// Cancelación (DELETION), Portabilidad, Oposición y Bloqueo.
export const dataRightsTypeSchema = z.enum([
  "ACCESS",
  "RECTIFICATION",
  "DELETION",
  "PORTABILITY",
  "OPPOSITION",
  "BLOCKING",
]);

export const dataRightsStatusSchema = z.enum(["RECEIVED", "IN_PROGRESS", "RESOLVED", "REJECTED"]);

// Estados terminales/avanzados a los que el operador puede mover una solicitud.
export const dataRightsResolveStatusSchema = z.enum(["RESOLVED", "REJECTED", "IN_PROGRESS"]);

export const dataRightsRequestSchema = z.object({
  id: z.string(),
  type: dataRightsTypeSchema,
  status: dataRightsStatusSchema,
  requesterName: z.string(),
  requesterRut: z.string().nullable(),
  requesterEmail: z.string().nullable(),
  patientId: z.number().int().nullable(),
  receivedAt: z.date(),
  dueAt: z.date(),
  resolvedAt: z.date().nullable(),
  resolution: z.string().nullable(),
  handledBy: z.number().int().nullable(),
  notes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const dataRightsListInputSchema = z.object({
  status: dataRightsStatusSchema.optional(),
});

export const dataRightsListResponseSchema = z.object({
  requests: z.array(dataRightsRequestSchema),
});

export const dataRightsCreateInputSchema = z.object({
  type: dataRightsTypeSchema,
  requesterName: z.string().min(1),
  requesterRut: z.string().optional(),
  requesterEmail: z.string().email().optional(),
  patientId: z.number().int().optional(),
  notes: z.string().optional(),
});

export const dataRightsResolveInputSchema = z.object({
  id: z.string().min(1),
  status: dataRightsResolveStatusSchema,
  resolution: z.string().optional(),
});

export const dataRightsContract = {
  list: oc
    .route({ method: "GET", path: "/requests" })
    .input(dataRightsListInputSchema)
    .output(dataRightsListResponseSchema),
  create: oc
    .route({ method: "POST", path: "/requests" })
    .input(dataRightsCreateInputSchema)
    .output(dataRightsRequestSchema),
  resolve: oc
    .route({ method: "POST", path: "/requests/resolve" })
    .input(dataRightsResolveInputSchema)
    .output(dataRightsRequestSchema),
};

export type DataRightsContract = typeof dataRightsContract;
export type DataRightsRequestDto = z.infer<typeof dataRightsRequestSchema>;
export type DataRightsType = z.infer<typeof dataRightsTypeSchema>;
export type DataRightsStatus = z.infer<typeof dataRightsStatusSchema>;
export type DataRightsResolveStatus = z.infer<typeof dataRightsResolveStatusSchema>;
export type DataRightsCreateInput = z.infer<typeof dataRightsCreateInputSchema>;
export type DataRightsResolveInput = z.infer<typeof dataRightsResolveInputSchema>;

import { oc } from "@orpc/contract";
import { z } from "zod";

// Incidentes de brecha de datos personales (Ley 21.719): obliga a notificar a la
// Agencia de Protección de Datos + a los titulares afectados dentro de plazo.
export const breachSeveritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const breachStatusSchema = z.enum(["DETECTED", "NOTIFYING", "NOTIFIED", "CLOSED"]);

export const breachIncidentSchema = z.object({
  id: z.string(),
  detectedAt: z.date(),
  description: z.string(),
  severity: breachSeveritySchema,
  affectedData: z.string().nullable(),
  affectedCount: z.number().int().nullable(),
  status: breachStatusSchema,
  agencyNotifiedAt: z.date().nullable(),
  subjectsNotifiedAt: z.date().nullable(),
  handledBy: z.number().int().nullable(),
  notes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const breachIncidentsResponseSchema = z.object({
  incidents: z.array(breachIncidentSchema),
});

export const listBreachIncidentsInputSchema = z.object({
  status: breachStatusSchema.optional(),
});

export const createBreachIncidentInputSchema = z.object({
  // ISO string; el servicio hace new Date(detectedAt).
  detectedAt: z.string().min(1),
  description: z.string().min(1),
  severity: breachSeveritySchema.default("MEDIUM"),
  affectedData: z.string().optional(),
  affectedCount: z.number().int().min(0).optional(),
});

export const updateBreachIncidentInputSchema = z.object({
  id: z.string().min(1),
  status: breachStatusSchema.optional(),
  // ISO string o null para limpiar el campo.
  agencyNotifiedAt: z.string().nullable().optional(),
  subjectsNotifiedAt: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const breachIncidentsContract = {
  list: oc
    .route({ method: "GET", path: "/incidents" })
    .input(listBreachIncidentsInputSchema)
    .output(breachIncidentsResponseSchema),
  create: oc
    .route({ method: "POST", path: "/incidents" })
    .input(createBreachIncidentInputSchema)
    .output(breachIncidentSchema),
  update: oc
    .route({ method: "POST", path: "/incidents/update" })
    .input(updateBreachIncidentInputSchema)
    .output(breachIncidentSchema),
};

export type BreachIncidentsContract = typeof breachIncidentsContract;
export type BreachIncidentDto = z.infer<typeof breachIncidentSchema>;
export type BreachSeverity = z.infer<typeof breachSeveritySchema>;
export type BreachStatus = z.infer<typeof breachStatusSchema>;
export type CreateBreachIncidentInput = z.infer<typeof createBreachIncidentInputSchema>;
export type UpdateBreachIncidentInput = z.infer<typeof updateBreachIncidentInputSchema>;

import { oc } from "@orpc/contract";
import { z } from "zod";

/**
 * Canal de denuncia Ley Karin (Ley 21.643 + Decreto 21/2024). Recibe denuncias
 * IDENTIFICADAS de acoso laboral / sexual / violencia en el trabajo (Anexo A).
 *
 * - `createReport` es PÚBLICO (lo consume el formulario del sitio + la intranet);
 *   incluye honeypot `website` anti-bot, igual que los leads públicos.
 * - `listReports` / `resolveReport` son de STAFF: requieren el subject CASL
 *   dedicado `KarinReport` (acceso más restringido que el resto de cumplimiento).
 */

export const karinReportTypeSchema = z.enum(["ACOSO_LABORAL", "ACOSO_SEXUAL", "VIOLENCIA"]);
export const karinStatusSchema = z.enum([
  "RECIBIDA",
  "EN_RESGUARDO",
  "REMITIDA_DT",
  "EN_INVESTIGACION",
  "CERRADA",
]);

export const karinReportSchema = z.object({
  id: z.string(),
  reportType: karinReportTypeSchema,
  reporterName: z.string(),
  reporterRut: z.string().nullable(),
  reporterContact: z.string().nullable(),
  reportedPerson: z.string().nullable(),
  description: z.string(),
  occurredAt: z.date().nullable(),
  status: karinStatusSchema,
  receivedAt: z.date(),
  resguardoDueAt: z.date(),
  remitirDueAt: z.date(),
  investigationDueAt: z.date(),
  resolution: z.string().nullable(),
  handledBy: z.number().int().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const listKarinReportsInputSchema = z.object({
  status: karinStatusSchema.optional(),
});
export const karinReportsResponseSchema = z.object({
  reports: z.array(karinReportSchema),
});

// Público: la denuncia del Anexo A. Identificada (nombre obligatorio). Honeypot
// `website` debe venir vacío.
export const createKarinReportInputSchema = z.object({
  reportType: karinReportTypeSchema,
  reporterName: z.string().min(1),
  reporterRut: z.string().optional(),
  reporterContact: z.string().optional(),
  reportedPerson: z.string().optional(),
  description: z.string().min(1),
  occurredAt: z.string().optional(),
  website: z.string().optional(), // honeypot
});
export const createKarinReportResponseSchema = z.object({
  ok: z.literal(true),
  id: z.string(),
});

export const resolveKarinReportInputSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["EN_RESGUARDO", "REMITIDA_DT", "EN_INVESTIGACION", "CERRADA"]),
  resolution: z.string().optional(),
});

export const karinContract = {
  createReport: oc
    .route({ method: "POST", path: "/reports" })
    .input(createKarinReportInputSchema)
    .output(createKarinReportResponseSchema),
  listReports: oc
    .route({ method: "GET", path: "/reports" })
    .input(listKarinReportsInputSchema)
    .output(karinReportsResponseSchema),
  resolveReport: oc
    .route({ method: "POST", path: "/reports/resolve" })
    .input(resolveKarinReportInputSchema)
    .output(karinReportSchema),
};

export type KarinContract = typeof karinContract;
export type KarinReportDto = z.infer<typeof karinReportSchema>;
export type KarinReportType = z.infer<typeof karinReportTypeSchema>;
export type KarinStatus = z.infer<typeof karinStatusSchema>;
export type CreateKarinReportInput = z.infer<typeof createKarinReportInputSchema>;
export type ResolveKarinReportInput = z.infer<typeof resolveKarinReportInputSchema>;

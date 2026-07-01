import { z } from "zod";

// Local response validation (server↔client drift guard). superjson revives
// Date objects, but we coerce to be tolerant of string dates too.
export const intakeSubmissionRowSchema = z.strictObject({
  id: z.string(),
  patientName: z.string(),
  patientPhone: z.string(),
  patientRut: z.string().nullable(),
  patientEmail: z.string().nullable(),
  healthInsurance: z.enum(["FONASA", "ISAPRE", "PARTICULAR"]).nullable(),
  isapreName: z.string().nullable(),
  reason: z.string().nullable(),
  isMinor: z.boolean().nullable(),
  appointmentDate: z.coerce.date().nullable(),
  comprobanteUrl: z.string().nullable(),
  staffNotifiedAt: z.coerce.date().nullable(),
  submittedAt: z.coerce.date(),
});

export const intakeSubmissionsResponseSchema = z.strictObject({
  items: z.array(intakeSubmissionRowSchema),
  total: z.number().int().nonnegative(),
});

export type IntakeSubmissionRow = z.infer<typeof intakeSubmissionRowSchema>;

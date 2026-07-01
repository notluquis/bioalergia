import { oc } from "@orpc/contract";
import { z } from "zod";

// Read-only viewer for patient-intake submissions collected via the WhatsApp
// Flow (IntakeSubmission). Safety net: staff review these when the automatic
// staff-ficha WhatsApp forward failed (staffNotifiedAt === null) or to look up
// what a patient submitted. No mutations — the record is created by the Flow
// endpoint; staff create the Patient by hand from it.

export const intakeSubmissionListItemSchema = z.object({
  id: z.string(),
  patientName: z.string(),
  patientPhone: z.string(),
  patientRut: z.string().nullable(),
  patientEmail: z.string().nullable(),
  healthInsurance: z.enum(["FONASA", "ISAPRE", "PARTICULAR"]).nullable(),
  isapreName: z.string().nullable(),
  reason: z.string().nullable(),
  isMinor: z.boolean().nullable(),
  appointmentDate: z.date().nullable(),
  // Short-lived CDN url to the payment receipt (null when none was attached).
  comprobanteUrl: z.string().nullable(),
  staffNotifiedAt: z.date().nullable(),
  submittedAt: z.date(),
});

export const listIntakeSubmissionsInputSchema = z.object({
  page: z.number().int().min(0).default(0),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export const listIntakeSubmissionsResponseSchema = z.object({
  items: z.array(intakeSubmissionListItemSchema),
  total: z.number().int().nonnegative(),
});

export const intakeContract = {
  list: oc
    .route({ method: "POST", path: "/list" })
    .input(listIntakeSubmissionsInputSchema)
    .output(listIntakeSubmissionsResponseSchema),
};

export type IntakeContract = typeof intakeContract;
export type IntakeSubmissionListItemDto = z.infer<typeof intakeSubmissionListItemSchema>;

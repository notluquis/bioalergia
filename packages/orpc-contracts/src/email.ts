import { oc } from "@orpc/contract";
import { z } from "zod";

// Email contracts: transactional test send + patient broadcast (marketing/
// info to opted-in patients) + per-patient opt-in management. Contacts live in
// OUR DB (Person), so broadcast takes only the content — recipients are
// resolved server-side from consent.

export const emailSendResultSchema = z.object({
  id: z.string().nullable(),
  to: z.array(z.string()),
  ok: z.boolean(),
  error: z.string().optional(),
});

// --- Transactional test send (admin verifies DNS/domain works) ---
export const sendTestEmailInputSchema = z.object({
  to: z.email(),
  subject: z.string().min(1).max(200).default("Prueba Bioalergia"),
  message: z.string().min(1).max(5000).default("Correo de prueba desde el sistema."),
});

export const sendTestEmailResponseSchema = z.object({
  result: emailSendResultSchema,
});

// --- Broadcast to opted-in patients ---
export const sendBroadcastInputSchema = z.object({
  subject: z.string().min(1).max(200),
  /** HTML body. Sanitized server-side before send. */
  html: z.string().min(1).max(100_000),
  /** Optional plain-text fallback. */
  text: z.string().max(100_000).optional(),
  /** When true, resolves recipients + returns the count WITHOUT sending. */
  dryRun: z.boolean().default(false),
});

export const sendBroadcastResponseSchema = z.object({
  dryRun: z.boolean(),
  recipients: z.number().int().nonnegative(),
  sent: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
});

export const broadcastRecipientsCountResponseSchema = z.object({
  count: z.number().int().nonnegative(),
});

// --- Per-patient opt-in (toggle in the patient ficha) ---
export const patientOptInQuerySchema = z.object({
  personId: z.number().int().positive(),
});

export const setPatientOptInInputSchema = z.object({
  personId: z.number().int().positive(),
  optIn: z.boolean(),
});

export const patientOptInResponseSchema = z.object({
  personId: z.number().int().positive(),
  email: z.string().nullable(),
  optIn: z.boolean(),
  optInAt: z.date().nullable(),
  unsubscribedAt: z.date().nullable(),
});

// ── Contract ─────────────────────────────────────────────────────────────────

export const emailContract = {
  sendTest: oc
    .route({ method: "POST", path: "/test", tags: ["Email"] })
    .input(sendTestEmailInputSchema)
    .output(sendTestEmailResponseSchema),
  recipientsCount: oc
    .route({ method: "GET", path: "/broadcast/recipients", tags: ["Email"] })
    .output(broadcastRecipientsCountResponseSchema),
  sendBroadcast: oc
    .route({ method: "POST", path: "/broadcast", tags: ["Email"] })
    .input(sendBroadcastInputSchema)
    .output(sendBroadcastResponseSchema),
  getPatientOptIn: oc
    .route({ method: "GET", path: "/opt-in", tags: ["Email"] })
    .input(patientOptInQuerySchema)
    .output(patientOptInResponseSchema),
  setPatientOptIn: oc
    .route({ method: "POST", path: "/opt-in", tags: ["Email"] })
    .input(setPatientOptInInputSchema)
    .output(patientOptInResponseSchema),
};

export type EmailContract = typeof emailContract;
export type EmailSendResultDTO = z.infer<typeof emailSendResultSchema>;
export type SendBroadcastInput = z.infer<typeof sendBroadcastInputSchema>;
export type SendTestEmailInput = z.infer<typeof sendTestEmailInputSchema>;
export type PatientOptInResponse = z.infer<typeof patientOptInResponseSchema>;

import { oc } from "@orpc/contract";
import { z } from "zod";

/**
 * Adherencia (shared-reminder, P2) — recordatorios de visita SCIT/SLIT por
 * paciente. Todo staff (auth + permiso sobre ImmunotherapyAdministration). El
 * envío es consent-gated en el service (ConsentRecord purpose ADHERENCE_REMINDER).
 */

export const reminderChannelSchema = z.enum(["EMAIL", "WHATSAPP"]);
export const reminderStatusSchema = z.enum(["PENDING", "SENT", "CANCELLED", "FAILED"]);

export const reminderSchema = z.object({
  id: z.number().int(),
  patientId: z.number().int(),
  channel: reminderChannelSchema,
  subjectType: z.string(),
  title: z.string(),
  body: z.string(),
  runAt: z.coerce.date(),
  status: reminderStatusSchema,
  sentAt: z.coerce.date().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.coerce.date(),
});

export const scheduleVisitRemindersInputSchema = z.object({
  patientId: z.number().int(),
  visitAt: z.date(),
  channel: reminderChannelSchema.optional(),
});

export const scheduleReminderInputSchema = z.object({
  patientId: z.number().int(),
  channel: reminderChannelSchema.optional(),
  subjectType: z.string().min(1).max(40).default("OTHER"),
  title: z.string().min(1).max(160),
  body: z.string().min(1).max(2000),
  runAt: z.date(),
});

export const listRemindersInputSchema = z.object({ patientId: z.number().int() });
export const cancelReminderInputSchema = z.object({ id: z.number().int() });

export const reminderListResponseSchema = z.object({ reminders: z.array(reminderSchema) });
export const reminderResponseSchema = z.object({ reminder: reminderSchema });
export const reminderBatchResponseSchema = z.object({ reminders: z.array(reminderSchema) });

export const adherenceContract = {
  scheduleVisitReminders: oc
    .route({ method: "POST", path: "/visit-reminders" })
    .input(scheduleVisitRemindersInputSchema)
    .output(reminderBatchResponseSchema),
  scheduleReminder: oc
    .route({ method: "POST", path: "/reminders" })
    .input(scheduleReminderInputSchema)
    .output(reminderResponseSchema),
  listReminders: oc
    .route({ method: "POST", path: "/reminders/list" })
    .input(listRemindersInputSchema)
    .output(reminderListResponseSchema),
  cancelReminder: oc
    .route({ method: "POST", path: "/reminders/{id}/cancel" })
    .input(cancelReminderInputSchema)
    .output(reminderResponseSchema),
};

export type AdherenceContract = typeof adherenceContract;
export type ReminderDto = z.infer<typeof reminderSchema>;
export type ReminderChannelDto = z.infer<typeof reminderChannelSchema>;
export type ScheduleVisitRemindersInput = z.infer<typeof scheduleVisitRemindersInputSchema>;
export type ScheduleReminderInput = z.infer<typeof scheduleReminderInputSchema>;

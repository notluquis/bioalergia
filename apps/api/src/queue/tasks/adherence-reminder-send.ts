// graphile-worker task: envía un recordatorio de adherencia en su `runAt`.
// Encolado por `scheduleReminder` (jobKey adherence_reminder_<id>, replace).
// Consent-gated dentro del service; no-op si ya no está PENDING.

import type { Task } from "graphile-worker";
import { z } from "zod";
import { logEvent, logWarn } from "../../lib/logger.ts";
import { sendReminder } from "../../services/adherence-reminders.ts";

const payloadSchema = z.object({ reminderScheduleId: z.number().int().positive() });

export const adherence_reminder_send: Task = async (payload) => {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) {
    logWarn("queue.adherence_reminder.invalid_payload", { error: parsed.error.message });
    return;
  }
  const res = await sendReminder(parsed.data.reminderScheduleId);
  logEvent("queue.adherence_reminder_send", {
    reminderScheduleId: parsed.data.reminderScheduleId,
    ...res,
  });
};

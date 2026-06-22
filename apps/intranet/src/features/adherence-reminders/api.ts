import type { ReminderChannelDto } from "@finanzas/orpc-contracts/adherence";
import { adherenceORPCClient, toAdherenceApiError } from "./orpc";

// ── Query keys ────────────────────────────────────────────────────────
export const adherenceKeys = {
  all: ["adherence-reminders"] as const,
  list: (patientId: number) => [...adherenceKeys.all, "list", patientId] as const,
};

// ── Wrappers ──────────────────────────────────────────────────────────
export async function listReminders(patientId: number) {
  try {
    const res = await adherenceORPCClient.listReminders({ patientId });
    return res.reminders;
  } catch (error) {
    throw toAdherenceApiError(error);
  }
}

export async function scheduleVisitReminders(input: {
  patientId: number;
  visitAt: Date;
  channel?: ReminderChannelDto;
}) {
  try {
    const res = await adherenceORPCClient.scheduleVisitReminders(input);
    return res.reminders;
  } catch (error) {
    throw toAdherenceApiError(error);
  }
}

export async function cancelReminder(id: number) {
  try {
    const res = await adherenceORPCClient.cancelReminder({ id });
    return res.reminder;
  } catch (error) {
    throw toAdherenceApiError(error);
  }
}

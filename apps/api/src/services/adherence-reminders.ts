// shared-reminder (P2) — motor de recordatorios de adherencia por paciente.
//
// Cada recordatorio = una fila `ReminderSchedule` que se envía en `runAt` vía
// graphile-worker (task `adherence_reminder_send`). El envío es CONSENT-GATED:
// requiere un ConsentRecord (purpose ADHERENCE_REMINDER, status GRANTED) —
// distinto del consentimiento de marketing. Texto NEUTRO (sin diagnóstico) +
// opt-out por respuesta al correo (no toca el unsubscribe de marketing).
//
// Canal EMAIL operativo. WHATSAPP proactivo requiere una plantilla aprobada por
// Meta → diferido (lanza BAD_REQUEST hasta que se configure).

import { db } from "@finanzas/db";
import type { ReminderChannel } from "@finanzas/db";
import { DomainError } from "../lib/errors.ts";
import { logError, logEvent } from "../lib/logger.ts";
import { sendEmail } from "./email/index.ts";

export function reminderJobKey(id: number): string {
  return `adherence_reminder_${id}`;
}

/** ¿El paciente consintió recordatorios de adherencia (vigente)? */
async function hasAdherenceConsent(personId: number): Promise<boolean> {
  const consent = await db.consentRecord.findFirst({
    where: { personId, purpose: "ADHERENCE_REMINDER", status: "GRANTED", withdrawnAt: null },
  });
  return consent != null;
}

type ScheduleReminderInput = {
  patientId: number;
  channel?: ReminderChannel;
  subjectType: string;
  title: string;
  body: string;
  runAt: Date;
  createdBy?: number | null;
};

/**
 * Crea un recordatorio (fila PENDING). El ENCOLADO en graphile-worker lo hace el
 * handler oRPC (la capa `queue` está por encima de `services` en el DAG, así que
 * el service no la importa — mismo patrón que wa-scheduled).
 */
export async function scheduleReminder(input: ScheduleReminderInput) {
  const reminder = await db.reminderSchedule.create({
    data: {
      patientId: input.patientId,
      channel: input.channel ?? "EMAIL",
      subjectType: input.subjectType,
      title: input.title,
      body: input.body,
      runAt: input.runAt,
      createdBy: input.createdBy ?? null,
    },
  });
  logEvent("[adherence] reminder scheduled", { id: reminder.id, patientId: input.patientId });
  return reminder;
}

/**
 * Programa recordatorios T-7 y T-1 para la próxima visita de inmunoterapia.
 * Omite los offsets que ya quedaron en el pasado.
 */
export async function scheduleVisitReminders(input: {
  patientId: number;
  visitAt: Date;
  channel?: ReminderChannel;
  createdBy?: number | null;
}) {
  const visitLabel = new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(input.visitAt);

  const created = [];
  for (const days of [7, 1]) {
    const runAt = new Date(input.visitAt.getTime() - days * 86_400_000);
    if (runAt.getTime() <= Date.now()) continue;
    created.push(
      await scheduleReminder({
        patientId: input.patientId,
        channel: input.channel,
        subjectType: "SCIT_VISIT",
        title: "Recordatorio de tu próxima atención",
        body: `Te recordamos tu próxima atención el ${visitLabel}. Si necesitas reagendar, contáctanos respondiendo este mensaje.`,
        runAt,
        createdBy: input.createdBy,
      })
    );
  }
  return created;
}

type ReminderRow = NonNullable<Awaited<ReturnType<typeof db.reminderSchedule.findUnique>>>;

export function serializeReminder(r: ReminderRow) {
  return {
    id: r.id,
    patientId: r.patientId,
    channel: r.channel,
    subjectType: r.subjectType,
    title: r.title,
    body: r.body,
    runAt: r.runAt,
    status: r.status,
    sentAt: r.sentAt,
    errorMessage: r.errorMessage,
    createdAt: r.createdAt,
  };
}

/** Envía un recordatorio (llamado por el task). Consent-gated + idempotente. */
export async function sendReminder(id: number): Promise<{ status: string }> {
  const reminder = await db.reminderSchedule.findUnique({
    where: { id },
    include: { patient: { include: { person: true } } },
  });
  if (!reminder) return { status: "NOT_FOUND" };
  if (reminder.status !== "PENDING") return { status: "SKIPPED" };

  const person = reminder.patient.person;

  if (!(await hasAdherenceConsent(person.id))) {
    await db.reminderSchedule.update({
      where: { id },
      data: { status: "CANCELLED", errorMessage: "Sin consentimiento ADHERENCE_REMINDER" },
    });
    return { status: "NO_CONSENT" };
  }

  try {
    if (reminder.channel === "EMAIL") {
      if (!person.email) throw new DomainError("BAD_REQUEST", "Paciente sin email");
      const optOut = "Para dejar de recibir estos recordatorios, responde a este correo.";
      await sendEmail({
        to: person.email,
        subject: reminder.title,
        text: `${reminder.body}\n\n${optOut}`,
        html: `<p>${reminder.body}</p><p style="color:#888;font-size:12px">${optOut}</p>`,
        headers: {
          "List-Unsubscribe": "<mailto:contacto@bioalergia.cl?subject=Baja%20recordatorios>",
        },
      });
    } else {
      // WhatsApp proactivo requiere plantilla aprobada por Meta (no configurada).
      throw new DomainError(
        "BAD_REQUEST",
        "Canal WhatsApp aún no configurado (requiere plantilla)"
      );
    }

    await db.reminderSchedule.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date() },
    });
    logEvent("[adherence] reminder sent", { id, channel: reminder.channel });
    return { status: "SENT" };
  } catch (err) {
    logError(err, { module: "api", operation: "adherence.reminder.send", reminderId: id });
    await db.reminderSchedule.update({
      where: { id },
      data: { status: "FAILED", errorMessage: err instanceof Error ? err.message : String(err) },
    });
    return { status: "FAILED" };
  }
}

export async function listReminders(patientId: number) {
  return db.reminderSchedule.findMany({
    where: { patientId },
    orderBy: { runAt: "desc" },
    take: 200,
  });
}

export async function cancelReminder(id: number) {
  const existing = await db.reminderSchedule.findUnique({ where: { id } });
  if (!existing) throw new DomainError("NOT_FOUND", "Recordatorio no encontrado");
  if (existing.status !== "PENDING") return existing;
  return db.reminderSchedule.update({ where: { id }, data: { status: "CANCELLED" } });
}

import type {
  DoctoraliaCalendarMerged,
  DoctoraliaEmailNotification,
  DoctoraliaMergedCalendarEntry,
} from "@/features/doctoralia/types";
import { toTitleCase } from "@/lib/person";

import type { CalendarEventDetail } from "../types";

/**
 * Doctoralia → generic calendar adapters.
 *
 * Maps Doctoralia merged calendar entries (appointment + matched Gmail
 * notifications) into the shared `CalendarEventDetail` shape so the unified
 * calendar grid renders them through the same clinical card + state decoding
 * as Google events. Extracted from the old CalendarSchedulePage so the
 * FullCalendar-based agenda panel can reuse it (and so the pure mapping is
 * unit-testable without the page).
 */

export function mergedEntryToCalendarEventDetail(
  entry: DoctoraliaMergedCalendarEntry
): CalendarEventDetail {
  const { appointment, emails } = entry;
  const descParts = [
    appointment.comments,
    emails.cancellation ? "⚠ Cancelado por email" : null,
    emails.modifications.length > 0
      ? `✎ Modificado (${emails.modifications.length}) por email`
      : null,
  ].filter(Boolean);
  const colorId = emails.cancellation
    ? "11"
    : emails.modifications.length > 0
      ? "5"
      : appointment.serviceColorSchemaId != null
        ? String(appointment.serviceColorSchemaId)
        : null;
  // Estado real de Doctoralia (attendance + status) → campos que entiende el
  // event-state genérico. attendance: 3=asistió, 6=no asistió; status: 1=cancelada,
  // 6=confirmada. Email de cancelación también marca no asistió.
  const isCancelled =
    appointment.status === 1 || appointment.attendance === 6 || Boolean(emails.cancellation);
  const attended = appointment.attendance === 3 ? true : isCancelled ? false : null;
  const genericStatus = isCancelled
    ? "cancelled"
    : appointment.attendance === 3 || appointment.status === 6
      ? "confirmed"
      : "needsAction";
  return {
    attended,
    calendarId: `doctoralia:${appointment.schedule.externalId}`,
    category: null,
    colorId,
    controlIncluded: null,
    description: descParts.length ? descParts.join(" · ") : null,
    endDate: appointment.endAt.toISOString().split("T")[0] ?? null,
    endDateTime: appointment.endAt.toISOString(),
    endTimeZone: null,
    eventCreatedAt: null,
    eventDate: appointment.startAt.toISOString().split("T")[0] ?? appointment.startAt.toISOString(),
    eventDateTime: appointment.startAt.toISOString(),
    eventId: String(appointment.externalId),
    eventType: "doctoralia",
    eventUpdatedAt: null,
    hangoutLink: null,
    location: appointment.schedule.displayName,
    rawEvent: { appointment, emails },
    startDate: appointment.startAt.toISOString().split("T")[0] ?? null,
    startDateTime: appointment.startAt.toISOString(),
    startTimeZone: null,
    status: genericStatus,
    summary: toTitleCase(appointment.title) || appointment.title,
    transparency: null,
    visibility: null,
  };
}

export function normalizePatientName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(dra?\.?|dr\.?|sra?\.?|sr\.?|srta\.?)\s+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const EVENT_PRIORITY: Record<DoctoraliaEmailNotification["eventType"], number> = {
  CANCELLATION: 3,
  MODIFICATION: 2,
  BOOKING: 1,
};

export function orphanGroupToCalendarEventDetail(
  group: DoctoraliaEmailNotification[]
): CalendarEventDetail {
  const primary = [...group].sort(
    (a, b) => EVENT_PRIORITY[b.eventType] - EVENT_PRIORITY[a.eventType]
  )[0] as DoctoraliaEmailNotification;
  const hasCancellation = group.some((e) => e.eventType === "CANCELLATION");
  const hasModification = group.some((e) => e.eventType === "MODIFICATION");
  const hasBooking = group.some((e) => e.eventType === "BOOKING");
  const dateStr = primary.appointmentDate
    ? (primary.appointmentDate.toISOString().split("T")[0] ?? null)
    : null;
  const dateIso = primary.appointmentDate ? primary.appointmentDate.toISOString() : null;
  const statusBits = [
    hasCancellation ? "Cancelado" : null,
    hasModification ? "Modificado" : null,
    hasBooking && !hasCancellation && !hasModification ? "Reservado" : null,
  ].filter(Boolean);
  const descParts = [
    primary.appointmentService,
    primary.appointmentDoctor,
    `📧 ${statusBits.join(" + ")} por email (sin match en calendario)`,
  ].filter(Boolean);
  const colorId = hasCancellation ? "11" : hasModification ? "5" : "8";
  return {
    calendarId: "doctoralia-email",
    category: null,
    colorId,
    controlIncluded: null,
    description: descParts.length ? descParts.join(" · ") : null,
    endDate: null,
    endDateTime: null,
    endTimeZone: null,
    eventCreatedAt: null,
    eventDate: dateStr ?? "",
    eventDateTime: dateIso,
    eventId: group.map((e) => e.id).join("+"),
    eventType: "doctoralia-email",
    eventUpdatedAt: null,
    hangoutLink: null,
    location: primary.clinicAddress,
    patientName: primary.patientName,
    rawEvent: { group, primary },
    startDate: dateStr,
    startDateTime: dateIso,
    startTimeZone: null,
    status: primary.eventType,
    summary: `${toTitleCase(primary.patientName) || primary.patientName}${primary.appointmentService ? ` — ${primary.appointmentService}` : ""}`,
    transparency: null,
    visibility: null,
  };
}

export function mergedToCalendarEventDetails(
  merged: DoctoraliaCalendarMerged
): CalendarEventDetail[] {
  const orphanGroups = new Map<string, DoctoraliaEmailNotification[]>();
  const ungrouped: DoctoraliaEmailNotification[] = [];
  for (const email of merged.orphanEmails) {
    if (!email.appointmentDate) {
      ungrouped.push(email);
      continue;
    }
    const minute = Math.floor(email.appointmentDate.getTime() / 60_000);
    const key = `${normalizePatientName(email.patientName)}|${minute}`;
    const bucket = orphanGroups.get(key) ?? [];
    bucket.push(email);
    orphanGroups.set(key, bucket);
  }
  return [
    ...merged.entries.map(mergedEntryToCalendarEventDetail),
    ...Array.from(orphanGroups.values()).map(orphanGroupToCalendarEventDetail),
    ...ungrouped.map((e) => orphanGroupToCalendarEventDetail([e])),
  ];
}

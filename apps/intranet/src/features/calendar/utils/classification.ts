import type { z } from "zod";
import type { classificationSchema } from "@/features/calendar/schemas";
import type { CalendarUnclassifiedEvent } from "@/features/calendar/types";

export interface ParsedPayload {
  amountExpected: null | number;
  amountPaid: null | number;
  attended: boolean | null;
  category: null | string;
  dosage: null | string;
  treatmentStage: null | string;
}

export function buildDefaultEntry(event: CalendarUnclassifiedEvent) {
  return {
    amountExpected: event.amountExpected == null ? "" : String(event.amountExpected),
    amountPaid: event.amountPaid == null ? "" : String(event.amountPaid),
    attended: event.attended ?? false,
    category: event.category ?? "",
    dosage: event.dosage ?? "",
    treatmentStage: event.treatmentStage ?? "",
  };
}

export function buildPayload(
  entry: z.infer<typeof classificationSchema>,
  event: CalendarUnclassifiedEvent,
): ParsedPayload {
  const category = entry.category?.trim() ?? null;
  const resolvedCategory = category ?? event.category;
  const amountExpected = parseAmountInput(entry.amountExpected) ?? event.amountExpected ?? null;
  const amountPaid = parseAmountInput(entry.amountPaid) ?? event.amountPaid ?? null;
  const attended = entry.attended;
  const dosage = entry.dosage?.trim() ? entry.dosage.trim() : null;
  const treatmentStage =
    resolvedCategory === "Tratamiento subcutáneo" && entry.treatmentStage?.trim()
      ? entry.treatmentStage.trim()
      : null;

  return {
    amountExpected,
    amountPaid,
    attended,
    category: resolvedCategory,
    dosage,
    treatmentStage,
  };
}

export function eventKey(event: Pick<CalendarUnclassifiedEvent, "calendarId" | "eventId">) {
  return `${event.calendarId}:::${event.eventId}`;
}

export function parseAmountInput(value: null | string | undefined): null | number {
  if (!value) return null;
  const normalized = value.replaceAll(/\D/g, "");
  if (normalized.length === 0) return null;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

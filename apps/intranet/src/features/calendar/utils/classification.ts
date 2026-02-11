import type { z } from "zod";
import type { classificationSchema } from "@/features/calendar/schemas";
import type { CalendarUnclassifiedEvent } from "@/features/calendar/types";

export interface ParsedPayload {
  amountExpected: null | number;
  amountPaid: null | number;
  attended: boolean | null;
  category: null | string;
  dosageValue: null | number;
  dosageUnit: null | string;
  treatmentStage: null | string;
}

const SUBCUTANEOUS_CATEGORY = "Tratamiento subcutáneo";

function normalizeChoiceValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function isSubcutaneousCategory(value: null | string | undefined): boolean {
  if (!value) {
    return false;
  }
  return normalizeChoiceValue(value) === normalizeChoiceValue(SUBCUTANEOUS_CATEGORY);
}

export function buildDefaultEntry(event: CalendarUnclassifiedEvent) {
  return {
    amountExpected: event.amountExpected == null ? "" : String(event.amountExpected),
    amountPaid: event.amountPaid == null ? "" : String(event.amountPaid),
    attended: event.attended ?? false,
    category: event.category ? event.category.trim() : "",
    dosageValue: event.dosageValue != null ? String(event.dosageValue) : "",
    dosageUnit: event.dosageUnit ?? "",
    treatmentStage: event.treatmentStage ?? "",
  };
}

export function buildPayload(
  entry: z.infer<typeof classificationSchema>,
  event: CalendarUnclassifiedEvent,
): ParsedPayload {
  const category = entry.category?.trim() ?? null;
  const resolvedCategoryRaw = category ?? event.category;
  const resolvedCategory = isSubcutaneousCategory(resolvedCategoryRaw)
    ? SUBCUTANEOUS_CATEGORY
    : resolvedCategoryRaw;
  const amountExpected = parseAmountInput(entry.amountExpected) ?? event.amountExpected ?? null;
  const amountPaid = parseAmountInput(entry.amountPaid) ?? event.amountPaid ?? null;
  const attended = entry.attended;

  // Parse dosageValue from string input
  const dosageValue = entry.dosageValue?.trim()
    ? Number.parseFloat(entry.dosageValue.trim())
    : event.dosageValue;
  const dosageUnit = entry.dosageUnit?.trim() || event.dosageUnit || null;

  const treatmentStage =
    isSubcutaneousCategory(resolvedCategory) && entry.treatmentStage?.trim()
      ? entry.treatmentStage.trim()
      : null;

  return {
    amountExpected,
    amountPaid,
    attended,
    category: resolvedCategory,
    dosageValue: dosageValue ?? null,
    dosageUnit,
    treatmentStage,
  };
}

export function eventKey(event: Pick<CalendarUnclassifiedEvent, "calendarId" | "eventId">) {
  return `${event.calendarId}:::${event.eventId}`;
}

export function parseAmountInput(value: null | string | undefined): null | number {
  if (!value) {
    return null;
  }
  const normalized = value.replaceAll(/\D/g, "");
  if (normalized.length === 0) {
    return null;
  }
  const parsed = Number.parseInt(normalized, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

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
const ROXAIR_CATEGORY = "Roxair";
const ROXAIR_DEFAULT_AMOUNT = 150000;
const NOT_ATTENDED_PATTERNS = [
  /\bno\s+viene\b/i,
  /\bno\s+vino\b/i,
  /\bno\s+asiste\b/i,
  /\bno\s+asisti[oó]\b/i,
  /\bno\s+podr[áa]\s+asistir\b/i,
  /\bno\s+podr[áa]\s+venir\b/i,
];

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

function isRoxairCategory(value: null | string | undefined): boolean {
  if (!value) {
    return false;
  }
  return normalizeChoiceValue(value) === normalizeChoiceValue(ROXAIR_CATEGORY);
}

export function buildDefaultEntry(event: CalendarUnclassifiedEvent) {
  const resolvedCategory = event.category?.trim() ?? "";
  const roxairDefaultAmount =
    isRoxairCategory(resolvedCategory) && event.amountExpected == null
      ? ROXAIR_DEFAULT_AMOUNT
      : null;

  return {
    amountExpected:
      event.amountExpected == null
        ? roxairDefaultAmount == null
          ? ""
          : String(roxairDefaultAmount)
        : String(event.amountExpected),
    amountPaid: event.amountPaid == null ? "" : String(event.amountPaid),
    attended: event.attended ?? false,
    category: resolvedCategory,
    dosageValue: event.dosageValue != null ? String(event.dosageValue) : "",
    dosageUnit: event.dosageUnit ?? "",
    treatmentStage: event.treatmentStage ?? "",
  };
}

export function buildPayload(
  entry: z.infer<typeof classificationSchema>,
  event: CalendarUnclassifiedEvent,
): ParsedPayload {
  const category = sanitizeSelectValue(entry.category);
  const resolvedCategoryRaw = category ?? event.category;
  const resolvedCategory = isSubcutaneousCategory(resolvedCategoryRaw)
    ? SUBCUTANEOUS_CATEGORY
    : resolvedCategoryRaw;
  const isRoxair = isRoxairCategory(resolvedCategory);
  const isLockedNoShow = isExplicitNoShowEvent(event);
  const attended = isLockedNoShow ? false : entry.attended;
  const amountExpectedRaw = parseAmountInput(entry.amountExpected) ?? event.amountExpected ?? null;
  const amountExpected =
    amountExpectedRaw == null && isRoxair ? ROXAIR_DEFAULT_AMOUNT : amountExpectedRaw;
  const amountPaidRaw = parseAmountInput(entry.amountPaid) ?? event.amountPaid ?? null;
  const amountPaid = attended === false ? 0 : amountPaidRaw;

  // Parse dosageValue from string input
  const dosageValue = entry.dosageValue?.trim()
    ? Number.parseFloat(entry.dosageValue.trim())
    : event.dosageValue;
  const dosageUnit = sanitizeSelectValue(entry.dosageUnit) || event.dosageUnit || null;
  const treatmentStageValue = sanitizeSelectValue(entry.treatmentStage);

  const treatmentStage =
    isSubcutaneousCategory(resolvedCategory) && treatmentStageValue ? treatmentStageValue : null;

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

function sanitizeSelectValue(value: null | string | undefined): null | string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed;
}

export function eventKey(event: Pick<CalendarUnclassifiedEvent, "calendarId" | "eventId">) {
  return `${event.calendarId}:::${event.eventId}`;
}

export function isExplicitNoShowEvent(
  event: Pick<CalendarUnclassifiedEvent, "description" | "summary">,
) {
  const text = `${event.summary ?? ""} ${event.description ?? ""}`;
  return NOT_ATTENDED_PATTERNS.some((pattern) => pattern.test(text));
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

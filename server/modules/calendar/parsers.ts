import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import { z } from "zod";

dayjs.extend(utc);
dayjs.extend(timezone);

const SUBCUT_PATTERNS = [/\bclustoid\b/i, /\bvacc?\b/i, /\bvacuna\b/i, /\bvac\.?\b/i];
const TEST_PATTERNS = [/\bexamen\b/i, /\btest\b/i, /cut[áa]neo/i, /ambiental/i, /panel/i, /multitest/i];
const ATTENDED_PATTERNS = [/\blleg[oó]\b/i, /\basist[ií]o\b/i];
const MAINTENANCE_PATTERNS = [/\bmantenci[oó]n\b/i, /\bmant\b/i];
const DOSAGE_PATTERNS = [/(\d+(?:[.,]\d+)?)\s*ml\b/i, /(\d+(?:[.,]\d+)?)\s*cc\b/i, /(\d+(?:[.,]\d+)?)\s*mg\b/i];

const NormalizedTextSchema = z
  .string()
  .optional()
  .transform((value) => (value ?? "").normalize("NFC"));

const CalendarEventTextSchema = z.object({
  summary: NormalizedTextSchema,
  description: NormalizedTextSchema,
});

export type ParsedCalendarMetadata = {
  category: string | null;
  amountExpected: number | null;
  amountPaid: number | null;
  attended: boolean | null;
  dosage: string | null;
  treatmentStage: string | null;
};

export function normalizeEventDate(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return dayjs(value).toISOString();
  } catch {
    return null;
  }
}

function normalizeAmountRaw(raw: string) {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return null;
  const value = Number.parseInt(digits, 10);
  if (Number.isNaN(value) || value <= 0) return null;
  return value >= 1000 ? value : value * 1000;
}

function extractAmounts(summary: string, description: string) {
  let amountExpected: number | null = null;
  let amountPaid: number | null = null;
  const text = `${summary} ${description}`;
  const regex = /\(([^)]+)\)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const content = match[1];
    const amount = normalizeAmountRaw(content);
    if (amount == null) continue;
    if (/pagado/i.test(content)) {
      amountPaid = amount;
      if (amountExpected == null) amountExpected = amount;
    } else if (amountExpected == null) {
      amountExpected = amount;
    }
  }
  const paidOutside = /pagado\s*(\d+)/gi;
  let matchPaid: RegExpExecArray | null;
  while ((matchPaid = paidOutside.exec(text)) !== null) {
    const amount = normalizeAmountRaw(matchPaid[1]);
    if (amount != null) {
      amountPaid = amount;
      if (amountExpected == null) amountExpected = amount;
    }
  }
  return { amountExpected, amountPaid };
}

function classifyCategory(summary: string, description: string) {
  const text = `${summary} ${description}`.toLowerCase();
  if (SUBCUT_PATTERNS.some((pattern) => pattern.test(text))) {
    return "Tratamiento subcutáneo";
  }
  if (TEST_PATTERNS.some((pattern) => pattern.test(text))) {
    return "Test y exámenes";
  }
  return null;
}

function detectAttendance(summary: string, description: string) {
  const text = `${summary} ${description}`;
  if (ATTENDED_PATTERNS.some((pattern) => pattern.test(text))) return true;
  return null;
}

function extractDosage(summary: string, description: string) {
  const text = `${summary} ${description}`;
  for (const pattern of DOSAGE_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;
    const valueRaw = match[1]?.replace(",", ".") ?? "";
    const unit = match[0]
      .replace(match[1] ?? "", "")
      .trim()
      .toLowerCase();
    if (!valueRaw) return match[0].trim();
    const normalizedValue = Number.parseFloat(valueRaw);
    if (!Number.isFinite(normalizedValue)) {
      return `${match[1]} ${unit}`.trim();
    }
    const formatter = new Intl.NumberFormat("es-CL", {
      minimumFractionDigits: normalizedValue % 1 === 0 ? 0 : 1,
      maximumFractionDigits: 2,
    });
    const formattedValue = formatter.format(normalizedValue);
    return `${formattedValue} ${unit}`;
  }
  return null;
}

function detectTreatmentStage(summary: string, description: string) {
  const text = `${summary} ${description}`;
  if (MAINTENANCE_PATTERNS.some((pattern) => pattern.test(text))) {
    return "Mantención";
  }
  return null;
}

export function parseCalendarMetadata(input: {
  summary?: string | null;
  description?: string | null;
}): ParsedCalendarMetadata {
  const { summary, description } = CalendarEventTextSchema.parse(input);
  const amounts = extractAmounts(summary, description);
  const category = classifyCategory(summary, description);
  const attended = detectAttendance(summary, description);
  const dosage = extractDosage(summary, description);
  const treatmentStage = detectTreatmentStage(summary, description);

  return {
    category: category ?? (dosage ? "Tratamiento subcutáneo" : null),
    amountExpected: amounts.amountExpected,
    amountPaid: amounts.amountPaid,
    attended,
    dosage,
    treatmentStage,
  };
}

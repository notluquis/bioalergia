/**
 * Calendar Event Parser
 *
 * Parses calendar event metadata (summary/description) to extract:
 * - Category (Tratamiento subcutáneo, Test y exámenes, etc.)
 * - Amounts (expected and paid)
 * - Attendance status
 * - Dosage information
 * - Treatment stage (Mantención, Inducción)
 */

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import { z } from "zod";

dayjs.extend(utc);
dayjs.extend(timezone);

// ============================================================================
// TYPES & EXPORTS
// ============================================================================

export const CATEGORY_CHOICES = [
  "Tratamiento subcutáneo",
  "Test y exámenes",
  "Consulta médica",
  "Control médico",
  "Licencia médica",
] as const;

export const TREATMENT_STAGE_CHOICES = ["Mantención", "Inducción"] as const;

export type CategoryChoice = (typeof CATEGORY_CHOICES)[number];
export type TreatmentStageChoice = (typeof TREATMENT_STAGE_CHOICES)[number];

export type ParsedCalendarMetadata = {
  category: string | null;
  amountExpected: number | null;
  amountPaid: number | null;
  attended: boolean | null;
  dosage: string | null;
  treatmentStage: string | null;
};

// ============================================================================
// PATTERN DEFINITIONS (by category, ordered by priority)
// ============================================================================

/** Patterns for "Tratamiento subcutáneo" - highest priority */
const SUBCUT_PATTERNS = [
  /cl[au]s[i]?t[oau]?id[eo]?/i, // clustoid, clastoid, clusitoid, etc.
  /clutoid/i, // typo: missing 's'
  /\bclust/i, // starts with clust
  /\bdosis\s+clust/i, // dosis clustoid
  /alxoid/i, // Alxoid
  /cluxin/i, // Cluxin
  /oral[\s-]?tec/i, // ORAL-TEC
  /\bvacc?\b/i, // vac, vacc
  /vacuna/i, // VACUNA
  /\bsubcut[áa]ne[oa]/i, // subcutáneo
  /inmuno/i, // inmuno
  /\d+[ªº]?\s*(ta|da|ra|va)?\s*dosis/i, // 4ta dosis, 3ra dosis
  /\bdosis\s+mensual/i, // Dosis mensual
  /v[ie]+n?[ie]?[eo]?r?o?n?\s+a\s+buscar/i, // vinieron a buscar
  /\bmantenci[oó]n\b/i, // mantención (maintenance treatment)
];

/** Pattern for decimal dosage (indicates subcutaneous treatment) */
const DECIMAL_DOSAGE_PATTERN = /\b(\d+[.,]\d+)\b/;

/** Patterns for "Test y exámenes" */
const TEST_PATTERNS = [
  /\bexam[eé]n(es)?\b/i, // examen, examenes
  /test\s*(de\s*)?parche/i, // test de parche
  /lectura\s*(de\s*)?parche/i, // lectura de parche
  /\d+(era|da|ra)?\s*test/i, // 1eratest
  /lleg[oó]\s*test/i, // llegotest
  /\d+(era|da|ra)?\s*lectura/i, // 2da lectura
  /\btest\b/i,
  /cut[áa]neo/i,
  /ambiental/i,
  /panel/i,
  /multi\s*tes?t?/i, // multitest
  /prick/i, // prick test
  /aeroal[eé]rgenos?/i, // aeroalergenos
];

/** Patterns for "Licencia médica" */
const LICENCIA_PATTERNS = [
  /\blic\b/i, // lic remota
  /\blicencia\b/i, // licencia médica
];

/** Patterns for "Control médico" */
const CONTROL_PATTERNS = [
  /\bcontrol\b/i, // control s/c
  /\d+-\d+control/i, // 03-10control (date-prefixed)
];

/** Patterns for "Consulta médica" */
const CONSULTA_PATTERNS = [
  /\bconsulta\b/i, // consulta
  /\d+(era|da|ra)?\s*consulta/i, // 1era consulta
  /^\d{1,2}:\d{2}\s+[a-záéíóúñ]+\s+[a-záéíóúñ]+/i, // "13:37 nombre apellido"
];

/** Patterns for events to IGNORE (not classify) */
export const IGNORE_PATTERNS = [
  /^recordar\b/i, // RECORDAR AL DOCTOR
  /^semana\s+de\s+vacaciones$/i,
  /\brecordar\b.*\bdoctor\b/i,
  /^feriado$/i,
  /^vacaciones$/i,
  /^elecciones$/i,
  /^doctor\s+ocupado$/i,
];

/** Patterns for attendance confirmation */
const ATTENDED_PATTERNS = [/\bllego\b/i, /\basist[ií]o\b/i];

/** Patterns for maintenance stage */
const MAINTENANCE_PATTERNS = [/\bmantenci[oó]n\b/i, /\bmant\b/i, /\bmensual\b/i];

/** Patterns for dosage extraction */
const DOSAGE_PATTERNS = [/(\d+(?:[.,]\d+)?)\s*ml\b/i, /(\d+(?:[.,]\d+)?)\s*cc\b/i, /(\d+(?:[.,]\d+)?)\s*mg\b/i];

/** Pattern for S/C (sin costo) */
const SIN_COSTO_PATTERN = /\bs\/?c\b/i;

/** Patterns for money confirmation (paid) */
const MONEY_CONFIRMED_PATTERNS = [/\blleg[oó]\b/i, /\benv[ií][oó]\b/i, /\btransferencia\b/i, /\bpagado\b/i];

/** Phone number patterns to exclude from amount parsing */
const PHONE_PATTERNS = [
  /^9\d{8}$/, // 9XXXXXXXX (Chilean mobile)
  /^569\d{8}$/, // 569XXXXXXXX
  /^56\d{9}$/, // 56XXXXXXXXX
];

// ============================================================================
// VALIDATION & SCHEMAS
// ============================================================================

const NormalizedTextSchema = z
  .string()
  .optional()
  .transform((value) => (value ?? "").normalize("NFC"));

const CalendarEventTextSchema = z.object({
  summary: NormalizedTextSchema,
  description: NormalizedTextSchema,
});

// Amount limits
const MAX_INT32 = 2147483647;
const MAX_REASONABLE_AMOUNT = 100_000_000; // 100M CLP

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/** Check if event should be ignored based on summary */
export function isIgnoredEvent(summary: string | null | undefined): boolean {
  const text = (summary ?? "").toLowerCase();
  return IGNORE_PATTERNS.some((pattern) => pattern.test(text));
}

/** Normalize event date to ISO string */
export function normalizeEventDate(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return dayjs(value).toISOString();
  } catch {
    return null;
  }
}

/** Helper to test if any pattern matches */
function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

// ============================================================================
// AMOUNT PARSING
// ============================================================================

function normalizeAmountRaw(raw: string): number | null {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return null;

  // Skip phone numbers
  if (PHONE_PATTERNS.some((p) => p.test(digits))) return null;

  const value = Number.parseInt(digits, 10);
  if (Number.isNaN(value) || value <= 0) return null;

  // Normalize: values < 1000 are multiplied by 1000 (e.g., 50 → 50000)
  const normalized = value >= 1000 ? value : value * 1000;

  // Validate range
  if (normalized > MAX_INT32 || normalized > MAX_REASONABLE_AMOUNT) {
    console.warn(`[parsers] Amount ${normalized} exceeds limits, skipping`);
    return null;
  }

  return normalized;
}

function extractAmounts(summary: string, description: string) {
  let amountExpected: number | null = null;
  let amountPaid: number | null = null;
  const text = `${summary} ${description}`;

  // 1. Pattern: (paid/expected) like (25/50)
  const slashPattern = /\((\d+)\s*\/\s*(\d+)\)/gi;
  let slashMatch: RegExpExecArray | null;
  while ((slashMatch = slashPattern.exec(text)) !== null) {
    const paid = normalizeAmountRaw(slashMatch[1]);
    const expected = normalizeAmountRaw(slashMatch[2]);
    if (paid != null && amountPaid == null) amountPaid = paid;
    if (expected != null && amountExpected == null) amountExpected = expected;
  }

  // 2. Standard pattern: (amount)
  const parenPattern = /\(([^)]+)\)/gi;
  let match: RegExpExecArray | null;
  while ((match = parenPattern.exec(text)) !== null) {
    const content = match[1];
    if (/^\d+\s*\/\s*\d+$/.test(content)) continue; // Skip slash format
    const amount = normalizeAmountRaw(content);
    if (amount == null) continue;
    if (/pagado/i.test(content)) {
      amountPaid = amount;
      if (amountExpected == null) amountExpected = amount;
    } else if (amountExpected == null) {
      amountExpected = amount;
    }
  }

  // 3. Fallback: typo like "acaros20)" (missing opening paren, 2 digits only)
  if (amountExpected == null) {
    const typoPattern = /[a-z](\d{2})\)/gi;
    let typoMatch: RegExpExecArray | null;
    while ((typoMatch = typoPattern.exec(text)) !== null) {
      const amount = normalizeAmountRaw(typoMatch[1]);
      if (amount != null && amountExpected == null) amountExpected = amount;
    }
  }

  // 4. Fallback: amount at end without parens (e.g., "clusitoid 50")
  if (amountExpected == null) {
    const endMatch = /\s(\d{2,3})\s*$/.exec(text);
    if (endMatch) {
      const amount = normalizeAmountRaw(endMatch[1]);
      if (amount != null) amountExpected = amount;
    }
  }

  // 5. "pagado X" pattern
  const paidPattern = /pagado\s*(\d+)/gi;
  let matchPaid: RegExpExecArray | null;
  while ((matchPaid = paidPattern.exec(text)) !== null) {
    const amount = normalizeAmountRaw(matchPaid[1]);
    if (amount != null) {
      amountPaid = amount;
      if (amountExpected == null) amountExpected = amount;
    }
  }

  // 6. S/C (sin costo) = 0
  if (SIN_COSTO_PATTERN.test(text)) {
    amountExpected = 0;
    amountPaid = 0;
  }

  return { amountExpected, amountPaid };
}

function refineAmounts(
  amounts: { amountExpected: number | null; amountPaid: number | null },
  summary: string,
  description: string
) {
  const text = `${summary} ${description}`;
  const isConfirmed = matchesAny(text, MONEY_CONFIRMED_PATTERNS);

  // If confirmed (llegó, envio, etc.) and only expected is set, assume paid
  if (isConfirmed && amounts.amountExpected != null && amounts.amountPaid == null) {
    return { ...amounts, amountPaid: amounts.amountExpected };
  }

  return amounts;
}

// ============================================================================
// CATEGORY CLASSIFICATION
// ============================================================================

function classifyCategory(summary: string, description: string): string | null {
  const text = `${summary} ${description}`.toLowerCase();
  const summaryOnly = (summary ?? "").toLowerCase();

  // Skip ignored events
  if (IGNORE_PATTERNS.some((p) => p.test(summaryOnly) || p.test(text))) {
    return null;
  }

  // Priority order: Subcutáneo → Test → Licencia → Control → Consulta
  if (matchesAny(text, SUBCUT_PATTERNS) || DECIMAL_DOSAGE_PATTERN.test(text)) {
    return "Tratamiento subcutáneo";
  }
  if (matchesAny(text, TEST_PATTERNS)) return "Test y exámenes";
  if (matchesAny(text, LICENCIA_PATTERNS)) return "Licencia médica";
  if (matchesAny(text, CONTROL_PATTERNS)) return "Control médico";
  if (matchesAny(text, CONSULTA_PATTERNS)) return "Consulta médica";

  return null;
}

// ============================================================================
// ATTENDANCE, DOSAGE, TREATMENT STAGE
// ============================================================================

function detectAttendance(summary: string, description: string): boolean | null {
  const text = `${summary} ${description}`;
  return matchesAny(text, ATTENDED_PATTERNS) ? true : null;
}

function extractDosage(summary: string, description: string): string | null {
  const text = `${summary} ${description}`;

  // Try explicit dosage patterns (0.5 ml, 1 cc, etc.)
  for (const pattern of DOSAGE_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;

    const valueRaw = match[1]?.replace(",", ".") ?? "";
    const unit = match[0]
      .replace(match[1] ?? "", "")
      .trim()
      .toLowerCase();

    if (!valueRaw) return match[0].trim();

    const value = Number.parseFloat(valueRaw);
    if (!Number.isFinite(value)) return `${match[1]} ${unit}`.trim();

    const formatter = new Intl.NumberFormat("es-CL", {
      minimumFractionDigits: value % 1 === 0 ? 0 : 1,
      maximumFractionDigits: 2,
    });
    return `${formatter.format(value)} ${unit}`;
  }

  // Fallback: maintenance pattern implies 0.5 ml
  if (matchesAny(text, MAINTENANCE_PATTERNS)) return "0,5 ml";

  return null;
}

function detectTreatmentStage(summary: string, description: string): string | null {
  const text = `${summary} ${description}`;

  // Maintenance keywords or 0.5ml dosage = Mantención
  if (matchesAny(text, MAINTENANCE_PATTERNS) || /0[.,]5\s*ml/i.test(text)) {
    return "Mantención";
  }

  return null;
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export function parseCalendarMetadata(input: {
  summary?: string | null;
  description?: string | null;
}): ParsedCalendarMetadata {
  const { summary, description } = CalendarEventTextSchema.parse(input);

  const rawAmounts = extractAmounts(summary, description);
  const amounts = refineAmounts(rawAmounts, summary, description);
  const category = classifyCategory(summary, description);
  const attended = detectAttendance(summary, description);
  const dosage = extractDosage(summary, description);
  const treatmentStage = detectTreatmentStage(summary, description);

  return {
    // If dosage found but no category, default to subcutaneous
    category: category ?? (dosage ? "Tratamiento subcutáneo" : null),
    amountExpected: amounts.amountExpected,
    amountPaid: amounts.amountPaid,
    attended,
    dosage,
    treatmentStage,
  };
}

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import { z } from "zod";

dayjs.extend(utc);
dayjs.extend(timezone);

// === SINGLE SOURCE OF TRUTH FOR CATEGORIES ===
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

const SUBCUT_PATTERNS = [
  /cl[au]s[i]?t[oau]?id[eo]?/i, // Flexible: clustoid, clastoid, clusitoid, clustid, etc.
  /clutoid/i, // Missing 's'
  /\bclust/i, // Starts with clust (cluster, clustoid, etc.)
  /\bdosis\s+clust/i,
  /alxoid/i, // Alxoid treatment
  /cluxin/i, // Cluxin treatment
  /oral[\s-]?tec/i, // ORAL-TEC, ORALTEC, ORAL TEC
  /\bvacc?\b/i, // "vac" or "vacc"
  /vacuna/i, // VACUNA anywhere (handles "llegoVACUNA")
  /\bsubcut[áa]ne[oa]/i,
  /inmuno/i,
  /\d+[ªº]?\s*(ta|da|ra|va)?\s*dosis/i, // "4ta dosis", "3ra dosis", "2da dosis", "1 dosis"
  /\bdosis\s+mensual/i, // "Dosis mensual Ácaros"
  /v[ie]+n?[ie]?[eo]?r?o?n?\s+a\s+buscar/i, // vinieron, venieron, vino a buscar (pickup treatment)
  /\bmantenci[oó]n\b/i, // mantencion, mantención (maintenance treatment)
];

// Pattern to detect dosage values like "0,5" or "0.5" (decimal fractions without unit)
const DECIMAL_DOSAGE_PATTERN = /\b(\d+[.,]\d+)\b/;

const TEST_PATTERNS = [
  /\bexam[eé]n(es)?\b/i, // examen, examenes, exámenes
  /test\s*(de\s*)?parche/i, // test de parche, test parche, testparche
  /lectura\s*(de\s*)?parche/i, // lectura de parche
  /\d+(era|da|ra)?\s*test/i, // 1eratest, 2datest, 1era test, 2da test
  /lleg[oó]\s*test/i, // llegotest, llegó test
  /\d+(era|da|ra)?\s*lectura/i, // 2da lectura
  /\btest\b/i,
  /cut[áa]neo/i,
  /ambiental/i,
  /panel/i,
  /multi\s*tes?t?/i, // Handles multitest, multites (typo)
  /prick/i, // prick to prick tests
  /aeroal[eé]rgenos?/i, // aeroalergenos test
];
const ATTENDED_PATTERNS = [/\bllego\b/i, /\basist[ií]o\b/i];
const MAINTENANCE_PATTERNS = [/\bmantenci[oó]n\b/i, /\bmant\b/i, /\bmensual\b/i];
const DOSAGE_PATTERNS = [/(\d+(?:[.,]\d+)?)\s*ml\b/i, /(\d+(?:[.,]\d+)?)\s*cc\b/i, /(\d+(?:[.,]\d+)?)\s*mg\b/i];

// Patterns for Licencia médica
const LICENCIA_PATTERNS = [
  /\blic\b/i, // "lic remota", "lic"
  /\blicencia\b/i, // "licencia médica"
];

// Patterns for Consulta médica
const CONSULTA_PATTERNS = [
  /\bconsulta\b/i, // "1era consulta", "consulta"
  /\d+(era|da|ra)?\s*consulta/i, // "1era consulta", "2da consulta"
  /^\d{1,2}:\d{2}\s+[a-záéíóúñ]+\s+[a-záéíóúñ]+/i, // Time + name pattern like "13:37 reinaldo salas"
];

// Patterns for Control médico
const CONTROL_PATTERNS = [
  /\bcontrol\b/i, // "control s/c"
];

// Pattern for S/C (sin costo) - amount = 0
const SIN_COSTO_PATTERN = /\bs\/?c\b/i;

// Patterns for notes/reminders that should NOT be classified
export const IGNORE_PATTERNS = [
  /^recordar\b/i, // RECORDAR AL DOCTOR...
  /^semana\s+de\s+vacaciones$/i, // SEMANA DE VACACIONES
  /\brecordar\b.*\bdoctor\b/i, // recordar ... doctor
  /^feriado$/i, // FERIADO
  /^vacaciones$/i, // VACACIONES
  /^elecciones$/i, // ELECCIONES
  /^doctor\s+ocupado$/i, // DOCTOR OCUPADO
];

// Helper to check if an event summary should be ignored
export function isIgnoredEvent(summary: string | null | undefined): boolean {
  const text = (summary ?? "").toLowerCase();
  return IGNORE_PATTERNS.some((pattern) => pattern.test(text));
}

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

// PostgreSQL INTEGER max: 2,147,483,647 (~2.1 billion)
// Reasonable max amount: 100M CLP (~100,000,000)
const MAX_INT32 = 2147483647;
const MAX_REASONABLE_AMOUNT = 100_000_000; // 100M CLP

// Phone number patterns to exclude from amount parsing (Chilean format)
const PHONE_PATTERNS = [
  /^9\d{8}$/, // 9XXXXXXXX (Chilean mobile)
  /^569\d{8}$/, // 569XXXXXXXX (with country code)
  /^56\d{9}$/, // 56XXXXXXXXX (other Chilean)
];

function normalizeAmountRaw(raw: string) {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return null;

  // Skip phone numbers
  if (PHONE_PATTERNS.some((p) => p.test(digits))) {
    return null;
  }

  const value = Number.parseInt(digits, 10);
  if (Number.isNaN(value) || value <= 0) return null;

  // Normalizar valores menores a 1000 multiplicando x1000
  const normalized = value >= 1000 ? value : value * 1000;

  // Validar que esté dentro del rango de Int32 y sea razonable
  if (normalized > MAX_INT32) {
    console.warn(`[parsers] Amount ${normalized} exceeds Int32 max (${MAX_INT32}), skipping`);
    return null;
  }
  if (normalized > MAX_REASONABLE_AMOUNT) {
    console.warn(`[parsers] Amount ${normalized} exceeds reasonable max (${MAX_REASONABLE_AMOUNT}), skipping`);
    return null;
  }

  return normalized;
}

function extractAmounts(summary: string, description: string) {
  let amountExpected: number | null = null;
  let amountPaid: number | null = null;
  const text = `${summary} ${description}`;

  // Standard pattern: (amount) with proper parentheses
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

  // Fallback: typo pattern like "acaros820)" - missing opening paren
  // Only extract exactly 2 digits to avoid capturing accidental digits (e.g., "acaros8" + "20)")
  // Common prices are 2 digits (20, 30, 50, 60), 3+ digits would normally have proper parens
  if (amountExpected == null) {
    const typoPattern = /[a-z](\d{2})\)/gi;
    let typoMatch: RegExpExecArray | null;
    while ((typoMatch = typoPattern.exec(text)) !== null) {
      const amount = normalizeAmountRaw(typoMatch[1]);
      if (amount != null && amountExpected == null) {
        amountExpected = amount;
      }
    }
  }

  // Fallback: amount at end of text without parens (e.g., "clusitoid 50")
  if (amountExpected == null) {
    const endAmountPattern = /\s(\d{2,3})\s*$/;
    const endMatch = endAmountPattern.exec(text);
    if (endMatch) {
      const amount = normalizeAmountRaw(endMatch[1]);
      if (amount != null) {
        amountExpected = amount;
      }
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

  // S/C (sin costo) = 0
  if (SIN_COSTO_PATTERN.test(text)) {
    amountExpected = 0;
    amountPaid = 0;
  }

  return { amountExpected, amountPaid };
}

function classifyCategory(summary: string, description: string) {
  const text = `${summary} ${description}`.toLowerCase();
  const summaryOnly = (summary ?? "").toLowerCase();

  // Skip notes/reminders
  if (IGNORE_PATTERNS.some((pattern) => pattern.test(summaryOnly) || pattern.test(text))) {
    return null;
  }

  // Tratamiento subcutáneo (highest priority for treatment)
  if (SUBCUT_PATTERNS.some((pattern) => pattern.test(text))) {
    return "Tratamiento subcutáneo";
  }
  // Detect decimal dosage (0,5 or 0.15 etc.) - alone is enough for subcutaneous
  const hasDecimalDosage = DECIMAL_DOSAGE_PATTERN.test(text);
  if (hasDecimalDosage) {
    return "Tratamiento subcutáneo";
  }

  // Test y exámenes
  if (TEST_PATTERNS.some((pattern) => pattern.test(text))) {
    return "Test y exámenes";
  }

  // Licencia médica
  if (LICENCIA_PATTERNS.some((pattern) => pattern.test(text))) {
    return "Licencia médica";
  }

  // Control médico
  if (CONTROL_PATTERNS.some((pattern) => pattern.test(text))) {
    return "Control médico";
  }

  // Consulta médica
  if (CONSULTA_PATTERNS.some((pattern) => pattern.test(text))) {
    return "Consulta médica";
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

  // First try to find explicit dosage (e.g., "0.5 ml", "1 cc")
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

  // Fallback: if maintenance pattern found, infer 0.5 ml
  if (MAINTENANCE_PATTERNS.some((pattern) => pattern.test(text))) {
    return "0,5 ml";
  }

  return null;
}

function detectTreatmentStage(summary: string, description: string) {
  const text = `${summary} ${description}`;

  // Check for maintenance keywords
  if (MAINTENANCE_PATTERNS.some((pattern) => pattern.test(text))) {
    return "Mantención";
  }

  // 0.5ml dosage = Mantención
  const halfMlPattern = /0[.,]5\s*ml/i;
  if (halfMlPattern.test(text)) {
    return "Mantención";
  }

  return null;
}

const MONEY_CONFIRMED_PATTERNS = [/\blleg[oó]\b/i, /\benv[ií][oó]\b/i, /\btransferencia\b/i, /\bpagado\b/i];

// Helper to refine amounts based on text context
function refineAmounts(
  initialAmounts: { amountExpected: number | null; amountPaid: number | null },
  summary: string,
  description: string
) {
  const text = `${summary} ${description}`;
  const isConfirmed = MONEY_CONFIRMED_PATTERNS.some((pattern) => pattern.test(text));

  // Logic: "llegó" / "envio" -> Confirmed Money (Paid)
  if (isConfirmed && initialAmounts.amountExpected != null && initialAmounts.amountPaid == null) {
    return {
      ...initialAmounts,
      amountPaid: initialAmounts.amountExpected,
    };
  }

  return initialAmounts;
}

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
    category: category ?? (dosage ? "Tratamiento subcutáneo" : null),
    amountExpected: amounts.amountExpected,
    amountPaid: amounts.amountPaid,
    attended,
    dosage,
    treatmentStage,
  };
}

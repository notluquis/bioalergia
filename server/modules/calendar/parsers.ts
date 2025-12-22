import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import { z } from "zod";

dayjs.extend(utc);
dayjs.extend(timezone);

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
  /vi[eon]+[ie]?r?o?n?\s+a\s+buscar/i, // vinieron a buscarla, vino a buscar (pickup treatment)
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
const ATTENDED_PATTERNS = [/\blleg[oó]\b/i, /\basist[ií]o\b/i];
const MAINTENANCE_PATTERNS = [/\bmantenci[oó]n\b/i, /\bmant\b/i, /\bmensual\b/i];
const DOSAGE_PATTERNS = [/(\d+(?:[.,]\d+)?)\s*ml\b/i, /(\d+(?:[.,]\d+)?)\s*cc\b/i, /(\d+(?:[.,]\d+)?)\s*mg\b/i];
// Patterns for notes/reminders that should NOT be classified
const IGNORE_PATTERNS = [
  /^recordar\b/i, // RECORDAR AL DOCTOR...
  /^semana\s+de\s+vacaciones$/i, // SEMANA DE VACACIONES
  /\brecordar\b.*\bdoctor\b/i, // recordar ... doctor
  /^feriado$/i, // FERIADO
  /^vacaciones$/i, // VACACIONES
];

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
  const summaryOnly = (summary ?? "").toLowerCase();

  // Skip notes/reminders
  if (IGNORE_PATTERNS.some((pattern) => pattern.test(summaryOnly) || pattern.test(text))) {
    return null;
  }

  if (SUBCUT_PATTERNS.some((pattern) => pattern.test(text))) {
    return "Tratamiento subcutáneo";
  }
  // Detect decimal dosage (0,5 or 0.15 etc.) - alone is enough for subcutaneous
  const hasDecimalDosage = DECIMAL_DOSAGE_PATTERN.test(text);
  if (hasDecimalDosage) {
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

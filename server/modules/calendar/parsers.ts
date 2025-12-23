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
  "Roxair",
  "Servicio de inyección",
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
  /\bvac\.?\s*[aá]caros?\b/i, // "vac acaros", "vac. acaros", "confirmavac acaros"
  /vacuna/i, // VACUNA
  /\bsubcut[áa]ne[oa]/i, // subcutáneo
  /inmuno/i, // inmuno
  /\d+[ªº]?\s*(era|ta|da|ra|va)?\s*dosis/i, // 2era dosis, 4ta dosis, 3ra dosis
  /\bdosis\s+mensual/i, // Dosis mensual
  /v[ie]+n?[ie]?[eo]?r?o?n?\s+a\s+buscar/i, // vinieron a buscar
  /\bmantenci[oó]n\b/i, // mantención (maintenance treatment)
  /\bse\s+envio\s+dosis\b/i, // "se envio dosis"
  /\benviado\b.*\bpagado\b/i, // "enviado (50/ pagado)"
  /\d+([.,]\d+)?\s*(ml|cc|mg)\b/i, // explicit dosage unit (e.g. 0.5ml, 1cc)
];

/** Pattern for decimal dosage (indicates subcutaneous treatment) */
const DECIMAL_DOSAGE_PATTERN = /\b(\d+[.,]\d{1,2})\b/;

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

/** Patterns for "Control médico"
 * - control: "control s/c", "control sin costo"
 * - date-prefixed: "03-10control"
 * - time-prefixed: "14:56control" o "1632control" (sin espacio)
 * - confirmacontrol: "12:00confirmacontrol"
 * - ontrol: typo sin 'c' inicial
 */
const CONTROL_PATTERNS = [
  /\bcontrol\b/i,
  /\d+-\d+control/i, // date-prefixed
  /\d{3,4}control/i, // time without colon: 1632control
  /\d{1,2}:\d{2}control/i, // time-prefixed (14:56control)
  /confirma\s*control/i, // confirmacontrol, confirma control
  /\bontrol\b/i, // typo
];

/** Patterns for "Consulta médica"
 * - consulta/consuta/consult: "1era consulta", "1era consult"
 * - telemedicina/doctoralia: "telemedicina (40)"
 * - confirma: "1era confirma 40 cristian"
 * - reserva/reservado: "reserva Soledad", "reservado +56 9"
 * - name+phone: "gonzalo calderon 981592361"
 * - retirar documentos: "vendra a retirar documentos"
 */
const CONSULTA_PATTERNS = [
  /\bconsulta\b/i,
  /\bconsuta\b/i, // typo missing 'l'
  /\bconsult\b/i, // typo missing 'a'
  /\bconsulto\b/i, // typo 'o' instead of 'a'
  /\d+(era|da|ra)?\s*consulta/i,
  /\d+(era|da|ra)?\s*consuta/i, // typo
  /\d+(era|da|ra)?\s*consult\b/i, // typo "1era consult"
  /\d+(era|da|ra)?\s*consulto/i, // typo "1era consulto"
  /^\d{1,2}:\d{2}\s+[a-záéíóúñ]+\s+[a-záéíóúñ]+/i,
  /\btelemedicina\b/i,
  /\bdoctoralia\b/i, // reservado doctoralia
  /\d+(era|da|ra)?\s*confirma\b/i,
  /^\d{1,2}:\d{2}\s*\d+(era|da|ra)?\b/i,
  /\breserva\s+[a-záéíóúñ]+/i, // "reserva Soledad González"
  /\breservado\s+\+?56/i, // "reservado +56 9 3206 6790"
  /\breservado\s+9\d{8}/i, // "reservado 964077959"
  /\bno\s+contesta\s+reserva\b/i, // "no contesta reserva 996008484"
  /\bretirar\s+documentos\b/i, // "vendra a retirar documentos"
  /^[a-záéíóúñ]+\s+[a-záéíóúñ]+\s+9\d{8}$/i, // "gonzalo calderon 981592361"
  /^[a-záéíóúñ]+\s+[a-záéíóúñ]+\s+[a-záéíóúñ]+\s+9\d{8}$/i, // "maria de los angeles 931702057"
];

/** Patterns for "Roxair" - Entrega de medicamento Roxair
 * - roxair: cualquier mención
 * - retira roxair: "RETIRA ROXAIR (pagado): Alondra valenzuela"
 * - enviar roxair: "enviar roxair a Santino (pagado)"
 */
const ROXAIR_PATTERNS = [/\broxair\b/i, /\bretira\s+roxair\b/i, /\benviar\s+roxair\b/i];

/** Patterns for "Servicio de inyección" (Patient brings med or specific injection service) */
const INJECTION_PATTERNS = [
  /\bdacam\b/i, // DACAM
  /\bcidoten\b/i, // CIDOTEN
  /\bbetametasona\b/i, // BETAMETASONA
  /\bneurobionta\b/i, // NEUROBIONTA
  /\blo\s+trae\b/i, // "lo trae ella", "lo trae el paciente"
  /\btrae\s+(?:su|el)\s+medicamento\b/i, // "trae su medicamento"
  /\btrae\s+medicamento\b/i, // "trae medicamento" (generic)
  /\bpaciente\s+trae\b/i, // "paciente trae"
  /\binyecci[oó]n\b/i, // inyección
  /\badministraci[oó]n\b/i, // administración (context sensitive, but usually implies service)
  /\bim\b/i, // IM (Intramuscular)
  /\btrae\s+el\s+medicamento\b/i,
];

/** Patterns for events to IGNORE (not classify)
 * - recordar: "RECORDAR AL DOCTOR..."
 * - vacaciones/feriado: eventos administrativos
 * - publicidad/grabación: notas de marketing
 * - reunión/jornada: eventos internos
 * - reservado solo: sin más info
 * - name and name: "Jose Manuel Martinez and Carlota Arevalo"
 */
export const IGNORE_PATTERNS = [
  /^recordar\b/i,
  /^semana\s+de\s+vacaciones$/i,
  /\brecordar\b.*\bdoctor\b/i,
  /\bferiado\b/i, // FERIADO anywhere
  /^vacaciones$/i,
  /^elecciones$/i,
  /^doctor\s+ocupado$/i,
  /\bpublicidad\b/i,
  /\bgrabaci[oó]n\s+de\s+videos?\b/i,
  /^reuni[oó]n\b/i,
  /^jornada\s+de\s+invierno\b/i,
  /^reservado$/i, // just "reservado" with nothing else
  /\band\b.*\b[a-záéíóúñ]+$/i, // "name and name" pattern
];

/** Patterns for attendance confirmation */
const ATTENDED_PATTERNS = [/\bllego\b/i, /\basist[ií]o\b/i];

/** Patterns for induction stage (1st-5th dose) */
const INDUCTION_PATTERNS = [
  // 1st dose variants: 1era, 1ra, 1°, 1º, primera, primra, prmera
  /\b1[º°]?(?:era|ra|er)?\s*dosis\b/i,
  /\bprim(?:er)?a?\s*dosis\b/i,
  /\bpr[im]+[er]*a\s*dosis\b/i, // catches primer, primra, prmera

  // 2nd-5th dose variants (numeric)
  /\b[2-5][º°]?(?:da|ra|ta|va|a)?\s*dosis\b/i,

  // Text variants
  /(?:segunda|tercera|cuarta|quinta)\s*dosis\b/i,
];

/** Patterns for maintenance stage */
const MAINTENANCE_PATTERNS = [
  /\bmantenci[oó]n\b/i, // mantención, mantencion
  /\bmantencio\b/i, // typo: missing final 'n'
  /\bmant\b/i, // abbreviated
  /\bmensual\b/i, // monthly
  /\bdosis\s+clust(?:oid)?\b/i, // 'dosis clustoid' implies maintenance/0.5ml
];

/** Patterns for dosage extraction */
const DOSAGE_PATTERNS = [/(\d+(?:[.,]\d+)?)\s*ml\b/i, /(\d+(?:[.,]\d+)?)\s*cc\b/i, /(\d+(?:[.,]\d+)?)\s*mg\b/i];

/** Pattern for S/C (sin costo) */
const SIN_COSTO_PATTERN = /\bs\/?c\b|sincosto|sin\s*costo/i;

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

  // Skip very long digit strings (likely RUTs, IDs, or multiple numbers merged)
  // Valid amounts are typically 2-6 digits (e.g. 20, 50, 30000, 100000)
  if (digits.length > 8) return null;

  const value = Number.parseInt(digits, 10);
  if (Number.isNaN(value) || value <= 0) return null;

  // Normalize: values < 1000 are multiplied by 1000 (e.g., 50 → 50000)
  const normalized = value >= 1000 ? value : value * 1000;

  // Validate range (silently skip unreasonable amounts)
  if (normalized > MAX_INT32 || normalized > MAX_REASONABLE_AMOUNT) {
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
    let content = match[1]; // Use 'let' so we can modify it
    if (/^\d+\s*\/\s*\d+$/.test(content)) continue; // Skip slash format

    // Fix: Remove date patterns to avoid merging them into the amount (e.g. "pagado el 21-11/ 30")
    // Matches "21-11" or "21/11" (if surrounded by spaces or boundary)
    content = content.replace(/\b\d{1,2}[-]\d{1,2}\b/g, "");

    const amount = normalizeAmountRaw(content);
    if (amount == null) continue;
    if (/pagado/i.test(content)) {
      amountPaid = amount;
      if (amountExpected == null) amountExpected = amount;
    } else if (amountExpected == null) {
      amountExpected = amount;
    }
  }

  // 3. Fallback: typo like "acaros20)" or "acaros820)" (missing opening paren)
  // For 3+ digits like "820)", extract last 2 digits (assuming first is typo)
  if (amountExpected == null) {
    // Match letter followed by digits followed by ) - extract last 2 digits
    const typoPattern = /[a-z](\d+)\)/gi;
    let typoMatch: RegExpExecArray | null;
    while ((typoMatch = typoPattern.exec(text)) !== null) {
      const digits = typoMatch[1];
      // Take last 2 digits only (common amounts are 20, 30, 50, 60)
      const lastTwo = digits.length >= 2 ? digits.slice(-2) : digits;
      const amount = normalizeAmountRaw(lastTwo);
      if (amount != null && amountExpected == null) amountExpected = amount;
    }
  }

  // 3.5. Keyword followed by amount (e.g. "clustoid 50", "cluxin 30")
  if (amountExpected == null) {
    // Note: this must match the robust SUBCUT_PATTERNS to catch typos like "clusitoid"
    const keywordPattern = /(?:cl[au]s[i]?t[oau]?id[eo]?|cluxin|alxoid|oral[-\s]?tec|vacuna)\s+(\d{2,3})\b/gi;
    let kwMatch: RegExpExecArray | null;
    while ((kwMatch = keywordPattern.exec(text)) !== null) {
      const amount = normalizeAmountRaw(kwMatch[1]);
      if (amount != null) {
        amountExpected = amount;
        break;
      }
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

  // Priority order: Test (specific) → Subcutáneo (explicit) → Roxair → Licencia → Control → Consulta → Subcutáneo (implicit/dosage)
  if (matchesAny(text, TEST_PATTERNS)) return "Test y exámenes";

  // Explicit Subcutaneous keywords (strong signals)
  if (matchesAny(text, SUBCUT_PATTERNS)) {
    return "Tratamiento subcutáneo";
  }

  if (matchesAny(text, ROXAIR_PATTERNS)) return "Roxair";

  // Injection service check
  if (matchesAny(text, INJECTION_PATTERNS)) return "Servicio de inyección";

  if (matchesAny(text, LICENCIA_PATTERNS)) return "Licencia médica";
  if (matchesAny(text, CONTROL_PATTERNS)) return "Control médico";
  if (matchesAny(text, CONSULTA_PATTERNS)) return "Consulta médica";

  // Implicit Subcutaneous: if it has a standalone decimal (e.g. 0,5) and wasn't caught by others, assume it's a dosage
  if (DECIMAL_DOSAGE_PATTERN.test(text)) {
    return "Tratamiento subcutáneo";
  }

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

  // Fallback: standalone decimal (e.g. "0,5") implies "ml" in this context
  const decimalMatch = /\b(0[.,]\d+)\b/.exec(text);
  if (decimalMatch) {
    return `${decimalMatch[1].replace(".", ",")} ml`;
  }

  // Fallback: maintenance pattern implies 0.5 ml
  if (matchesAny(text, MAINTENANCE_PATTERNS)) return "0,5 ml";

  return null;
}

function detectTreatmentStage(summary: string, description: string): string | null {
  const text = `${summary} ${description}`;

  // Induction takes priority (e.g. "2da dosis clustoid" is Induction, even if "dosis clustoid" looks like maintenance)
  if (matchesAny(text, INDUCTION_PATTERNS)) {
    return "Inducción";
  }

  // Maintenance keywords or 0.5 (with or without ml) = Mantención
  if (matchesAny(text, MAINTENANCE_PATTERNS) || /0[.,]5(\s*ml)?\b/i.test(text)) {
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

  // Logic: Dosage and Treatment Stage only apply to "Tratamiento subcutáneo"
  const isSubcut = category === "Tratamiento subcutáneo";

  // Determine treatment stage based on dosage value if available
  let finalTreatmentStage = isSubcut ? treatmentStage : null;
  if (isSubcut && dosage) {
    const dosageValue = parseDosageToMl(dosage);
    if (dosageValue !== null) {
      // Business rule: < 0.5 ml = Inducción, >= 0.5 ml = Mantención
      finalTreatmentStage = dosageValue < 0.5 ? "Inducción" : "Mantención";
    }
  }

  return {
    category,
    amountExpected: amounts.amountExpected,
    amountPaid: amounts.amountPaid,
    attended,
    dosage: isSubcut ? dosage : null,
    treatmentStage: finalTreatmentStage,
  };
}

/**
 * Parse a dosage string like "0,3 ml" or "0.5 cc" into a numeric value in ml.
 * Returns null if parsing fails.
 */
function parseDosageToMl(dosage: string): number | null {
  // Extract numeric value and unit from strings like "0,3 ml", "0.5 cc", "1 mg"
  const match = dosage.match(/^([\d.,]+)\s*(ml|cc|mg)?/i);
  if (!match) return null;

  const valueStr = match[1].replace(",", ".");
  const value = Number.parseFloat(valueStr);
  if (!Number.isFinite(value)) return null;

  // For simplicity, treat cc as equivalent to ml. mg would need conversion but we assume ml for now.
  return value;
}

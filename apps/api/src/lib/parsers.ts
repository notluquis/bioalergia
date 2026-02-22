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
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
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
  dosageValue: number | null;
  dosageUnit: string | null;
  treatmentStage: string | null;
  controlIncluded: boolean;
  isDomicilio: boolean;
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
  /\b[áa]caros?\b/i, // ácaros / acaros (mite vaccine)
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
const ROXAIR_DEFAULT_AMOUNT = 150000;

/** Patterns for "Servicio de inyección" (Patient brings med or specific injection service) */
const INJECTION_PATTERNS = [
  /\bdupixent\b/i, // DUPIXENT - biologic medication patient brings for injection
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
const ATTENDED_PATTERNS = [/\blleg[oó]\b/i, /\basist[ií]o\b/i];
/** Patterns for explicit no-show / non-attendance */
const NOT_ATTENDED_PATTERNS = [
  /\bno\s+viene\b/i,
  /\bno\s+vino\b/i,
  /\bno\s+asiste\b/i,
  /\bno\s+asisti[oó]\b/i,
  /\bno\s+podr[áa]\s+asistir\b/i,
  /\bno\s+podr[áa]\s+venir\b/i,
];
/** Patterns for confirmation of future attendance (not attended yet) */
const PENDING_CONFIRMATION_PATTERNS = [/\bconfirma\b/i, /\bconfirmado\b/i, /\bconfirmada\b/i];

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
  /\bvacuna\s+mensual\s+clustoid\b/i, // "vacuna mensual clustoid" = maintenance
  // NOTE: Removed "dosis clustoid" - it conflicts with "2da dosis clustoid" which is induction
  /\(\s*50\s*\)/i, // (50) - parenthesized 50 indicates maintenance dose
  /\b50\s*(?:$|\))/i, // "50" at end of text or before closing paren
  /\brefuerzo\b/i, // refuerzo (booster) = maintenance
];

/** Patterns for dosage extraction */
const DOSAGE_PATTERNS = [
  /(\d+(?:[.,]\d+)?)\s*ml\b/i,
  /(\d+(?:[.,]\d+)?)\s*cc\b/i,
  /(\d+(?:[.,]\d+)?)\s*mg\b/i,
  // Match: 0,2ml( - dosage with opening paren directly after (no space)
  /(\d+[.,]\d+)\s*ml\s*\(/i,
];

/** Pattern for S/C (sin costo) */
const SIN_COSTO_PATTERN = /\bs\/?c\b|sincosto|sin\s*costo/i;

/** Patterns for money confirmation (paid) */
const MONEY_CONFIRMED_PATTERNS = [
  /\blleg[oó]\b/i,
  /\benv[ií][oó]\b/i,
  /\btransferencia\b/i,
  /\bpagado\b/i,
];

/** Patterns for domicilio (home visit) to mark as paid and track home delivery */
const DOMICILIO_PATTERNS = [
  /\bdomicilio\b/i,
  /\bse\s+la\s+llevo\b/i, // "se la llevo"
  /\bse\s+la\s+llev[oó]\b/i, // "se la llevo" with accent variations
  /\bse\s+lo\s+llevo\b/i, // "se lo llevo" (masculine variant)
  /\bse\s+lo\s+llev[oó]\b/i,
];

/** Phone number patterns to exclude from amount parsing */
const PHONE_PATTERNS = [
  /^9\d{8}$/, // 9XXXXXXXX (Chilean mobile)
  /^569\d{8}$/, // 569XXXXXXXX
  /^56\d{9}$/, // 56XXXXXXXXX
];

/** Amount parsing helper patterns */
const SLASH_FORMAT_PATTERN = /^\d+\s*\/\s*\d+$/; // Detect "paid/expected" format like "25/50"
const PAGADO_KEYWORD_PATTERN = /pagado/i; // Detect "pagado" keyword in parenthesized amounts
const AMOUNT_AT_END_PATTERN = /\s(\d{2,3})\s*$/; // Detect amount at end of text (fallback)
const DATE_PATTERN = /\b\d{1,2}[-]\d{1,2}\b/g; // Date pattern to remove from amount content
const AMOUNT_CONTEXT_PATTERN =
  /\b(?:test|examen(?:es)?|ambient(?:e|al)|consulta|control|parche)\s*(?:de\s+parche)?\s*(\d{2,3})\b/gi;
const READY_KEYWORD_PATTERN = /\blisto\b/i;

/** Dosage extraction helper patterns */
const CLUSTOID_DOSAGE_PATTERN = /clust(?:oid)?\s*(0[.,]\d+)/i; // "clustoid0,3" format
const DECIMAL_STANDALONE_PATTERN = /\b(0[.,]\d+)\b/; // Standalone decimal like "0,5"

/** Treatment stage helper patterns */
const HALF_ML_PATTERN = /0[.,]5(\s*ml)?\b/i; // 0.5 ml indicator for maintenance

/** Dosage parsing pattern */

// ============================================================================
// VALIDATION & SCHEMAS
// ============================================================================

const NormalizedTextSchema = z
  .string()
  .nullish()
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
  if (!value) {
    return null;
  }
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
  // Handle "mil" suffix (e.g. "30mil" → "30000")
  const withMilExpanded = raw.replace(/(\d+)\s*mil(?:es)?\b/gi, (_, num) => {
    return String(Number.parseInt(num, 10) * 1000);
  });

  const digits = withMilExpanded.replace(/[^0-9]/g, "");
  if (!digits) {
    return null;
  }

  // Skip phone numbers
  if (PHONE_PATTERNS.some((p) => p.test(digits))) {
    return null;
  }

  // Skip very long digit strings (likely RUTs, IDs, or multiple numbers merged)
  // Valid amounts are typically 2-6 digits (e.g. 20, 50, 30000, 100000)
  if (digits.length > 8) {
    return null;
  }

  const value = Number.parseInt(digits, 10);
  if (Number.isNaN(value) || value <= 0) {
    return null;
  }

  // Normalize: values < 1000 are multiplied by 1000 (e.g., 50 → 50000)
  const normalized = value >= 1000 ? value : value * 1000;

  // Validate range (silently skip unreasonable amounts)
  if (normalized > MAX_INT32 || normalized > MAX_REASONABLE_AMOUNT) {
    return null;
  }

  return normalized;
}

type AmountExtraction = {
  amountExpected: number | null;
  amountPaid: number | null;
};

function applySlashAmounts(text: string, amounts: AmountExtraction) {
  const slashPattern = /\((\d+)\s*\/\s*(\d+)\)/gi;
  for (
    let slashMatch = slashPattern.exec(text);
    slashMatch !== null;
    slashMatch = slashPattern.exec(text)
  ) {
    const paid = normalizeAmountRaw(slashMatch[1]);
    const expected = normalizeAmountRaw(slashMatch[2]);
    if (paid != null && amounts.amountPaid == null) {
      amounts.amountPaid = paid;
    }
    if (expected != null && amounts.amountExpected == null) {
      amounts.amountExpected = expected;
    }
  }
}

function applyParenAmounts(text: string, amounts: AmountExtraction) {
  const parenPattern = /\(([^)]*?)(?:\)|$)/gi;
  for (let match = parenPattern.exec(text); match !== null; match = parenPattern.exec(text)) {
    let content = match[1];
    if (SLASH_FORMAT_PATTERN.test(content)) {
      continue;
    }

    content = content.replace(DATE_PATTERN, "");

    const numericPart = content.match(AMOUNT_START_PATTERN);
    const normalizedContent = numericPart ? numericPart[0] : content;
    const amount = normalizeAmountRaw(normalizedContent);
    if (amount == null) {
      continue;
    }

    if (PAGADO_KEYWORD_PATTERN.test(content)) {
      amounts.amountPaid = amount;
      if (amounts.amountExpected == null) {
        amounts.amountExpected = amount;
      }
      continue;
    }

    if (amounts.amountExpected == null) {
      amounts.amountExpected = amount;
    }
  }
}

function applyTypoAndMlFallback(text: string, amounts: AmountExtraction) {
  if (amounts.amountExpected != null) {
    return;
  }

  const typoPattern = /[a-z](\d+)\)/gi;
  for (
    let typoMatch = typoPattern.exec(text);
    typoMatch !== null;
    typoMatch = typoPattern.exec(text)
  ) {
    const digits = typoMatch[1];
    const lastTwo = digits.length >= 2 ? digits.slice(-2) : digits;
    const amount = normalizeAmountRaw(lastTwo);
    if (amount != null && amounts.amountExpected == null) {
      amounts.amountExpected = amount;
    }
  }

  const mlPattern = /ml\s*\((\d+\s*mil)/gi;
  for (let mlMatch = mlPattern.exec(text); mlMatch !== null; mlMatch = mlPattern.exec(text)) {
    const amount = normalizeAmountRaw(mlMatch[1]);
    if (amount != null && amounts.amountExpected == null) {
      amounts.amountExpected = amount;
    }
  }
}

function applyKeywordFallback(text: string, amounts: AmountExtraction) {
  if (amounts.amountExpected != null) {
    return;
  }

  const keywordPattern =
    /(?:cl[au]s[i]?t[oau]?id[eo]?|cluxin|alxoid|oral[-\s]?tec|vacuna|[aá]caros?)\s+(\d{2,3})\b/gi;
  for (
    let kwMatch = keywordPattern.exec(text);
    kwMatch !== null;
    kwMatch = keywordPattern.exec(text)
  ) {
    const amount = normalizeAmountRaw(kwMatch[1]);
    if (amount != null) {
      amounts.amountExpected = amount;
      break;
    }
  }
}

function applyContextualAmountFallback(text: string, amounts: AmountExtraction) {
  if (amounts.amountExpected != null) {
    return;
  }

  for (
    let match = AMOUNT_CONTEXT_PATTERN.exec(text);
    match !== null;
    match = AMOUNT_CONTEXT_PATTERN.exec(text)
  ) {
    const amount = normalizeAmountRaw(match[1]);
    if (amount != null) {
      amounts.amountExpected = amount;
      break;
    }
  }
}

function applyEndAmountFallback(text: string, amounts: AmountExtraction) {
  if (amounts.amountExpected != null) {
    return;
  }

  const endMatch = AMOUNT_AT_END_PATTERN.exec(text);
  if (!endMatch) {
    return;
  }

  const amount = normalizeAmountRaw(endMatch[1]);
  if (amount != null) {
    amounts.amountExpected = amount;
  }
}

function applyPaidPattern(text: string, amounts: AmountExtraction) {
  const paidPattern = /pagado\s*(\d+)/gi;
  for (
    let matchPaid = paidPattern.exec(text);
    matchPaid !== null;
    matchPaid = paidPattern.exec(text)
  ) {
    const amount = normalizeAmountRaw(matchPaid[1]);
    if (amount == null) {
      continue;
    }

    amounts.amountPaid = amount;
    if (amounts.amountExpected == null) {
      amounts.amountExpected = amount;
    }
  }
}

function extractAmounts(summary: string, description: string) {
  const amounts: AmountExtraction = {
    amountExpected: null,
    amountPaid: null,
  };
  const text = `${summary} ${description}`;

  applySlashAmounts(text, amounts);
  applyParenAmounts(text, amounts);
  applyTypoAndMlFallback(text, amounts);
  applyKeywordFallback(text, amounts);
  applyContextualAmountFallback(text, amounts);
  applyEndAmountFallback(text, amounts);
  applyPaidPattern(text, amounts);

  // 6. S/C (sin costo) = 0
  if (
    SIN_COSTO_PATTERN.test(text) &&
    amounts.amountExpected == null &&
    amounts.amountPaid == null
  ) {
    amounts.amountExpected = 0;
    amounts.amountPaid = 0;
  }

  return amounts;
}

function refineAmounts(
  amounts: { amountExpected: number | null; amountPaid: number | null },
  summary: string,
  description: string,
) {
  const text = `${summary} ${description}`;
  const isNotAttended = matchesAny(text, NOT_ATTENDED_PATTERNS);
  const isPendingConfirmation = matchesAny(text, PENDING_CONFIRMATION_PATTERNS);
  const isConfirmed = matchesAny(text, MONEY_CONFIRMED_PATTERNS);

  // Explicit no-show means no payment (hard business rule).
  if (isNotAttended) {
    return { ...amounts, amountPaid: 0 };
  }

  // Pending confirmation means no payment yet.
  if (isPendingConfirmation && amounts.amountPaid != null) {
    return { ...amounts, amountPaid: null };
  }

  // If confirmed (llegó, envio, etc.) and only expected is set, assume paid
  if (isConfirmed && amounts.amountExpected != null && amounts.amountPaid == null) {
    return { ...amounts, amountPaid: amounts.amountExpected };
  }

  const isDomicilio = matchesAny(text, DOMICILIO_PATTERNS);
  if (isDomicilio && amounts.amountExpected != null) {
    if (amounts.amountPaid == null || amounts.amountPaid === 0) {
      return { ...amounts, amountPaid: amounts.amountExpected };
    }
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

  // Priority order: Test → Injection Service (specific meds) → Subcutáneo (explicit) → Roxair → Licencia → Control → Consulta → Subcutáneo (implicit)
  if (matchesAny(text, TEST_PATTERNS)) {
    return "Test y exámenes";
  }

  // Injection service check - must come BEFORE subcutaneous to prioritize specific meds like Dupixent
  if (matchesAny(text, INJECTION_PATTERNS)) {
    return "Servicio de inyección";
  }

  // Explicit Subcutaneous keywords (strong signals)
  if (matchesAny(text, SUBCUT_PATTERNS)) {
    return "Tratamiento subcutáneo";
  }

  if (matchesAny(text, ROXAIR_PATTERNS)) {
    return "Roxair";
  }

  if (matchesAny(text, LICENCIA_PATTERNS)) {
    return "Licencia médica";
  }
  if (matchesAny(text, CONTROL_PATTERNS)) {
    return "Control médico";
  }
  if (matchesAny(text, CONSULTA_PATTERNS)) {
    return "Consulta médica";
  }

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
  if (matchesAny(text, NOT_ATTENDED_PATTERNS)) {
    return false;
  }
  return matchesAny(text, ATTENDED_PATTERNS) ? true : null;
}

// Helper pattern extracted to top-level
const AMOUNT_START_PATTERN = /^[\d\s,./]*(?:mil)*\b/;

/** Parse explicit dosage like "0.5 ml" */
function parseExplicitDosage(text: string): { value: number; unit: string } | null {
  for (const pattern of DOSAGE_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) {
      continue;
    }

    const valueRaw = match[1]?.replace(",", ".") ?? "";
    const unit = match[0]
      .replace(match[1] ?? "", "")
      .trim()
      .toLowerCase();

    if (!valueRaw) {
      continue;
    }

    const value = Number.parseFloat(valueRaw);
    if (Number.isFinite(value)) {
      return { value, unit: unit || "ml" };
    }
  }
  return null;
}

function extractDosage(
  summary: string,
  description: string,
): { value: number; unit: string } | null {
  const text = `${summary} ${description}`;

  // 1. Try explicit dosage patterns (0.5 ml, 1 cc, etc.)
  const explicit = parseExplicitDosage(text);
  if (explicit) {
    return explicit;
  }

  // 2. Pattern for clustoid+dosage format without space: "clustoid0,3", "clustoid0,1"
  const clustoidDosageMatch = CLUSTOID_DOSAGE_PATTERN.exec(text);
  if (clustoidDosageMatch) {
    const value = Number.parseFloat(clustoidDosageMatch[1].replace(",", "."));
    if (Number.isFinite(value)) {
      return { value, unit: "ml" };
    }
  }

  // 3. Fallback: standalone decimal (e.g. "0,5") implies "ml" in this context
  const decimalMatch = DECIMAL_STANDALONE_PATTERN.exec(text);
  if (decimalMatch) {
    const value = Number.parseFloat(decimalMatch[1].replace(",", "."));
    if (Number.isFinite(value)) {
      return { value, unit: "ml" };
    }
  }

  // NOTE: We do NOT assume a default dosage from patterns anymore.
  // Dosage must be explicitly stated in the text.
  return null;
}

function detectTreatmentStage(summary: string, description: string): string | null {
  const text = `${summary} ${description}`;

  // Induction takes priority (e.g. "2da dosis clustoid" is Induction, even if "dosis clustoid" looks like maintenance)
  if (matchesAny(text, INDUCTION_PATTERNS)) {
    return "Inducción";
  }

  // Maintenance keywords or 0.5 (with or without ml) = Mantención
  if (matchesAny(text, MAINTENANCE_PATTERNS) || HALF_ML_PATTERN.test(text)) {
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
  const text = `${summary} ${description}`;

  const rawAmounts = extractAmounts(summary, description);
  const amounts = refineAmounts(rawAmounts, summary, description);
  const category = classifyCategory(summary, description);
  const attended = detectAttendance(summary, description);
  const dosage = extractDosage(summary, description);
  const treatmentStage = detectTreatmentStage(summary, description);
  const controlIncluded = matchesAny(text, CONTROL_PATTERNS);
  const isDomicilio = matchesAny(text, DOMICILIO_PATTERNS);
  const isRoxair = category === "Roxair";
  const hasReadyKeyword = READY_KEYWORD_PATTERN.test(text);
  const finalAttended = attended ?? (isRoxair && hasReadyKeyword ? true : null);

  // Logic: Dosage and Treatment Stage only apply to "Tratamiento subcutáneo"
  const isSubcut = category === "Tratamiento subcutáneo";

  // Determine treatment stage:
  // 1. Pattern-based detection takes priority (e.g., "3era dosis" = Inducción even if 0.5ml)
  // 2. Only use ml-based inference as fallback when no explicit pattern matched
  let finalTreatmentStage = isSubcut ? treatmentStage : null;
  if (isSubcut && dosage && treatmentStage === null) {
    // Only apply ml-based rule if no explicit pattern matched
    const dosageValue = dosage.value;
    if (dosageValue !== null) {
      // Business rule: < 0.5 ml = Inducción, >= 0.5 ml = Mantención
      // This is a FALLBACK only - explicit patterns like "3era dosis" override this
      finalTreatmentStage = dosageValue < 0.5 ? "Inducción" : "Mantención";
    }
  }

  const finalAmountExpected = isRoxair
    ? (amounts.amountExpected ?? ROXAIR_DEFAULT_AMOUNT)
    : amounts.amountExpected;
  const roxairLikelyPaid =
    isRoxair && (finalAttended === true || matchesAny(text, MONEY_CONFIRMED_PATTERNS));
  const finalAmountPaid =
    finalAttended === false
      ? 0
      : (amounts.amountPaid ?? (roxairLikelyPaid ? finalAmountExpected : null));

  return {
    category,
    amountExpected: finalAmountExpected,
    amountPaid: finalAmountPaid,
    attended: finalAttended,
    dosageValue: isSubcut && dosage ? dosage.value : null,
    dosageUnit: isSubcut && dosage ? dosage.unit : null,
    treatmentStage: finalTreatmentStage,
    controlIncluded,
    isDomicilio,
  };
}

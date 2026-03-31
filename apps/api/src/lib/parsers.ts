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
import { joinClinicalText, normalizeClinicalText } from "./clinical-text";

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
export const TEST_SUBTYPE_CHOICES = ["Test cutáneo", "Test de parche"] as const;
export const PATCH_READING_CHOICES = ["1ra lectura", "2da lectura", "3ra lectura"] as const;

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
  clinicalSeriesKind: "PATCH_TEST" | "SKIN_TEST" | "SUBCUTANEOUS_TREATMENT" | null;
  seriesStageKind: "DOSE" | "INSTALLATION" | "MAINTENANCE" | "READING" | null;
  seriesStageLabel: string | null;
  seriesStageNumber: number | null;
  testMetadata: {
    firstReading: boolean;
    patchTest: boolean;
    secondReading: boolean;
    skinTest: boolean;
    thirdReading: boolean;
  } | null;
};

type ClinicalSeriesKind = ParsedCalendarMetadata["clinicalSeriesKind"];
type ClinicalSeriesStageKind = ParsedCalendarMetadata["seriesStageKind"];

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
  /\b(cuarta|quinta|sexta|s[eé]ptima|octava|novena|d[eé]cima)\s+dosis\b/i, // word-form ordinals
  /\bgram[íi]neas?\b/i, // gramíneas / gramineas allergen vaccine
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
  /lectu?ra\s*(de\s*)?parche/i, // lectura/lecura de parche (typo-tolerant)
  /\d+(era|da|ra)?\s*test/i, // 1eratest
  /lleg[oó]\s*test/i, // llegotest
  /\d+(era|da|ra)?\s*lectu?ra\b/i, // 2da lectura / 1ra lecura (typo-tolerant)
  /\btest\b/i,
  /\bparche\b/i, // standalone "parche" always means test de parche
  /cut[áa]neo/i,
  /ambiental/i,
  /panel/i,
  /multi\s*tes?t?/i, // multitest
  /prick/i, // prick test
  /aeroal[eé]rgenos?/i, // aeroalergenos
];
const TEST_CUTANEO_PATTERNS = [/\btest\s*cut[áa]neo\b/i, /\bprick\b/i, /multi\s*tes?t?/i];
const TEST_PARCHE_PATTERNS = [/\btest\s*(de\s*)?parche\b/i, /\bparche\b/i];
const TEST_PARCHE_1_READING_PATTERNS = [
  /\b1(?:ra|era|a|ª|º)?\s*lectura\b/i,
  /\bprimera\s*lectura\b/i,
];
const TEST_PARCHE_2_READING_PATTERNS = [/\b2(?:da|a|ª|º)?\s*lectura\b/i, /\bsegunda\s*lectura\b/i];
const TEST_PARCHE_3_READING_PATTERNS = [
  /\b3(?:ra|era|a|ª|º)?\s*lectura\b/i,
  /\btercera\s*lectura\b/i,
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
  /^horario\b/i, // "horario vacunas mañana" — schedule reminders, not patient events
];

/** Patterns for attendance confirmation */
const ATTENDED_PATTERNS = [
  /\bll+eg[oóp]\b/i, // llego, lllego, llegp
  /ll+eg[oóp](?=[a-záéíóúñ])/i, // llegoKatherine
  /\basist[ií]o\b/i,
];
/** Patterns for explicit no-show / non-attendance */
const NOT_ATTENDED_PATTERNS = [
  /\bno\s+viene\b/i,
  /\bno\s+vino\b/i,
  /\bno\s+asiste\b/i,
  /\bno\s+asisti[oó]\b/i,
  /\bno\s+podr[áa]\s+asistir\b/i,
  /\bno\s+podr[áa]\s+venir\b/i,
  /\bcancel[oó]\s+la\s+hora\b/i,
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
  /\b[2-5][º°]?(?:era|da|ra|ta|va|a)?\s*dosis\b/i,

  // Text variants
  /(?:segunda|tercera|cuarta|quinta)\s*dosis\b/i,
];

/** Patterns for maintenance stage */
const MAINTENANCE_PATTERNS = [
  /\bmantenci[oó]n\b/i, // mantención, mantencion
  /\bmantencio\b/i, // typo: missing final 'n'
  /\bmant\b/i, // abbreviated
  /\bmensual\b/i, // monthly
  /\bmesual\b/i, // typo: mensual
  /\bmensaul\b/i, // typo: mensual
  /\bvacuna\s+mensual\s+clustoid\b/i, // "vacuna mensual clustoid" = maintenance
  // NOTE: Removed "dosis clustoid" - it conflicts with "2da dosis clustoid" which is induction
  /\(\s*50\s*\)/i, // (50) - parenthesized 50 indicates maintenance dose
  /\(\s*60\s*\)/i, // (60) is also maintenance in local business rule
  /\b50\s*(?:$|\))/i, // "50" at end of text or before closing paren
  /\b60\s*(?:$|\))/i, // "60" at end of text or before closing paren
  /\brefuerzo\b/i, // refuerzo (booster) = maintenance
];
const DOSE_CLUSTOID_PATTERN = /\bdosis\s+clust(?:oid)?\b/i;

/** Patterns for dosage extraction */
const DOSAGE_PATTERNS = [
  /(\d+(?:[.,]\d+)?)\s*ml\b/i,
  /(\d+(?:[.,]\d+)?)\s*cc\b/i,
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
  /\bse\s+la\s+lleva\b/i, // "se la lleva"
  /\bse\s+la\s+llevo\b/i, // "se la llevo"
  /\bse\s+la\s+llev[oó]\b/i, // "se la llevo" with accent variations
  /\bse\s+lo\s+lleva\b/i, // "se lo lleva"
  /\bse\s+lo\s+llevo\b/i, // "se lo llevo" (masculine variant)
  /\bse\s+lo\s+llev[oó]\b/i,
  /\bse\s+llev[oó]\b/i, // "se llevo ..."
  /\bse\s+envia\b/i, // "se envia ..."
  /\bse\s+envi[oó]\b/i, // "se envio ..."
  /\bse\s+envi[oó]\s+pagad[ao]\b/i, // "se envio pagada/o"
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
const PAREN_DECIMAL_DOSAGE_PATTERN = /^\s*0[.,]\d+\s*$/; // "(0,5)" is dosage, not amount
const AMOUNT_AT_END_PATTERN = /\s(\d{2,3})\s*\)?\s*$/; // Detect amount at end of text, with optional trailing ')'
const DATE_PATTERN = /\b\d{1,2}[-]\d{1,2}\b/g; // Date pattern to remove from amount content
const AMOUNT_CONTEXT_PATTERN =
  /\b(?:test|examen(?:es)?|ambient(?:e|al)|consulta|control|parche)\s*(?:de\s+parche)?\s*(\d{2,3})\b/gi;
const READY_KEYWORD_PATTERN = /\blisto\b/i;
const ORDINAL_DOSIS_PATTERN =
  /\b(?:\d{1,2}\s*(?:era|ra|da|ta|va|er|[º°])|primera|segunda|tercera|cuarta|quinta)\b/i;
const DOSIS_KEYWORD_PATTERN = /\bdosis\b/i;

/** Dosage extraction helper patterns */
const CLUSTOID_DOSAGE_PATTERN = /clust(?:oid)?\s*(0[.,]\d+)/i; // "clustoid0,3" format
const DECIMAL_STANDALONE_PATTERN = /\b(0[.,]\d+)\b/; // Standalone decimal like "0,5"

/** Treatment stage helper patterns */
const HALF_ML_PATTERN = /0[.,]5(\s*ml)?\b/i; // 0.5 ml indicator for maintenance

const ORDINAL_TEXT_TO_NUMBER: Array<[number, RegExp]> = [
  [1, /\b(?:1[º°]?(?:era|ra|er)?|prim(?:er)?a?|pr[im]+[er]*a)\b/i],
  [2, /\b(?:2[º°]?(?:da|a)?|segunda)\b/i],
  [3, /\b(?:3[º°]?(?:ra|era|a)?|tercera)\b/i],
  [4, /\b(?:4[º°]?(?:ta|a)?|cuarta)\b/i],
  [5, /\b(?:5[º°]?(?:ta|va|a)?|quinta)\b/i],
  [6, /\b(?:6[º°]?(?:ta|a)?|sexta)\b/i],
  [7, /\b(?:7[º°]?(?:ma|a)?|septima|séptima)\b/i],
  [8, /\b(?:8[º°]?(?:va|a)?|octava)\b/i],
  [9, /\b(?:9[º°]?(?:na|a)?|novena)\b/i],
];

/** Dosage parsing pattern */

// ============================================================================
// VALIDATION & SCHEMAS
// ============================================================================

const NormalizedTextSchema = z
  .string()
  .nullish()
  .transform((value) => normalizeClinicalText(value).normalize("NFC"));

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
  const text = normalizeClinicalText(summary).toLowerCase();
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
    if (PAREN_DECIMAL_DOSAGE_PATTERN.test(content)) {
      continue;
    }

    // Ignore ordinal-dose markers like "(1era dosis)" that are not monetary amounts.
    if (DOSIS_KEYWORD_PATTERN.test(content) && ORDINAL_DOSIS_PATTERN.test(content)) {
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
  const text = joinClinicalText(summary, description);

  applySlashAmounts(text, amounts);
  applyParenAmounts(text, amounts);
  applyTypoAndMlFallback(text, amounts);
  applyKeywordFallback(text, amounts);
  applyContextualAmountFallback(text, amounts);
  // Check summary alone first: "N)" may appear at end of summary even when
  // description text follows (e.g. "(3era dosis) 40)" followed by patient info).
  applyEndAmountFallback(summary, amounts);
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
  const text = joinClinicalText(summary, description);
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
  const text = joinClinicalText(summary, description).toLowerCase();
  const summaryOnly = normalizeClinicalText(summary).toLowerCase();

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
  const text = joinClinicalText(summary, description);
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
  const text = joinClinicalText(summary, description);

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

function normalizeSubcutaneousDosage(
  dosage: null | { value: number; unit: string },
): null | { value: number; unit: "ml" } {
  if (!dosage) return null;

  const normalizedUnit = dosage.unit.trim().toLowerCase();
  if (normalizedUnit !== "ml" && normalizedUnit !== "cc") {
    return null;
  }

  // En inmunoterapia subcutánea trabajamos en mL y con volúmenes fraccionarios acotados.
  // Valores enteros altos como "10 mg" o "10 ml" no representan una dosis válida en este flujo.
  if (!Number.isFinite(dosage.value) || dosage.value <= 0 || dosage.value > 1) {
    return null;
  }

  return { unit: "ml", value: dosage.value };
}

function detectTreatmentStage(summary: string, description: string): string | null {
  const text = joinClinicalText(summary, description);

  // Explicit maintenance keywords take priority over ordinal induction markers.
  // e.g. "5ta dosis mensual clustoid" → Mantención (not "5ta dosis")
  if (matchesAny(text, MAINTENANCE_PATTERNS)) {
    return "Mantención";
  }

  // Induction: numbered doses 1-5 with no maintenance markers present.
  if (matchesAny(text, INDUCTION_PATTERNS)) {
    return "Inducción";
  }

  // "dosis clustoid" without ordinal marker defaults to maintenance.
  if (DOSE_CLUSTOID_PATTERN.test(text) && !ORDINAL_DOSIS_PATTERN.test(text)) {
    return "Mantención";
  }

  // 0.5 ml as low-priority fallback (after ordinal check to avoid overriding e.g. "3era dosis 0.5ml")
  if (HALF_ML_PATTERN.test(text)) {
    return "Mantención";
  }

  return null;
}

function detectTestMetadata(
  summary: string,
  description: string,
  category: string | null,
): ParsedCalendarMetadata["testMetadata"] {
  if (category !== "Test y exámenes") {
    return null;
  }

  const normalizedText = joinClinicalText(summary, description);
  const firstReading = matchesAny(normalizedText, TEST_PARCHE_1_READING_PATTERNS);
  const secondReading = matchesAny(normalizedText, TEST_PARCHE_2_READING_PATTERNS);
  const thirdReading = matchesAny(normalizedText, TEST_PARCHE_3_READING_PATTERNS);
  const hasAnyReading = firstReading || secondReading || thirdReading;

  const skinTest = matchesAny(normalizedText, TEST_CUTANEO_PATTERNS);
  const patchTest = matchesAny(normalizedText, TEST_PARCHE_PATTERNS) || hasAnyReading;

  return {
    firstReading,
    patchTest,
    secondReading,
    skinTest,
    thirdReading,
  };
}

function detectOrdinalNumber(text: string, nounPattern: RegExp): number | null {
  const normalizedOrdinalText = text
    .replace(
      new RegExp(String.raw`([\p{L}])(\d{1,2})(?=\s*${nounPattern.source}\b)`, "giu"),
      "$1 $2",
    )
    .replace(
      new RegExp(String.raw`(\d{1,2})([\p{L}]+)(?=\s*${nounPattern.source}\b)`, "giu"),
      "$1 $2",
    );

  const directMatch = normalizedOrdinalText.match(
    new RegExp(
      String.raw`\b(\d{1,2})[º°]?(?:era|ra|da|ta|va|ma|na|a)?\s*${nounPattern.source}\b`,
      "i",
    ),
  );
  if (directMatch?.[1]) {
    const parsed = Number.parseInt(directMatch[1], 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  for (const [value, pattern] of ORDINAL_TEXT_TO_NUMBER) {
    if (pattern.test(normalizedOrdinalText) && nounPattern.test(normalizedOrdinalText)) {
      return value;
    }
  }

  return null;
}

function formatOrdinalLabel(value: number, noun: string): string {
  const suffix =
    value === 1
      ? "ra"
      : value === 2
        ? "da"
        : value === 3
          ? "ra"
          : value === 4
            ? "ta"
            : value === 5
              ? "ta"
              : "a";
  return `${value}${suffix} ${noun}`;
}

function buildSeriesMetadata(params: {
  category: string | null;
  summary: string;
  description: string;
  testMetadata: ParsedCalendarMetadata["testMetadata"];
  treatmentStage: string | null;
}): {
  clinicalSeriesKind: ClinicalSeriesKind;
  seriesStageKind: ClinicalSeriesStageKind;
  seriesStageLabel: string | null;
  seriesStageNumber: number | null;
} {
  const normalizedText = joinClinicalText(params.summary, params.description);
  const isTest = params.category === "Test y exámenes";
  const isSubcut = params.category === "Tratamiento subcutáneo";

  if (isTest) {
    const readingNumber = params.testMetadata?.firstReading
      ? 1
      : params.testMetadata?.secondReading
        ? 2
        : params.testMetadata?.thirdReading
          ? 3
      : detectOrdinalNumber(normalizedText, /lectura/);

    const clinicalSeriesKind: ClinicalSeriesKind = params.testMetadata?.patchTest
      ? "PATCH_TEST"
      : params.testMetadata?.skinTest
        ? "SKIN_TEST"
        : null;

    if (readingNumber != null) {
      return {
        clinicalSeriesKind,
        seriesStageKind: "READING" as const,
        seriesStageLabel: formatOrdinalLabel(readingNumber, "lectura"),
        seriesStageNumber: readingNumber,
      };
    }

    if (clinicalSeriesKind) {
      return {
        clinicalSeriesKind,
        seriesStageKind: "INSTALLATION" as const,
        seriesStageLabel: "Instalación",
        seriesStageNumber: 0,
      };
    }
  }

  if (isSubcut) {
    // Mantención takes priority — explicit maintenance keywords override ordinal numbers.
    // e.g. "5ta dosis mensual clustoid" → MAINTENANCE, not "5ta dosis"
    if (params.treatmentStage === "Mantención") {
      return {
        clinicalSeriesKind: "SUBCUTANEOUS_TREATMENT" as const,
        seriesStageKind: "MAINTENANCE" as const,
        seriesStageLabel: "Mantención",
        seriesStageNumber: null,
      };
    }

    const doseNumber = detectOrdinalNumber(normalizedText, /dosis/);
    if (doseNumber != null) {
      return {
        clinicalSeriesKind: "SUBCUTANEOUS_TREATMENT" as const,
        seriesStageKind: "DOSE" as const,
        seriesStageLabel: formatOrdinalLabel(doseNumber, "dosis"),
        seriesStageNumber: doseNumber,
      };
    }

    if (params.treatmentStage === "Inducción") {
      return {
        clinicalSeriesKind: "SUBCUTANEOUS_TREATMENT" as const,
        seriesStageKind: "DOSE" as const,
        seriesStageLabel: "Dosis de inducción",
        seriesStageNumber: null,
      };
    }
  }

  return {
    clinicalSeriesKind: null,
    seriesStageKind: null,
    seriesStageLabel: null,
    seriesStageNumber: null,
  };
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export function parseCalendarMetadata(input: {
  summary?: string | null;
  description?: string | null;
}): ParsedCalendarMetadata {
  const { summary, description } = CalendarEventTextSchema.parse(input);
  const text = joinClinicalText(summary, description);

  const rawAmounts = extractAmounts(summary, description);
  const amounts = refineAmounts(rawAmounts, summary, description);
  const category = classifyCategory(summary, description);
  const attended = detectAttendance(summary, description);
  const rawDosage = extractDosage(summary, description);
  const treatmentStage = detectTreatmentStage(summary, description);
  const controlIncluded = matchesAny(text, CONTROL_PATTERNS);
  const isDomicilio = matchesAny(text, DOMICILIO_PATTERNS);
  const testMetadata = detectTestMetadata(summary, description, category);
  const hasPatchReading = Boolean(
    testMetadata?.firstReading || testMetadata?.secondReading || testMetadata?.thirdReading,
  );
  const hasReadyKeyword = READY_KEYWORD_PATTERN.test(text);
  const isRoxair = category === "Roxair";
  const finalAttended = attended ?? (isDomicilio || hasReadyKeyword ? true : null);

  // Logic: Dosage and Treatment Stage only apply to "Tratamiento subcutáneo"
  const isSubcut = category === "Tratamiento subcutáneo";
  const dosage = isSubcut ? normalizeSubcutaneousDosage(rawDosage) : null;

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
  const testReadingExpectedAmount =
    category === "Test y exámenes" && hasPatchReading ? 0 : finalAmountExpected;

  // Amount-based fallback for subcutaneous events when stage is still unknown:
  // 50k/60k => maintenance, other positive amounts => induction.
  if (
    isSubcut &&
    finalTreatmentStage === null &&
    finalAmountExpected != null &&
    finalAmountExpected > 0
  ) {
    finalTreatmentStage =
      finalAmountExpected === 50000 || finalAmountExpected === 60000 ? "Mantención" : "Inducción";
  }

  // Maintenance defaults to 0.5 ml when dosage wasn't explicit.
  const finalDosageValue =
    isSubcut && finalTreatmentStage === "Mantención" && dosage == null
      ? 0.5
      : isSubcut && dosage
        ? dosage.value
        : null;
  const finalDosageUnit =
    isSubcut && finalTreatmentStage === "Mantención" && dosage == null
      ? "ml"
      : isSubcut && dosage
        ? dosage.unit
        : null;

  const roxairLikelyPaid =
    isRoxair && (finalAttended === true || matchesAny(text, MONEY_CONFIRMED_PATTERNS));
  const finalAmountPaid =
    finalAttended === false
      ? 0
      : category === "Test y exámenes" && hasPatchReading
        ? 0
        : (amounts.amountPaid ?? (roxairLikelyPaid ? testReadingExpectedAmount : null));
  const seriesMetadata = buildSeriesMetadata({
    category,
    summary,
    description,
    testMetadata,
    treatmentStage: finalTreatmentStage,
  });

  return {
    category,
    clinicalSeriesKind: seriesMetadata.clinicalSeriesKind,
    amountExpected: testReadingExpectedAmount,
    amountPaid: finalAmountPaid,
    attended: finalAttended,
    dosageValue: finalDosageValue,
    dosageUnit: finalDosageUnit,
    seriesStageKind: seriesMetadata.seriesStageKind,
    seriesStageLabel: seriesMetadata.seriesStageLabel,
    seriesStageNumber: seriesMetadata.seriesStageNumber,
    treatmentStage: finalTreatmentStage,
    controlIncluded,
    isDomicilio,
    testMetadata,
  };
}

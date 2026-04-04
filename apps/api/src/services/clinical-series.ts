import { db, kysely } from "@finanzas/db";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
import { sql } from "kysely";
import { joinClinicalText, normalizeClinicalText } from "../lib/clinical-text";
import { parseCalendarMetadata } from "../lib/parsers";
import { normalizeRut, validateRut } from "../lib/rut";

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = "America/Santiago";
const RUT_REGEX = /\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]\b/g;
const TIME_REGEX = /\b\d{1,2}:\d{2}\b/g;
const AGE_REGEX =
  /\b\d{1,3}\s*(?:a[ñn]os?|a)(?:\s+\d{1,2}\s*mes(?:es)?)?\b|\b\d{1,2}\s*mes(?:es)?\b/gi;
const LONG_NUMBER_REGEX = /\b\d{5,}\b/g;
const STANDALONE_NUMBER_REGEX = /\b\d+\b/g;
const SEPARATOR_REGEX = /[;:,()[\]{}/\\]+/g;
const LOWERCASE_NAME_STOPWORDS = new Set([
  // Allergy / treatment terms
  "acaro",
  "acaros",
  "administracion",
  "aeroalergenos",
  "alergia",
  "alergico",
  "alergica",
  "alergias",
  "alimento",
  "alimentario",
  "alimentos",
  "ambiente",
  "ampolla",
  "antigenos",
  "antihistaminico",
  "asma",
  "bronquial",
  "cholga",
  "clustoid",
  "confirma",
  "consulta",
  "cosulta",
  "control",
  "costo",
  "cutaneo",
  "cylondon",
  "dactilon",
  "diagnostico",
  "dosis",
  "entrega",
  "esquema",
  "examen",
  "fase",
  "frasco",
  "graminea",
  "gramineas",
  "infantil",
  "inicio",
  "inyeccion",
  "inmunoterapia",
  "instalacion",
  "lectura",
  "mantencion",
  "mas",
  "mensual",
  "mil",
  "papa",
  "pediatrico",
  "avisara",
  "cuando",
  "pueda",
  "realizara",
  "cuarta",
  "cuarto",
  "pagada",
  "pagado",
  "parche",
  "polen",
  "presento",
  "primera",
  "primero",
  "prueba",
  "quinta",
  "quinto",
  "reaccion",
  "refuerzo",
  "resfria",
  "retiro",
  "retoma",
  "segunda",
  "segundo",
  "semanal",
  "semana",
  "sexta",
  "sexto",
  "subcutaneo",
  "tercera",
  "tercero",
  "test",
  "tratamiento",
  "vacuna",
  // Vaccine / product names
  "alxoid",
  "clust",
  "clusitoid",
  "clustois",
  "cluxin",
  "clustek",
  "forte",
  "oid",
  "multitest",
  "oral",
  "roxair",
  "xolair",
  // Diagnostic / study names
  "aero",
  "ag",
  "civid",
  "confirmada",
  "mix",
  "panel",
  "prick",
  "pricktest",
  "testcutaneo",
  "vac",
  "vacunas",
  // Chilean health/admin terms that appear in clinical notes but are not names
  "aer",
  "ali",
  "aliment",
  "alergenos",
  "alergeno",
  "ban",
  "estandar",
  "standar",
  "amb",
  "ambiental",
  "ahora",
  "banmedica",
  "blanca",
  "boleta",
  "ccp",
  "comuna",
  "colmena",
  "consalud",
  "contacto",
  "dipreca",
  "domicilio",
  "dte",
  "edad",
  "evento",
  "florida",
  "fonasa",
  "gmail",
  "horario",
  "href",
  "hrs",
  "hualpen",
  "hualqui",
  "isapre",
  "manana",
  "mailto",
  "vida",
  "numero",
  "particular",
  "pago",
  "prevision",
  "rinitis",
  "rut",
  "target",
  "vincular",
  // Communes / cities that appear as patient origin but are not names
  "angeles",
  "cauquenes",
  "chiguayante",
  "chillan",
  "concepcion",
  "coronel",
  "linares",
  "lota",
  "alamos",
  "penco",
  "talcahuano",
  "tome",
  "yerbas",
  // Month names (appear as appointment date notes, not names)
  "enero",
  "febrero",
  "marzo",
  "abril",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
  // Relationship / family markers
  "mama",
  "mucho",
  // Scheduling / administrative action words
  "agendar",
  "agendara",
  "aparecer",
  "asistir",
  "avisar",
  "avisaron",
  "celular",
  "confirmar",
  "descartar",
  "entregar",
  "enviar",
  "enviara",
  "hacer",
  "imprimir",
  "ingresar",
  "llamar",
  "llamara",
  "mostrar",
  "porconfirmar",
  "postergar",
  "quiero",
  "reagendar",
  "reagendara",
  "respirar",
  "whatsapp",
  // Common Spanish words that appear in clinical notes but are not names
  "autorizado",
  "beneficiario",
  "carnet",
  "com",
  "nombre",
  "paciente",
  "como",
  "con",
  "del",
  "desde",
  "pendiente",
  "total",
  "doctor",
  "ella",
  "evaluacion",
  "este",
  "hace",
  "hijo",
  "hija",
  "llego",
  "lleva",
  "llevara",
  "llevo",
  "nueva",
  "nuevamas",
  "nuevo",
  "para",
  "pero",
  "por",
  "porque",
  "retiran",
  "humana",
  "sale",
  "sera",
  "solo",
  "tiene",
  "tomo",
  "trae",
  "traen",
  "venir",
  "vendra",
  "ver",
  "viene",
]);

type ClinicalSeriesKind = "PATCH_TEST" | "SKIN_TEST" | "SUBCUTANEOUS_TREATMENT";
type ClinicalSeriesStageKind = "DOSE" | "INSTALLATION" | "MAINTENANCE" | "READING";
type SubcutaneousAllergenType = "ACAROS" | "ACAROS_GRAMINEAS" | "GRAMINEAS";
type SubcutaneousVaccineProduct = "ALXOID" | "CLUSTOID" | "CLUSTOID_B120" | "CLUSTOID_FORTE" | "ORAL_TEC";
type HealthInsuranceType = "FONASA" | "ISAPRE" | "PARTICULAR";
type DeliveryModality = "DOMICILIO" | "PRESENCIAL";

type EventSeriesCandidate = {
  amountExpected: null | number;
  amountPaid: null | number;
  beneficiaryName: null | string;
  beneficiaryRut: null | string;
  calendarGoogleId: string;
  category: null | string;
  clinicalSeriesId: null | number;
  description: null | string;
  eventDate: string;
  eventId: number;
  externalEventId: string;
  patientName: null | string;
  patientRut: null | string;
  seriesStageKind: ClinicalSeriesStageKind | null;
  seriesStageLabel: null | string;
  seriesStageNumber: null | number;
  summary: null | string;
  testMetadata: null | {
    firstReading: boolean;
    patchTest: boolean;
    secondReading: boolean;
    skinTest: boolean;
    thirdReading: boolean;
  };
  treatmentStage: null | string;
};

type ClinicalSeriesEventSnapshot = {
  amountExpected: null | number;
  amountPaid: null | number;
  beneficiaryName: null | string;
  beneficiaryRut: null | string;
  calendarGoogleId: string;
  dosageUnit: null | string;
  dosageValue: null | number;
  eventDate: string;
  eventId: number;
  externalEventId: string;
  linkedFolios: string[];
  patientName: null | string;
  patientRut: null | string;
  seriesStageKind: ClinicalSeriesStageKind | null;
  seriesStageLabel: null | string;
  seriesStageNumber: null | number;
  summary: null | string;
};

type ClinicalSeriesLinkedDocument = {
  clientName: string;
  clientRUT: string;
  confidenceScore: number;
  documentDate: string;
  dteSaleDetailId: string;
  folio: string;
  matchedBy: string;
  totalAmount: number;
};

export interface ClinicalSeriesSnapshot {
  allergenType: null | SubcutaneousAllergenType;
  vaccineProduct: null | SubcutaneousVaccineProduct;
  healthInsurance: null | HealthInsuranceType;
  deliveryModality: null | DeliveryModality;
  beneficiaryName: null | string;
  beneficiaryPhone?: null | string;
  beneficiaryRut: null | string;
  displayName: null | string;
  eligibleDocumentDateFrom: string;
  eligibleDocumentDateTo: string;
  events: ClinicalSeriesEventSnapshot[];
  id: number;
  kind: ClinicalSeriesKind;
  linkedDocuments: ClinicalSeriesLinkedDocument[];
  patientName: null | string;
  patientPhone?: null | string;
  patientRut: null | string;
  remainingExpected: number;
  remainingPaid: number;
  status: "ACTIVE" | "CANCELLED" | "COMPLETED" | "PLANNED" | "INACTIVE";
  totalExpected: number;
  totalLinkedAmount: number;
  totalPaid: number;
}

function isPastOrTodayEvent(eventDate: string, today: string) {
  return eventDate <= today;
}

type ClinicalSeriesFilters = {
  beneficiaryRut?: string;
  kind?: ClinicalSeriesKind;
  nextVisitFrom?: string;
  nextVisitTo?: string;
  page?: number;
  pageSize?: number;
  patientPhone?: string;
  query?: string;
  patientName?: string;
  patientRut?: string;
  sortColumn?:
    | "financial"
    | "kind"
    | "lastEvent"
    | "nextEvent"
    | "patient"
    | "status"
    | "totalEvents"
    | "upcomingEvents";
  sortDirection?: "ascending" | "descending";
  status?: "ACTIVE" | "CANCELLED" | "COMPLETED" | "PLANNED" | "INACTIVE";
};

function normalizePhoneSearch(value: null | string | undefined): null | string {
  if (!value) return null;
  const digits = value.replace(/\D+/g, "");
  return digits.length > 0 ? digits : null;
}

function normalizeName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripNonNamePhrases(text: string): string {
  return text
    .replace(
      /,\s*[^,;()]{3,80}\(\s*(?:pap[aá]|mam[aá]|tutor(?:a)?)\s*\)(?=(?:\s*,|\s*\(|$))/gi,
      " ",
    )
    .replace(
      /,\s*(?:pap[aá]|mam[aá]|tutor(?:a)?)\s+[^,;()]{3,80}(?=(?:\s*,|\s*\(|$))/gi,
      " ",
    )
    .replace(/\bsan\s+carlos\b/gi, " ")
    .replace(/\bsan\s+pedro\s+de\s+la\s+paz\b/gi, " ")
    .replace(/\bde\s+la\s+paz\b/gi, " ")
    .replace(/\bsan\s+pedro\b/gi, " ");
}

/**
 * If a stopword of ≥4 chars is glued directly to the start of `token`
 * (e.g. "llegodiego" = "llego" + "diego"), returns the remainder after the
 * stopword so downstream checks can evaluate it on its own.
 * Uses the longest matching prefix to avoid partial matches.
 */
function stripStopwordPrefix(token: string): string {
  let best = "";
  for (const sw of LOWERCASE_NAME_STOPWORDS) {
    const remainderLength = token.length - sw.length;
    if (
      sw.length >= 4 &&
      sw.length > best.length &&
      token.startsWith(sw) &&
      remainderLength >= 4
    ) {
      best = sw;
    }
  }
  return best ? token.slice(best.length) : token;
}

function normalizeNameToken(token: string): string {
  return stripStopwordPrefix(token).replace(/^-+|-+$/g, "");
}

function resolveClinicalSeriesOrderBy(
  filters?: ClinicalSeriesFilters,
): ReturnType<typeof sql> {
  const sortColumn = filters?.sortColumn ?? "lastEvent";
  const sortDirection = filters?.sortDirection === "ascending" ? "ASC" : "DESC";

  const columnExpression = (() => {
    switch (sortColumn) {
      case "patient":
        return "lower(coalesce(cs.patient_name, ''))";
      case "kind":
        return "cs.kind::text";
      case "status":
        return "cs.status::text";
      case "nextEvent":
        return "es.next_event_date";
      case "totalEvents":
        return "coalesce(es.total_events, 0)";
      case "upcomingEvents":
        return "coalesce(es.upcoming_events, 0)";
      case "financial":
        return "greatest(0, coalesce(es.total_expected_due, 0) - coalesce(lt.total_linked_amount, 0))";
      case "lastEvent":
      default:
        return "es.last_event_date";
    }
  })();

  return sql.raw(`${columnExpression} ${sortDirection} NULLS LAST, cs.id DESC`);
}

/**
 * Strip all non-name noise from raw event text so that name extraction
 * sees only name tokens. Order matters: RUTs must be stripped before
 * separators (dots in "12.345.678-9"), age before lone digits.
 */
function stripNoiseFromText(text: string): string {
  return stripNonNamePhrases(text)
    .replace(TIME_REGEX, " ")            // 15:00, 9:30
    .replace(new RegExp(RUT_REGEX.source, "g"), " ") // 12.345.678-9
    .replace(AGE_REGEX, " ")             // "36 años"
    .replace(LONG_NUMBER_REGEX, " ")     // phones, codes ≥5 digits
    .replace(STANDALONE_NUMBER_REGEX, " ") // remaining bare numbers
    .replace(SEPARATOR_REGEX, " ")       // ;:,()[]{}
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract name sequences from already-stripped text. Allows particles
 * ("de", "la", "del", …) between name tokens so compound surnames like
 * "León de la Sotta" or "Claudio de la Cuadra" are captured intact.
 */
function extractNamesFromCleanedText(text: string): string[] {
  const PARTICLES = new Set(["de", "del", "la", "las", "los", "van", "von", "y", "e"]);
  const tokens = normalizeName(text)
    .split(" ")
    .filter(Boolean)
    .map((t) => normalizeNameToken(t))
    .filter(Boolean);

  const isNameToken = (t: string) =>
    t.length >= 3 && !/\d/.test(t) && !LOWERCASE_NAME_STOPWORDS.has(t);
  const isParticle = (t: string) => PARTICLES.has(t);

  const results: string[] = [];
  let i = 0;

  while (i < tokens.length) {
    if (!isNameToken(tokens[i]!)) { i++; continue; }

    const seq: string[] = [tokens[i]!];
    let j = i + 1;

    while (j < tokens.length && seq.length < 6) {
      const t = tokens[j]!;
      if (isNameToken(t)) {
        seq.push(t); j++;
      } else if (isParticle(t)) {
        // Allow particles only when a name token eventually follows.
        let k = j + 1;
        while (k < tokens.length && isParticle(tokens[k]!)) k++;
        if (k < tokens.length && isNameToken(tokens[k]!)) {
          while (j <= k) seq.push(tokens[j++]!);
        } else {
          break;
        }
      } else {
        break;
      }
    }

    // Names must not start or end with a particle.
    while (seq.length > 0 && isParticle(seq[seq.length - 1]!)) seq.pop();
    if (seq.length >= 2) results.push(seq.join(" "));
    i = j;
  }

  return [...new Set(results)].sort((a, b) => {
    const td = b.split(" ").length - a.split(" ").length;
    return td !== 0 ? td : b.length - a.length;
  });
}

export function extractPatientHints(summary: null | string, description: null | string) {
  const identity = extractIdentityHints(summary, description);
  return {
    patientName: identity.patientName,
    patientRut: identity.patientRut,
  };
}

// Extract name tokens from the raw text immediately before each RUT occurrence.
/** Returns null if the RUT body is outside the valid personal range (1M–50M). */
function sanitizeRut(rut: null | string): null | string {
  if (!rut) return null;
  const body = Number(normalizeRut(rut)?.split("-")[0]);
  return body >= 1_000_000 && body < 50_000_000 ? rut : null;
}

type StructuredClinicalDescription = {
  beneficiaryCandidates: Array<{ name: null | string; rut: string }>;
  beneficiaryRuts: string[];
  boletaBlock: null | string;
  commune: null | string;
  contactPhone: null | string;
  consultationReason: null | string;
  diseases: null | string;
  email: null | string;
  evolution: null | string;
  healthInsurance: null | string;
  patientRut: null | string;
};

const STRUCTURED_CLINICAL_LABEL_REGEX =
  /(?:^|\n|\s)-?\s*(BOLETA|Rut del paciente|Edad|Comuna|Previsi[oó]n|N[uú]mero de contacto|Correo electr[oó]nico|Motivo de la consulta|Tiempo de evoluci[oó]n|Enfermedades base)\s*:/gi;
const STRUCTURED_NOISE_LINE_REGEX =
  /(?:^|\n)\s*[-•]?\s*(?:correo(?:\s+electr[oó]nico)?|motivo(?:\s+de\s+la\s+consulta)?|tiempo(?:\s+de\s+evoluci[oó]n)?|tratamiento\s+usado|enfermedades\s+base|n[uú]mero\s+de\s+contacto|n[uú]mero|telefono|tel[eé]fono|edad|comuna|previsi[oó]n|rut\s+del\s+paciente)\s*:\s*[^\n]*/gi;
const EMAIL_REGEX = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi;
const GLUED_RUT_FOLLOWED_BY_AGE_REGEX = /(\d{7,8}-?[\dkK])(?=\d{1,3}\s*a[ñn]os?\b)/gi;
const GLUED_RUT_FOLLOWED_BY_LABEL_REGEX =
  /(\d{7,8}-?[\dkK])(?=-?(?:edad|comuna|previsi[oó]n|n[uú]mero(?:\s+de\s+contacto)?|correo(?:\s+electr[oó]nico)?|motivo(?:\s+de\s+la\s+consulta)?|tiempo(?:\s+de\s+evoluci[oó]n)?|enfermedades\s+base|tratamiento\s+usado)\b)/gi;

function cleanStructuredFieldValue(value: string): string {
  return value.replace(/\s+/g, " ").replace(/[;,]+$/g, "").trim();
}

function normalizeIdentitySourceText(value: string): string {
  return value
    .replace(GLUED_RUT_FOLLOWED_BY_AGE_REGEX, "$1 ")
    .replace(GLUED_RUT_FOLLOWED_BY_LABEL_REGEX, "$1 ");
}

function stripStructuredNoiseForNames(value: string): string {
  return value
    .replace(STRUCTURED_NOISE_LINE_REGEX, "\n")
    .replace(EMAIL_REGEX, " ")
    .replace(/\b(?:href|mailto|target|blank)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function trimBoletaBlock(value: string): string {
  const normalized = value.trim();
  if (!normalized) return normalized;

  const patientSectionIndex = normalized.search(
    /\n{2,}(?=(?:\d{1,3}\s*a[ñn]os?\b|\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]\b))/i,
  );
  if (patientSectionIndex >= 0) {
    return normalized.slice(0, patientSectionIndex).trim();
  }

  return normalized;
}

function extractStructuredClinicalDescription(text: string): StructuredClinicalDescription {
  const empty: StructuredClinicalDescription = {
    beneficiaryCandidates: [],
    beneficiaryRuts: [],
    boletaBlock: null,
    commune: null,
    contactPhone: null,
    consultationReason: null,
    diseases: null,
    email: null,
    evolution: null,
    healthInsurance: null,
    patientRut: null,
  };
  if (!text.trim()) return empty;

  const sections: Array<{ key: string; matchIndex: number; valueStart: number }> = [];
  let match: null | RegExpExecArray;
  STRUCTURED_CLINICAL_LABEL_REGEX.lastIndex = 0;

  while ((match = STRUCTURED_CLINICAL_LABEL_REGEX.exec(text)) !== null) {
    const rawLabel = normalizeName(match[1] ?? "");
    const key =
      rawLabel === "boleta"
        ? "boleta"
        : rawLabel === "rut del paciente"
          ? "patientRut"
          : rawLabel === "comuna"
            ? "commune"
            : rawLabel === "prevision"
              ? "healthInsurance"
              : rawLabel === "numero de contacto"
                ? "contactPhone"
                : rawLabel === "correo electronico"
                  ? "email"
                  : rawLabel === "motivo de la consulta"
                    ? "consultationReason"
                    : rawLabel === "tiempo de evolucion"
                      ? "evolution"
                      : rawLabel === "enfermedades base"
                        ? "diseases"
                        : null;
    if (!key) continue;
    sections.push({
      key,
      matchIndex: match.index,
      valueStart: match.index + match[0].length,
    });
  }

  if (sections.length === 0) return empty;

  const values = new Map<string, string>();
  for (let index = 0; index < sections.length; index += 1) {
    const section = sections[index]!;
    const end = sections[index + 1]?.matchIndex ?? text.length;
    const rawValue = text.slice(section.valueStart, end).trim();
    const value =
      section.key === "boleta" ? rawValue : cleanStructuredFieldValue(rawValue);
    if (value) values.set(section.key, value);
  }

  const boletaBlock = values.get("boleta") ? trimBoletaBlock(values.get("boleta")!) : null;
  const beneficiaryCandidates: Array<{ name: null | string; rut: string }> = [];
  if (boletaBlock) {
    const boletaRutRegex = new RegExp(RUT_REGEX.source, "g");
    let boletaMatch: null | RegExpExecArray;
    while ((boletaMatch = boletaRutRegex.exec(boletaBlock)) !== null) {
      const rut = sanitizeRut(normalizeRut(boletaMatch[0]));
      if (!rut) continue;
      const lineStart = boletaBlock.lastIndexOf("\n", boletaMatch.index) + 1;
      let lineBeforeRut = cleanStructuredFieldValue(
        boletaBlock
          .slice(lineStart, boletaMatch.index)
          .replace(/^boleta\s*:\s*/i, ""),
      );
      if (!lineBeforeRut) {
        const beforeRutText = boletaBlock.slice(0, lineStart).replace(/^boleta\s*:\s*/i, "").trimEnd();
        const previousLine = beforeRutText.split("\n").map((line) => cleanStructuredFieldValue(line)).filter(Boolean).at(-1);
        lineBeforeRut = previousLine ?? "";
      }
      const extractedName =
        extractNamesFromText(lineBeforeRut)[0] ?? (normalizeName(lineBeforeRut) || null);
      const name = extractedName && isLikelyPersonName(extractedName) ? extractedName : null;
      if (!beneficiaryCandidates.some((candidate) => candidate.rut === rut)) {
        beneficiaryCandidates.push({ name, rut });
      }
    }
  }

  return {
    beneficiaryCandidates,
    beneficiaryRuts: beneficiaryCandidates.map((candidate) => candidate.rut),
    boletaBlock,
    commune: values.get("commune") ?? null,
    contactPhone: values.get("contactPhone") ?? null,
    consultationReason: values.get("consultationReason") ?? null,
    diseases: values.get("diseases") ?? null,
    email: values.get("email") ?? null,
    evolution: values.get("evolution") ?? null,
    healthInsurance: values.get("healthInsurance") ?? null,
    patientRut: sanitizeRut(normalizeRut(values.get("patientRut") ?? null)),
  };
}

// This is the highest-confidence source: secretaries typically write the
// patient name right before the RUT ("Nadia Yañez Rojas 12.345.678-9 ...").
function extractRutAdjacentNames(text: string): string[] {
  const results: string[] = [];
  const globalRutRegex = new RegExp(RUT_REGEX.source, "g");
  let m: RegExpExecArray | null;

  while ((m = globalRutRegex.exec(text)) !== null) {
    const raw = text.slice(0, m.index).trim();
    // Strip clinical noise that appears between the name and the RUT:
    //   - Age annotations: "37 años,", "2 años;"
    //   - Parenthetical amounts/doses: "(50)", "(100)" — these are sometimes
    //     glued directly to the following word: "(50)luis" → must become "luis"
    //     so the backwards walk reaches the actual name token.
    const before = raw
      .replace(/\b\d{1,3}\s+a[ñn]os?[;:,]?\s*/gi, "")
      .replace(/\(\d+\)\s*/g, " ")
      .trim();
    // Take up to 5 raw tokens ending at the RUT and walk backwards, stopping
    // at the first token that looks like a stopword or non-name token.
    const rawTokens = before.split(/\s+/).slice(-5);
    // Short particles ("de", "la", "del", "las", "los") are valid in Chilean
    // compound surnames like "Claudio de la Cuadra". Allow them unless they're
    // the only token (i.e. don't start or end the name with a particle).
    const PARTICLES = new Set(["de", "del", "la", "las", "los", "van", "von", "y", "e"]);
    const nameTokens: string[] = [];
    for (const token of [...rawTokens].reverse()) {
      // Hyphen-prefixed tokens are field labels ("-Rut:", "-Edad", "-Número")
      // that secretaries write in structured notes — not name components.
      if (token.startsWith("-")) break;
      // Strip trailing digits so "martin9" is treated as "martin".
      const stripped = token.replace(/\d+$/, "");
      const normalized = normalizeName(stripped || token);
      if (!normalized || /\d/.test(normalized)) break;
      // A single whitespace-token can contain comma-joined words ("alamos,fonasa," →
      // "alamos fonasa"). Check each word individually so stopwords inside the
      // token are caught even when the full string isn't in the set.
      // IMPORTANT: Check stopwords BEFORE degluing — "clustoid" must break the walk,
      // not be stripped to "oid" by stripStopwordPrefix.
      const nWords0 = normalized.split(" ").filter(Boolean);
      if (nWords0.some((w) => LOWERCASE_NAME_STOPWORDS.has(w))) break;
      // Deglue stopword prefixes glued without a space ("llegodiego" → "diego").
      const n = normalizeNameToken(normalized);
      if (!n || /\d/.test(n)) break;
      // Check word lengths rather than total token length: "s/c" normalizes to
      // "s c" (3 chars) and would pass `n.length < 3`, but each word is 1 char.
      const nWords = n.split(" ").filter(Boolean);
      if (nWords.every((w) => w.length < 3) && !PARTICLES.has(n)) break;
      nameTokens.unshift(n);
    }
    // Drop leading/trailing particles — a name must start and end with a real token.
    while (nameTokens.length > 0 && PARTICLES.has(nameTokens[0]!)) nameTokens.shift();
    while (nameTokens.length > 0 && PARTICLES.has(nameTokens[nameTokens.length - 1]!)) nameTokens.pop();
    if (nameTokens.length >= 2) results.push(nameTokens.join(" "));
  }

  return [...new Set(results)];
}

function extractNamesFromText(text: string): string[] {
  if (!text) return [];
  const sanitizedText = stripNonNamePhrases(text);
  // High-confidence: names anchored immediately before a RUT in the raw text.
  const rutNames = extractRutAdjacentNames(sanitizedText);
  // Strip all noise then extract name sequences from what remains.
  const cleanedNames = extractNamesFromCleanedText(stripNoiseFromText(sanitizedText));
  return [...new Set([...rutNames, ...cleanedNames])];
}

function isExplicitRutContext(text: string, index: number): boolean {
  const before = text.slice(Math.max(0, index - 32), index);
  return /rut(?:\s+del\s+paciente)?[\s:;-]*$/i.test(before);
}

function isAcceptedRutCandidate(rawValue: string, index: number, text: string): boolean {
  const normalized = normalizeRut(rawValue);
  if (!normalized) return false;
  const body = Number(normalized.split("-")[0]);
  if (!(body >= 1_000_000 && body < 50_000_000)) return false;

  const hasFormatting = /[.-]/.test(rawValue);
  if (hasFormatting || isExplicitRutContext(text, index)) {
    return true;
  }

  const digits = rawValue.replace(/\D/g, "");
  if (digits.length >= 9 && digits.startsWith("9")) {
    return false;
  }

  return validateRut(rawValue);
}

export function extractIdentityHints(summary: null | string, description: null | string) {
  const summaryText = normalizeIdentitySourceText(normalizeClinicalText(summary));
  const descriptionText = normalizeIdentitySourceText(normalizeClinicalText(description));
  const structured = extractStructuredClinicalDescription(descriptionText);
  // RUTs are extracted from combined text — they appear in either field.
  const combinedText = `${summaryText} ${descriptionText}`.trim();
  const ruts = [
    ...new Set(
      Array.from(combinedText.matchAll(new RegExp(RUT_REGEX.source, "g")))
        .map((match) => {
          const rawValue = match[0];
          const index = match.index ?? 0;
          if (!rawValue || !isAcceptedRutCandidate(rawValue, index, combinedText)) return null;
          return normalizeRut(rawValue);
        })
        .filter((rut): rut is string => rut !== null),
    ),
  ];

  // Names: summary always has priority over description.
  // Running extractors separately prevents description noise (clinical notes,
  // field labels like "-Rut del paciente:", previous visit history) from
  // overriding a clearly-identified name in the event title/summary.
  const summaryNames = extractNamesFromText(stripStructuredNoiseForNames(summaryText.trim()));
  const descriptionWithoutBoleta =
    structured.boletaBlock ? descriptionText.replace(structured.boletaBlock, " ") : descriptionText;
  const descriptionNames = extractNamesFromText(stripStructuredNoiseForNames(descriptionWithoutBoleta));
  const beneficiaryNames = structured.beneficiaryCandidates
    .map((candidate) => candidate.name)
    .filter((value): value is string => Boolean(value) && isLikelyPersonName(value));

  const uniquePatientNames = [...new Set([...summaryNames, ...descriptionNames])]
    .filter((value) => isLikelyPersonName(value));
  const patientRut =
    structured.patientRut ??
    ruts.find((value) => !structured.beneficiaryRuts.includes(value)) ??
    ruts[0] ??
    null;
  const beneficiaryRut =
    structured.beneficiaryRuts.find((value) => value !== patientRut) ??
    ruts.find((value) => value !== patientRut) ??
    null;
  const hasExplicitBeneficiary =
    structured.beneficiaryCandidates.length > 0 || beneficiaryRut != null;
  const patientName = uniquePatientNames[0] ?? null;
  const beneficiaryName =
    hasExplicitBeneficiary
      ? beneficiaryNames.find((value) => value !== patientName) ?? null
      : null;

  return { beneficiaryName, beneficiaryRut, patientName, patientRut };
}

type ClinicalIdentity = {
  beneficiaryName: null | string;
  beneficiaryRut: null | string;
  patientName: null | string;
  patientRut: null | string;
};

type StoredClinicalIdentity = {
  beneficiaryName?: null | string;
  beneficiaryRut?: null | string;
  patientName?: null | string;
  patientRut?: null | string;
};

function hasIdentitySourceText(summary: null | string, description: null | string): boolean {
  return Boolean(normalizeClinicalText(summary) || normalizeClinicalText(description));
}

export function resolveClinicalIdentity(
  summary: null | string,
  description: null | string,
  stored?: StoredClinicalIdentity,
): ClinicalIdentity {
  const inferred = extractIdentityHints(summary, description);
  if (hasIdentitySourceText(summary, description)) {
    return {
      beneficiaryName: inferred.beneficiaryName,
      beneficiaryRut: sanitizeRut(inferred.beneficiaryRut),
      patientName: inferred.patientName,
      patientRut: sanitizeRut(inferred.patientRut),
    };
  }

  return {
    beneficiaryName:
      inferred.beneficiaryName ??
      (stored?.beneficiaryName && isLikelyPersonName(stored.beneficiaryName)
        ? stored.beneficiaryName
        : null),
    beneficiaryRut: sanitizeRut(inferred.beneficiaryRut ?? stored?.beneficiaryRut ?? null),
    patientName: inferred.patientName ?? stored?.patientName ?? null,
    patientRut: sanitizeRut(inferred.patientRut ?? stored?.patientRut ?? null),
  };
}

const ACAROS_PATTERN = /\b[áa]caros?\b/i;
const GRAMINEAS_PATTERN = /\bgram[íi]neas?\b/i;

// Scan all events in a series to determine which allergen(s) are treated.
// When no specific allergen keyword is found the treatment defaults to
// ACAROS_GRAMINEAS because the clinic refers to the combined product as
// plain "clustoid" (without qualification).
function inferAllergenType(
  events: Array<{ description: null | string; summary: null | string }>,
): SubcutaneousAllergenType {
  let hasAcaros = false;
  let hasGramineas = false;

  for (const event of events) {
    const text = joinClinicalText(event.summary, event.description);
    if (!hasAcaros && ACAROS_PATTERN.test(text)) hasAcaros = true;
    if (!hasGramineas && GRAMINEAS_PATTERN.test(text)) hasGramineas = true;
    if (hasAcaros && hasGramineas) break;
  }

  if (hasAcaros && hasGramineas) return "ACAROS_GRAMINEAS";
  if (hasAcaros) return "ACAROS";
  if (hasGramineas) return "GRAMINEAS";
  // Default: plain "clustoid" without allergen qualifier = combined treatment
  return "ACAROS_GRAMINEAS";
}

// Vaccine product — Cluxin and Clustek are trade names for Clustoid.
// Forte and B120 are concentration variants of the same base product.
const ORAL_TEC_PATTERN = /oral[\s-]?tec/i;
const ALXOID_PATTERN = /\balxoid\b/i;
const CLUSTOID_BASE_PATTERN = /cl[au]s[i]?t[oau]?id[eo]?|cluxin|clustek|clutoid|\bclust/i;
const CLUSTOID_FORTE_PATTERN = /\bforte\b/i;
const CLUSTOID_B120_PATTERN = /\bb[\s-]?120\b/i;

function inferVaccineProduct(
  events: Array<{ description: null | string; summary: null | string }>,
): null | SubcutaneousVaccineProduct {
  let hasOralTec = false;
  let hasAlxoid = false;
  let hasClustoid = false;
  let hasForte = false;
  let hasB120 = false;

  for (const event of events) {
    const text = joinClinicalText(event.summary, event.description);
    if (!hasOralTec && ORAL_TEC_PATTERN.test(text)) hasOralTec = true;
    if (!hasAlxoid && ALXOID_PATTERN.test(text)) hasAlxoid = true;
    if (!hasClustoid && CLUSTOID_BASE_PATTERN.test(text)) hasClustoid = true;
    if (hasClustoid && !hasForte && CLUSTOID_FORTE_PATTERN.test(text)) hasForte = true;
    if (hasClustoid && !hasB120 && CLUSTOID_B120_PATTERN.test(text)) hasB120 = true;
  }

  if (hasOralTec) return "ORAL_TEC";
  if (hasAlxoid) return "ALXOID";
  if (hasClustoid) {
    if (hasForte) return "CLUSTOID_FORTE";
    if (hasB120) return "CLUSTOID_B120";
    return "CLUSTOID";
  }
  return null;
}

// Health insurance — detect from descriptions ("fonasa", "isapre", known ISAPREs).
const FONASA_PATTERN = /\bfonasa\b/i;
const ISAPRE_PATTERN =
  /\bisapre\b|\bcolmena\b|\bconsalud\b|\bbanm[eé]dica\b|\bcruz\s*blanca\b|\bvida\s*tres\b|\bnueva\s*m[aá]s\s*vida\b/i;
const PARTICULAR_PATTERN = /\bparticular\b/i;

function inferHealthInsurance(
  events: Array<{ description: null | string; summary: null | string }>,
): HealthInsuranceType | null {
  for (const event of events) {
    const text = joinClinicalText(event.summary, event.description);
    if (FONASA_PATTERN.test(text)) return "FONASA";
    if (ISAPRE_PATTERN.test(text)) return "ISAPRE";
    if (PARTICULAR_PATTERN.test(text)) return "PARTICULAR";
  }
  return null;
}

// Delivery modality — domicilio if any event was sent/picked up; otherwise presencial.
const DOMICILIO_DELIVERY_PATTERN =
  /\bdomicilio\b|\bse\s+envi[oó]\b|\bse\s+la?\s+llev[oó]\b|\bse\s+lo\s+llev[oó]\b|\bretira\b|\benviar\b|\bdespacho\b/i;

function inferDeliveryModality(
  events: Array<{ description: null | string; summary: null | string }>,
): DeliveryModality {
  for (const event of events) {
    const text = joinClinicalText(event.summary, event.description);
    if (DOMICILIO_DELIVERY_PATTERN.test(text)) return "DOMICILIO";
  }
  return "PRESENCIAL";
}

function inferSeriesKind(event: EventSeriesCandidate): ClinicalSeriesKind | null {
  if (event.category === "Tratamiento subcutáneo") {
    return "SUBCUTANEOUS_TREATMENT";
  }

  if (event.category === "Test y exámenes") {
    if (event.testMetadata?.patchTest) {
      return "PATCH_TEST";
    }
    if (event.testMetadata?.skinTest) {
      return "SKIN_TEST";
    }
  }

  return null;
}

function getSeriesWindowDays(kind: ClinicalSeriesKind): number {
  if (kind === "SUBCUTANEOUS_TREATMENT") {
    return 180;
  }
  return 45;
}

function buildSeriesDisplayName(params: {
  kind: ClinicalSeriesKind;
  patientName: null | string;
  patientRut: null | string;
}) {
  const kindLabel =
    params.kind === "PATCH_TEST"
      ? "Test de parche"
      : params.kind === "SKIN_TEST"
        ? "Test cutáneo"
        : "Tratamiento subcutáneo";

  const identity = params.patientName ?? params.patientRut ?? "Paciente sin identificar";
  return `${identity} · ${kindLabel}`;
}

function computeExpectedSessions(
  events: Array<{
    seriesStageKind: ClinicalSeriesStageKind | null;
    seriesStageNumber: null | number;
  }>,
): null | number {
  const numbered = events
    .map((event) => event.seriesStageNumber)
    .filter((value): value is number => value != null && Number.isFinite(value));

  if (numbered.length > 0) {
    return Math.max(...numbered);
  }

  if (events.some((event) => event.seriesStageKind === "MAINTENANCE")) {
    return null;
  }

  return events.length > 0 ? events.length : null;
}

async function loadEventSeriesCandidateByInternalId(
  eventId: number,
): Promise<EventSeriesCandidate | null> {
  const rows = await db.$queryRaw<EventSeriesCandidate[]>`
    SELECT
      e.id AS "eventId",
      c.google_id AS "calendarGoogleId",
      e.external_event_id AS "externalEventId",
      e.patient_name AS "patientName",
      e.patient_rut AS "patientRut",
      e.beneficiary_name AS "beneficiaryName",
      e.beneficiary_rut AS "beneficiaryRut",
      COALESCE(to_char(e.start_date, 'YYYY-MM-DD'), to_char((e.start_date_time AT TIME ZONE ${TIMEZONE})::date, 'YYYY-MM-DD')) AS "eventDate",
      e.summary AS "summary",
      e.description AS "description",
      e.category AS "category",
      e.clinical_series_id AS "clinicalSeriesId",
      e.series_stage_kind AS "seriesStageKind",
      e.series_stage_label AS "seriesStageLabel",
      e.series_stage_number AS "seriesStageNumber",
      e.treatment_stage AS "treatmentStage",
      e.test_metadata AS "testMetadata",
      e.amount_expected AS "amountExpected",
      e.amount_paid AS "amountPaid"
    FROM events e
    JOIN calendars c ON c.id = e.calendar_id
    WHERE e.id = ${eventId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

async function loadEventSeriesCandidateByExternalIds(
  calendarGoogleId: string,
  externalEventId: string,
): Promise<EventSeriesCandidate | null> {
  const rows = await db.$queryRaw<EventSeriesCandidate[]>`
    SELECT
      e.id AS "eventId",
      c.google_id AS "calendarGoogleId",
      e.external_event_id AS "externalEventId",
      e.patient_name AS "patientName",
      e.patient_rut AS "patientRut",
      e.beneficiary_name AS "beneficiaryName",
      e.beneficiary_rut AS "beneficiaryRut",
      COALESCE(to_char(e.start_date, 'YYYY-MM-DD'), to_char((e.start_date_time AT TIME ZONE ${TIMEZONE})::date, 'YYYY-MM-DD')) AS "eventDate",
      e.summary AS "summary",
      e.description AS "description",
      e.category AS "category",
      e.clinical_series_id AS "clinicalSeriesId",
      e.series_stage_kind AS "seriesStageKind",
      e.series_stage_label AS "seriesStageLabel",
      e.series_stage_number AS "seriesStageNumber",
      e.treatment_stage AS "treatmentStage",
      e.test_metadata AS "testMetadata",
      e.amount_expected AS "amountExpected",
      e.amount_paid AS "amountPaid"
    FROM events e
    JOIN calendars c ON c.id = e.calendar_id
    WHERE c.google_id = ${calendarGoogleId}
      AND e.external_event_id = ${externalEventId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

// Returns significant tokens from a normalized name: length ≥ 3, not a stopword.
function getSignificantNameTokens(name: string): string[] {
  return [
    ...new Set(
      normalizeName(name)
        .split(" ")
        .filter((t) => t.length >= 3 && !LOWERCASE_NAME_STOPWORDS.has(t)),
    ),
  ];
}

// ── SeriesAssignmentContext ───────────────────────────────────────────────────
// Pre-loaded in-memory index of all clinical series. Eliminates per-event DB
// queries during bulk rebuilds — a single load replaces O(N) round trips with
// O(1) map lookups and O(k) token-overlap scans.

interface SeriesEntry {
  beneficiaryName: null | string;
  beneficiaryRut: null | string;
  eventCount: number;
  id: number;
  kind: ClinicalSeriesKind;
  maxDate: dayjs.Dayjs | null;
  minDate: dayjs.Dayjs | null;
  patientName: null | string;
  patientRut: null | string;
}

function scoreClinicalSeriesIdentityQuality(series: {
  beneficiaryName?: null | string;
  beneficiaryRut?: null | string;
  eventCount?: number;
  patientName?: null | string;
  patientRut?: null | string;
}): number {
  let score = 0;
  if (series.patientRut) score += 1_000;
  if (series.beneficiaryRut) score += 200;
  if (series.patientName && isLikelyPersonName(series.patientName)) score += 150;
  if (series.beneficiaryName && isLikelyPersonName(series.beneficiaryName)) score += 75;
  if (series.beneficiaryName && !isLikelyPersonName(series.beneficiaryName)) score -= 50;
  score += Math.min(series.eventCount ?? 0, 500);
  return score;
}

function scoreRepresentativeIdentity(identity: ClinicalIdentity & { eventCount?: number }): number {
  return scoreClinicalSeriesIdentityQuality(identity);
}

function compareRepresentativeIdentity(
  a: ClinicalIdentity & { eventCount?: number },
  b: ClinicalIdentity & { eventCount?: number },
): number {
  const scoreDelta = scoreRepresentativeIdentity(b) - scoreRepresentativeIdentity(a);
  if (scoreDelta !== 0) return scoreDelta;
  const eventDelta = (b.eventCount ?? 0) - (a.eventCount ?? 0);
  if (eventDelta !== 0) return eventDelta;
  return (b.patientName ?? "").length - (a.patientName ?? "").length;
}

function compareSeriesCanonicalPriority<
  T extends {
    beneficiaryName?: null | string;
    beneficiaryRut?: null | string;
    eventCount?: number;
    id: number;
    patientName?: null | string;
    patientRut?: null | string;
  },
>(a: T, b: T): number {
  const scoreDelta = scoreClinicalSeriesIdentityQuality(b) - scoreClinicalSeriesIdentityQuality(a);
  if (scoreDelta !== 0) return scoreDelta;
  const eventDelta = (b.eventCount ?? 0) - (a.eventCount ?? 0);
  if (eventDelta !== 0) return eventDelta;
  return a.id - b.id;
}

function hasConflictingPrimaryIdentity<
  T extends {
    beneficiaryRut?: null | string;
    patientRut?: null | string;
  },
>(a: T, b: T): boolean {
  if (!a.patientRut || !b.patientRut) return false;
  if (a.patientRut === b.patientRut) return false;
  if (isCloseNormalizedRut(a.patientRut, b.patientRut)) return false;
  if (
    a.beneficiaryRut &&
    (a.beneficiaryRut === b.patientRut || isCloseNormalizedRut(a.beneficiaryRut, b.patientRut))
  ) {
    return false;
  }
  if (
    b.beneficiaryRut &&
    (b.beneficiaryRut === a.patientRut || isCloseNormalizedRut(b.beneficiaryRut, a.patientRut))
  ) {
    return false;
  }
  return true;
}

function isCloseNormalizedRut(a: null | string, b: null | string): boolean {
  if (!a || !b) return false;
  const left = normalizeRut(a);
  const right = normalizeRut(b);
  if (left === right) return true;
  if (left.length !== right.length) return false;

  let differences = 0;
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) differences++;
    if (differences > 1) return false;
  }
  return differences === 1;
}

class SeriesAssignmentContext {
  // RUT index stays single-valued; exact-name collisions keep all candidates so
  // rebuild can prefer the best canonical series rather than the oldest id.
  private readonly rutKindIndex = new Map<string, number>();  // `${rut}:${kind}` → id
  private readonly nameKindIndex = new Map<string, number[]>(); // `${name}:${kind}` → [id, …]
  // Token inverted index — insertion order matches id ASC load order.
  private readonly tokenIndex = new Map<string, number[]>(); // token → [id, …]
  readonly seriesById = new Map<number, SeriesEntry>();

  private addEntry(entry: SeriesEntry): void {
    this.seriesById.set(entry.id, entry);

    if (entry.patientRut) {
      const key = `${normalizeRut(entry.patientRut)}:${entry.kind}`;
      if (!this.rutKindIndex.has(key)) this.rutKindIndex.set(key, entry.id);
    }
    if (entry.patientName) {
      const key = `${normalizeName(entry.patientName)}:${entry.kind}`;
      const ids = this.nameKindIndex.get(key);
      if (ids) ids.push(entry.id);
      else this.nameKindIndex.set(key, [entry.id]);
      for (const token of getSignificantNameTokens(entry.patientName)) {
        const list = this.tokenIndex.get(token);
        if (list) list.push(entry.id);
        else this.tokenIndex.set(token, [entry.id]);
      }
    }
  }

  static async load(): Promise<SeriesAssignmentContext> {
    const ctx = new SeriesAssignmentContext();
    const rows = await db.clinicalSeries.findMany({
      select: {
        beneficiaryName: true,
        beneficiaryRut: true,
        id: true,
        kind: true,
        patientName: true,
        patientRut: true,
        events: { select: { endDate: true, endDateTime: true, startDate: true, startDateTime: true } },
      },
      orderBy: { id: "asc" },
    });
    for (const s of rows) {
      const dates = s.events
        .map((e) => e.startDate ?? e.startDateTime ?? e.endDate ?? e.endDateTime)
        .filter((v): v is Date => v instanceof Date)
        .map((v) => dayjs(v).tz(TIMEZONE))
        .sort((a, b) => a.valueOf() - b.valueOf());
      ctx.addEntry({
        beneficiaryName: s.beneficiaryName,
        beneficiaryRut: s.beneficiaryRut,
        eventCount: s.events.length,
        id: s.id,
        kind: s.kind,
        maxDate: dates[dates.length - 1] ?? null,
        minDate: dates[0] ?? null,
        patientName: s.patientName,
        patientRut: s.patientRut,
      });
    }
    return ctx;
  }

  /** Distance in days between eventDate and the series' event span. */
  private dist(entry: SeriesEntry, eventDate: dayjs.Dayjs): number {
    if (!entry.minDate || !entry.maxDate) return Infinity;
    if (eventDate.isBefore(entry.minDate)) return entry.minDate.diff(eventDate, "day");
    if (eventDate.isAfter(entry.maxDate)) return eventDate.diff(entry.maxDate, "day");
    return 0;
  }

  /** RUT uniquely identifies the patient — returns the oldest series for this rut+kind. */
  findByRut(rut: string, kind: ClinicalSeriesKind): number | undefined {
    return this.rutKindIndex.get(`${normalizeRut(rut)}:${kind}`);
  }

  /** Exact normalized name match, closest within the date window. */
  findByName(name: string, kind: ClinicalSeriesKind, eventDate: dayjs.Dayjs, thresholdDays: number): number | undefined {
    const ids = this.nameKindIndex.get(`${normalizeName(name)}:${kind}`) ?? [];
    const candidates = ids
      .map((id) => this.seriesById.get(id))
      .filter((entry): entry is SeriesEntry => !!entry && this.dist(entry, eventDate) <= thresholdDays)
      .sort((a, b) => {
        const distanceDelta = this.dist(a, eventDate) - this.dist(b, eventDate);
        if (distanceDelta !== 0) return distanceDelta;
        return compareSeriesCanonicalPriority(a, b);
      });
    return candidates[0]?.id;
  }

  /** Choose the canonical same-kind series for this exact normalized name. */
  findUniqueByExactName(name: string, kind: ClinicalSeriesKind): number | undefined {
    const ids = this.nameKindIndex.get(`${normalizeName(name)}:${kind}`) ?? [];
    return ids
      .map((id) => this.seriesById.get(id))
      .filter((entry): entry is SeriesEntry => !!entry)
      .sort(compareSeriesCanonicalPriority)[0]?.id;
  }

  findDuplicateCanonicalByExactName(name: string, kind: ClinicalSeriesKind): number | undefined {
    const ids = this.nameKindIndex.get(`${normalizeName(name)}:${kind}`) ?? [];
    if (ids.length !== 2) return undefined;
    return ids
      .map((id) => this.seriesById.get(id))
      .filter((entry): entry is SeriesEntry => !!entry)
      .sort(compareSeriesCanonicalPriority)[0]?.id;
  }

  /**
   * Token-overlap fallback: finds the oldest same-kind series that shares ≥2
   * significant tokens covering ≥2/3 of the shorter name. Used when exact
   * name matching fails (e.g. "jose luis ojeda" ↔ "jose ojeda carrasco").
   */
  findByTokenOverlap(name: string, kind: ClinicalSeriesKind, eventDate: dayjs.Dayjs, thresholdDays: number): number | undefined {
    const eventTokens = getSignificantNameTokens(name);
    if (eventTokens.length < 2) return undefined;

    // Count how many event tokens appear in each candidate series.
    const overlapCount = new Map<number, number>();
    for (const token of eventTokens) {
      for (const id of (this.tokenIndex.get(token) ?? [])) {
        overlapCount.set(id, (overlapCount.get(id) ?? 0) + 1);
      }
    }

    let best: SeriesEntry | undefined;
    for (const [id, overlap] of overlapCount) {
      if (overlap < 2) continue;
      const entry = this.seriesById.get(id);
      if (!entry || entry.kind !== kind || !entry.patientName) continue;
      const shorterLen = Math.min(eventTokens.length, getSignificantNameTokens(entry.patientName).length);
      if (overlap / shorterLen < 2 / 3) continue;
      if (this.dist(entry, eventDate) > thresholdDays) continue;
      if (
        !best ||
        overlap > eventTokens.filter((t) => getSignificantNameTokens(best.patientName ?? "").includes(t)).length ||
        (
          overlap === eventTokens.filter((t) => getSignificantNameTokens(best.patientName ?? "").includes(t)).length &&
          compareSeriesCanonicalPriority(entry, best) < 0
        )
      ) {
        best = entry;
      }
    }
    return best?.id;
  }

  /** Register a newly created series so subsequent lookups can find it. */
  register(entry: SeriesEntry): void {
    this.addEntry(entry);
  }

  /** Extend the series' date span after assigning an event to it. */
  touch(id: number, eventDate: dayjs.Dayjs): void {
    const entry = this.seriesById.get(id);
    if (!entry) return;
    if (!entry.minDate || eventDate.isBefore(entry.minDate)) entry.minDate = eventDate;
    if (!entry.maxDate || eventDate.isAfter(entry.maxDate)) entry.maxDate = eventDate;
  }
}

export async function findMatchingSeries(
  params: {
    beneficiaryRut?: null | string;
    eventDate: string;
    kind: ClinicalSeriesKind;
    patientName: null | string;
    patientRut: null | string;
  },
  ctx?: SeriesAssignmentContext,
): Promise<null | number> {
  const eventDateDjs = dayjs.tz(params.eventDate, TIMEZONE);
  const thresholdDays = getSeriesWindowDays(params.kind);

  // ── Fast path: all lookups in memory (O(1) / O(k)) ───────────────────────
  if (ctx) {
    if (params.patientName) {
      const duplicateCanonical = ctx.findDuplicateCanonicalByExactName(params.patientName, params.kind);
      if (duplicateCanonical != null) {
        const canonical = ctx.seriesById.get(duplicateCanonical);
        if (
          canonical &&
          (
            !params.patientRut ||
            canonical.patientRut === params.patientRut ||
            canonical.beneficiaryRut === params.patientRut ||
            canonical.patientRut === params.beneficiaryRut ||
            canonical.beneficiaryRut === params.beneficiaryRut ||
            isCloseNormalizedRut(canonical.patientRut, params.patientRut) ||
            isCloseNormalizedRut(canonical.beneficiaryRut, params.patientRut) ||
            isCloseNormalizedRut(canonical.patientRut, params.beneficiaryRut ?? null) ||
            isCloseNormalizedRut(canonical.beneficiaryRut, params.beneficiaryRut ?? null)
          )
        ) {
          return duplicateCanonical;
        }
      }
    }

    if (params.patientRut) {
      const id = ctx.findByRut(params.patientRut, params.kind);
      if (id != null) return id;
    }
    if (params.patientName) {
      const exact = ctx.findByName(params.patientName, params.kind, eventDateDjs, thresholdDays);
      if (exact != null) {
        // If the matched series has a RUT, prefer the oldest canonical series for that RUT.
        // This prevents re-assigning events to a duplicate series when the canonical exists.
        const entry = ctx.seriesById.get(exact);
        if (entry?.patientRut) {
          const canonical = ctx.findByRut(entry.patientRut, params.kind);
          if (canonical != null && canonical !== exact) return canonical;
        }
        return exact;
      }
      const uniqueExact = ctx.findUniqueByExactName(params.patientName, params.kind);
      if (uniqueExact != null) return uniqueExact;
      if (!params.patientRut) {
        const fuzzy = ctx.findByTokenOverlap(params.patientName, params.kind, eventDateDjs, thresholdDays);
        if (fuzzy != null) return fuzzy;
      }
    }
    return null;
  }

  // ── Slow path: DB queries (single-event incremental sync) ─────────────────
  const eventSelect = { select: { endDate: true, endDateTime: true, startDate: true, startDateTime: true } } as const;

  if (params.patientName) {
    const duplicateCandidates = await db.clinicalSeries.findMany({
      where: { kind: params.kind, patientName: params.patientName },
      select: {
        beneficiaryName: true,
        beneficiaryRut: true,
        id: true,
        patientName: true,
        patientRut: true,
        _count: { select: { events: true } },
      },
      orderBy: { id: "asc" },
    });
    if (duplicateCandidates.length === 2) {
      const canonical = [...duplicateCandidates].sort((a, b) =>
        compareSeriesCanonicalPriority(
          {
            beneficiaryName: a.beneficiaryName,
            beneficiaryRut: a.beneficiaryRut,
            eventCount: a._count.events,
            id: a.id,
            patientName: a.patientName,
            patientRut: a.patientRut,
          },
          {
            beneficiaryName: b.beneficiaryName,
            beneficiaryRut: b.beneficiaryRut,
            eventCount: b._count.events,
            id: b.id,
            patientName: b.patientName,
            patientRut: b.patientRut,
          },
        ),
      )[0]!;
      if (
        !params.patientRut ||
        canonical.patientRut === params.patientRut ||
        canonical.beneficiaryRut === params.patientRut ||
        canonical.patientRut === params.beneficiaryRut ||
        canonical.beneficiaryRut === params.beneficiaryRut ||
        isCloseNormalizedRut(canonical.patientRut, params.patientRut) ||
        isCloseNormalizedRut(canonical.beneficiaryRut, params.patientRut) ||
        isCloseNormalizedRut(canonical.patientRut, params.beneficiaryRut ?? null) ||
        isCloseNormalizedRut(canonical.beneficiaryRut, params.beneficiaryRut ?? null)
      ) {
        return canonical.id;
      }
    }
  }

  if (params.patientRut) {
    // RUT uniquely identifies the patient — return oldest series for this rut+kind.
    const rutMatch = await db.clinicalSeries.findFirst({
      where: { kind: params.kind, patientRut: params.patientRut },
      orderBy: { id: "asc" },
      select: { id: true },
    });
    if (rutMatch) return rutMatch.id;
  }

  if (params.patientName) {
    // Exact name match within date window.
    const nameCandidates = await db.clinicalSeries.findMany({
      where: { kind: params.kind, patientName: params.patientName },
      include: { events: eventSelect },
      orderBy: { id: "asc" },
    });
    let best: null | { distance: number; id: number; score: number } = null;
    for (const c of nameCandidates) {
      const dates = c.events
        .map((e) => e.startDate ?? e.startDateTime ?? e.endDate ?? e.endDateTime)
        .filter((v): v is Date => v instanceof Date)
        .map((v) => dayjs(v).tz(TIMEZONE))
        .sort((a, b) => a.valueOf() - b.valueOf());
      const distance =
        dates.length === 0
          ? Infinity
          : (() => {
              const s = dates[0]!;
              const e = dates[dates.length - 1]!;
              return eventDateDjs.isBefore(s) ? s.diff(eventDateDjs, "day") : eventDateDjs.isAfter(e) ? eventDateDjs.diff(e, "day") : 0;
            })();
      if (distance > thresholdDays) continue;
      const score = scoreClinicalSeriesIdentityQuality({
        beneficiaryName: c.beneficiaryName,
        beneficiaryRut: c.beneficiaryRut,
        eventCount: c.events.length,
        patientName: c.patientName,
        patientRut: c.patientRut,
      });
      if (
        !best ||
        distance < best.distance ||
        (distance === best.distance && (score > best.score || (score === best.score && c.id < best.id)))
      ) {
        best = { distance, id: c.id, score };
      }
    }
    if (best) return best.id;
    if (nameCandidates.length > 0) {
      return [...nameCandidates].sort((a, b) =>
        compareSeriesCanonicalPriority(
          {
            beneficiaryName: a.beneficiaryName,
            beneficiaryRut: a.beneficiaryRut,
            eventCount: a.events.length,
            id: a.id,
            patientName: a.patientName,
            patientRut: a.patientRut,
          },
          {
            beneficiaryName: b.beneficiaryName,
            beneficiaryRut: b.beneficiaryRut,
            eventCount: b.events.length,
            id: b.id,
            patientName: b.patientName,
            patientRut: b.patientRut,
          },
        ),
      )[0]!.id;
    }

    // Token-overlap fallback.
    const eventTokens = getSignificantNameTokens(params.patientName);
    if (!params.patientRut && eventTokens.length >= 2) {
      const allSameKind = await db.clinicalSeries.findMany({
        where: { kind: params.kind },
        include: { events: eventSelect },
        orderBy: { id: "asc" },
      });
      let bestFuzzy: null | { distance: number; id: number; overlap: number; score: number } = null;
      for (const c of allSameKind) {
        if (!c.patientName) continue;
        const cTokens = getSignificantNameTokens(c.patientName);
        const overlap = eventTokens.filter((t) => cTokens.includes(t)).length;
        if (overlap < 2 || overlap / Math.min(eventTokens.length, cTokens.length) < 2 / 3) continue;
        const dates = c.events
          .map((e) => e.startDate ?? e.startDateTime ?? e.endDate ?? e.endDateTime)
          .filter((v): v is Date => v instanceof Date)
          .map((v) => dayjs(v).tz(TIMEZONE))
          .sort((a, b) => a.valueOf() - b.valueOf());
        const distance =
          dates.length === 0
            ? Infinity
            : (() => {
                const s = dates[0]!;
                const e = dates[dates.length - 1]!;
                return eventDateDjs.isBefore(s) ? s.diff(eventDateDjs, "day") : eventDateDjs.isAfter(e) ? eventDateDjs.diff(e, "day") : 0;
              })();
        if (distance > thresholdDays) continue;
        const score = scoreClinicalSeriesIdentityQuality({
          beneficiaryName: c.beneficiaryName,
          beneficiaryRut: c.beneficiaryRut,
          eventCount: c.events.length,
          patientName: c.patientName,
          patientRut: c.patientRut,
        });
        if (
          !bestFuzzy ||
          overlap > bestFuzzy.overlap ||
          (
            overlap === bestFuzzy.overlap &&
            (
              distance < bestFuzzy.distance ||
              (
                distance === bestFuzzy.distance &&
                (score > bestFuzzy.score || (score === bestFuzzy.score && c.id < bestFuzzy.id))
              )
            )
          )
        ) {
          bestFuzzy = { distance, id: c.id, overlap, score };
        }
      }
      if (bestFuzzy) return bestFuzzy.id;
    }
  }

  return null;
}

function buildIdentityGroupKey(name: null | string, rut: null | string): null | string {
  const normalizedRut = sanitizeRut(rut);
  if (normalizedRut) return `rut:${normalizedRut}`;
  const normalizedName = name ? normalizeName(name) : "";
  return normalizedName ? `name:${normalizedName}` : null;
}

function choosePreferredIdentityName(current: null | string, incoming: null | string): null | string {
  if (!incoming) return current;
  if (!current) return incoming;
  const currentTokens = getSignificantNameTokens(current);
  const incomingTokens = getSignificantNameTokens(incoming);
  if (incomingTokens.length !== currentTokens.length) {
    return incomingTokens.length > currentTokens.length ? incoming : current;
  }
  return incoming.length > current.length ? incoming : current;
}

export function selectRepresentativeClinicalIdentity(
  events: Array<{
    description: null | string;
    summary: null | string;
  }>,
  stored?: StoredClinicalIdentity,
): ClinicalIdentity {
  const patientGroups = new Map<string, ClinicalIdentity & { eventCount: number }>();
  const beneficiaryGroups = new Map<string, ClinicalIdentity & { eventCount: number }>();
  let hasText = false;

  for (const event of events) {
    const eventHasText = hasIdentitySourceText(event.summary, event.description);
    hasText ||= eventHasText;
    const hints = resolveClinicalIdentity(event.summary, event.description);

    const patientKey = buildIdentityGroupKey(hints.patientName, hints.patientRut);
    if (patientKey) {
      const current = patientGroups.get(patientKey);
      patientGroups.set(patientKey, {
        beneficiaryName: null,
        beneficiaryRut: null,
        eventCount: (current?.eventCount ?? 0) + 1,
        patientName: choosePreferredIdentityName(current?.patientName ?? null, hints.patientName),
        patientRut: hints.patientRut ?? current?.patientRut ?? null,
      });
    }

    const beneficiaryKey = buildIdentityGroupKey(hints.beneficiaryName, hints.beneficiaryRut);
    const sameAsPatient =
      beneficiaryKey != null &&
      patientKey != null &&
      beneficiaryKey === patientKey;
    if (beneficiaryKey && !sameAsPatient) {
      const current = beneficiaryGroups.get(beneficiaryKey);
      beneficiaryGroups.set(beneficiaryKey, {
        beneficiaryName: choosePreferredIdentityName(
          current?.beneficiaryName ?? null,
          hints.beneficiaryName,
        ),
        beneficiaryRut: hints.beneficiaryRut ?? current?.beneficiaryRut ?? null,
        eventCount: (current?.eventCount ?? 0) + 1,
        patientName: null,
        patientRut: null,
      });
    }
  }

  if (!hasText) {
    return {
      beneficiaryName:
        stored?.beneficiaryName && isLikelyPersonName(stored.beneficiaryName)
          ? stored.beneficiaryName
          : null,
      beneficiaryRut: sanitizeRut(stored?.beneficiaryRut ?? null),
      patientName: stored?.patientName ?? null,
      patientRut: sanitizeRut(stored?.patientRut ?? null),
    };
  }

  const patient = [...patientGroups.values()].sort(compareRepresentativeIdentity)[0] ?? null;
  const patientKey = buildIdentityGroupKey(patient?.patientName ?? null, patient?.patientRut ?? null);
  const beneficiary =
    [...beneficiaryGroups.values()]
      .filter((candidate) => {
        const candidateKey = buildIdentityGroupKey(
          candidate.beneficiaryName ?? null,
          candidate.beneficiaryRut ?? null,
        );
        return candidateKey != null && candidateKey !== patientKey;
      })
      .sort(compareRepresentativeIdentity)[0] ?? null;

  return {
    beneficiaryName: beneficiary?.beneficiaryName ?? null,
    beneficiaryRut: beneficiary?.beneficiaryRut ?? null,
    patientName: patient?.patientName ?? null,
    patientRut: patient?.patientRut ?? null,
  };
}

async function refreshClinicalSeriesMetadata(seriesId: number) {
  const series = await db.clinicalSeries.findUnique({
    where: { id: seriesId },
    include: {
      events: {
        select: {
          amountExpected: true,
          amountPaid: true,
          description: true,
          seriesStageKind: true,
          seriesStageNumber: true,
          startDate: true,
          startDateTime: true,
          summary: true,
        },
      },
    },
  });

  if (!series) {
    return;
  }

  // Always re-extract from event text so an improved algorithm overwrites stale
  // stored values. When there is usable text, choose the dominant identity
  // across the whole series instead of trusting the first non-null event.
  let { patientName, patientRut, beneficiaryName, beneficiaryRut } =
    selectRepresentativeClinicalIdentity(series.events, {
      beneficiaryName: series.beneficiaryName,
      beneficiaryRut: series.beneficiaryRut,
      patientName: series.patientName,
      patientRut: series.patientRut,
    });

  if (!beneficiaryRut || !beneficiaryName) {
    const linkedDocuments = await db.$queryRaw<Array<{ clientName: string; clientRUT: string }>>`
      SELECT DISTINCT
        s.client_name AS "clientName",
        s.client_rut AS "clientRUT"
      FROM event_dte_sale_links l
      JOIN events e ON e.id = l.event_id
      JOIN dte_sale_details s ON s.id = l.dte_sale_detail_id
      WHERE e.clinical_series_id = ${seriesId}
        AND l.status != 'REJECTED'
    `;

    if (linkedDocuments.length === 1) {
      beneficiaryRut ||= linkedDocuments[0]?.clientRUT ?? null;
      beneficiaryName ||= linkedDocuments[0]?.clientName ?? null;
    }
  }

  const isSubcut = series.kind === "SUBCUTANEOUS_TREATMENT";
  const allergenType = isSubcut ? inferAllergenType(series.events) : null;
  const vaccineProduct = isSubcut ? inferVaccineProduct(series.events) : null;
  const healthInsurance = inferHealthInsurance(series.events);
  const deliveryModality = isSubcut ? inferDeliveryModality(series.events) : null;

  await db.clinicalSeries.update({
    where: { id: seriesId },
    data: {
      allergenType,
      vaccineProduct,
      healthInsurance,
      deliveryModality,
      beneficiaryName,
      beneficiaryRut,
      displayName: buildSeriesDisplayName({
        kind: series.kind as ClinicalSeriesKind,
        patientName,
        patientRut,
      }),
      expectedSessions: computeExpectedSessions(series.events),
      patientName,
      patientRut,
    },
  });
}

// Run items concurrently using N "queue-draining" workers.
// Workers share a mutable queue; JS single-threaded shift() is safe without locks.
async function runConcurrent<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  const queue = [...items];
  async function worker(): Promise<void> {
    let item: T | undefined;
    while ((item = queue.shift()) !== undefined) {
      await fn(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
}

// Batch loader — one query for all events instead of N individual round trips.
async function loadEventSeriesCandidatesByIds(
  eventIds: number[],
): Promise<EventSeriesCandidate[]> {
  if (eventIds.length === 0) return [];
  return db.$queryRaw<EventSeriesCandidate[]>`
    SELECT
      e.id AS "eventId",
      c.google_id AS "calendarGoogleId",
      e.external_event_id AS "externalEventId",
      e.patient_name AS "patientName",
      e.patient_rut AS "patientRut",
      e.beneficiary_name AS "beneficiaryName",
      e.beneficiary_rut AS "beneficiaryRut",
      COALESCE(to_char(e.start_date, 'YYYY-MM-DD'), to_char((e.start_date_time AT TIME ZONE ${TIMEZONE})::date, 'YYYY-MM-DD')) AS "eventDate",
      e.summary AS "summary",
      e.description AS "description",
      e.category AS "category",
      e.clinical_series_id AS "clinicalSeriesId",
      e.series_stage_kind AS "seriesStageKind",
      e.series_stage_label AS "seriesStageLabel",
      e.series_stage_number AS "seriesStageNumber",
      e.treatment_stage AS "treatmentStage",
      e.test_metadata AS "testMetadata",
      e.amount_expected AS "amountExpected",
      e.amount_paid AS "amountPaid"
    FROM events e
    JOIN calendars c ON c.id = e.calendar_id
    WHERE e.id = ANY(${eventIds}::int[])
    ORDER BY e.id ASC
  `;
}

// Core per-event sync logic — load-agnostic. Returns the series ID that was
// touched (for the caller to schedule a deduplicated metadata refresh), or
// null if the event does not qualify for a clinical series.
async function assignEventToSeries(event: EventSeriesCandidate, ctx?: SeriesAssignmentContext): Promise<null | number> {
  const kind = inferSeriesKind(event);
  const inferredMetadata = parseCalendarMetadata({
    description: event.description,
    summary: event.summary,
  });
  if (!kind) {
    if (event.clinicalSeriesId != null) {
      await db.event.update({
        where: { id: event.eventId },
        data: { clinicalSeries: { disconnect: true } },
      });
    }
    return null;
  }

  const identity = resolveClinicalIdentity(event.summary, event.description, {
    beneficiaryName: event.beneficiaryName,
    beneficiaryRut: event.beneficiaryRut,
    patientName: event.patientName,
    patientRut: event.patientRut,
  });

  const eventPatch = {
    beneficiaryName: identity.beneficiaryName,
    beneficiaryRut: identity.beneficiaryRut,
    patientName: identity.patientName,
    patientRut: identity.patientRut,
    seriesStageKind: inferredMetadata.seriesStageKind ?? null,
    seriesStageLabel: inferredMetadata.seriesStageLabel ?? null,
    seriesStageNumber: inferredMetadata.seriesStageNumber ?? null,
    treatmentStage: inferredMetadata.treatmentStage ?? null,
  };

  await db.event.update({
    where: { id: event.eventId },
    data: eventPatch,
  });

  if (!identity.patientName && !identity.patientRut) {
    return event.clinicalSeriesId ?? null;
  }

  // Always call findMatchingSeries first — it returns the oldest canonical series
  // for this patient+kind by ordering candidates id ASC and preferring the one
  // with the smallest date distance. This ensures that during a rebuild an event
  // already sitting in a newer duplicate series gets re-assigned to the original.
  let targetSeriesId = await findMatchingSeries(
    {
      beneficiaryRut: identity.beneficiaryRut,
      eventDate: event.eventDate,
      kind,
      patientName: identity.patientName,
      patientRut: identity.patientRut,
    },
    ctx,
  );

  // Fallback: if nothing found but the event already has a compatible series
  // (e.g. brand-new patient, no prior series of this kind), keep it there.
  if (!targetSeriesId && event.clinicalSeriesId != null) {
    // Use context entry when available — avoids a DB round trip.
    const current = ctx?.seriesById.get(event.clinicalSeriesId) ?? await db.clinicalSeries.findUnique({
      where: { id: event.clinicalSeriesId },
      select: { beneficiaryRut: true, id: true, kind: true, patientRut: true },
    });
    if (
      current?.kind === kind &&
      (!identity.patientRut || !current.patientRut || current.patientRut === identity.patientRut) &&
      (!identity.beneficiaryRut || !current.beneficiaryRut || current.beneficiaryRut === identity.beneficiaryRut)
    ) {
      targetSeriesId = current.id;
    }
  }

  const eventDateDjs = dayjs.tz(event.eventDate, TIMEZONE);

  if (!targetSeriesId) {
    const created = await db.clinicalSeries.create({
      data: {
        beneficiaryName: identity.beneficiaryName,
        beneficiaryRut: identity.beneficiaryRut,
        displayName: buildSeriesDisplayName({ kind, patientName: identity.patientName, patientRut: identity.patientRut }),
        expectedSessions:
          event.seriesStageNumber != null && Number.isFinite(event.seriesStageNumber)
            ? event.seriesStageNumber
            : null,
        kind,
        patientName: identity.patientName,
        patientRut: identity.patientRut,
      },
      select: { id: true },
    });
    targetSeriesId = created.id;
    // Register new series in the context so subsequent events find it.
    ctx?.register({
      beneficiaryName: identity.beneficiaryName,
      beneficiaryRut: identity.beneficiaryRut,
      eventCount: 1,
      id: targetSeriesId,
      kind,
      maxDate: eventDateDjs,
      minDate: eventDateDjs,
      patientName: identity.patientName,
      patientRut: identity.patientRut,
    });
  }

  if (event.clinicalSeriesId !== targetSeriesId) {
    await db.event.update({
      where: { id: event.eventId },
      data: { clinicalSeries: { connect: { id: targetSeriesId } } },
    });
  }

  // Extend the series' date span so subsequent events get accurate distances.
  ctx?.touch(targetSeriesId, eventDateDjs);

  return targetSeriesId;
}

export async function syncClinicalSeriesForInternalEventId(
  eventId: number,
): Promise<null | number> {
  const event = await loadEventSeriesCandidateByInternalId(eventId);
  if (!event) return null;
  const seriesId = await assignEventToSeries(event);
  if (seriesId != null) await refreshClinicalSeriesMetadata(seriesId);
  return seriesId;
}

export async function syncClinicalSeriesForEventIds(
  eventIds: number[],
  onProgress?: (processed: number, total: number) => void,
) {
  const unique = [...new Set(eventIds.filter((value) => Number.isFinite(value) && value > 0))];
  if (unique.length === 0) return;
  const total = unique.length;

  // One query for all events + one query for all existing series — no per-event DB lookups.
  const [events, ctx] = await Promise.all([
    loadEventSeriesCandidatesByIds(unique),
    SeriesAssignmentContext.load(),
  ]);

  // Collect which series were touched so we can refresh metadata exactly once
  // per series at the end — eliminates redundant refreshes and race conditions
  // when the same series has multiple events in the batch.
  const touchedSeriesIds = new Set<number>();
  let processed = 0;

  // 8 concurrent workers sharing a queue — ~8x throughput vs serial processing.
  await runConcurrent(events, 8, async (event) => {
    const seriesId = await assignEventToSeries(event, ctx).catch(() => null);
    if (seriesId != null) touchedSeriesIds.add(seriesId);
    processed++;
    onProgress?.(processed, total);
  });

  // Refresh each touched series once, also concurrently.
  // Errors are isolated per series so one failure doesn't abort the rest.
  await runConcurrent([...touchedSeriesIds], 8, (id) =>
    refreshClinicalSeriesMetadata(id).catch((err: unknown) => {
      console.error(`[clinical-series] refreshClinicalSeriesMetadata(${id}) failed:`, err);
    }),
  );
}

export async function syncClinicalSeriesForExternalEvents(
  events: Array<{ calendarId: string; eventId: string }>,
) {
  for (const event of events) {
    const row = await loadEventSeriesCandidateByExternalIds(event.calendarId, event.eventId);
    if (!row) {
      continue;
    }
    await syncClinicalSeriesForInternalEventId(row.eventId);
  }
}

/**
 * Computes and persists the derived status for all clinical series based on
 * event schedule and series kind. Preserves CANCELLED status.
 *
 * Tests (PATCH_TEST, SKIN_TEST):
 *   PLANNED   → no events whose scheduled instant has started yet
 *   ACTIVE    → at least one event has started and there are future events pending
 *   COMPLETED → at least one event has started and no future events remain
 *
 * Subcutaneous treatment:
 *   PLANNED   → no events whose scheduled instant has started yet
 *   ACTIVE    → last started event ≤ 60 days ago
 *   INACTIVE  → last event 61–180 days ago
 *   COMPLETED → last started event > 180 days ago
 */
export async function updateAllSeriesStatuses(): Promise<{ updated: number }> {
  const today = dayjs().tz(TIMEZONE).format("YYYY-MM-DD");
  const now = dayjs().tz(TIMEZONE).toDate();
  const result = await db.$executeRaw`
    UPDATE clinical_series cs
    SET status = (
      -- Preserve manual CANCELLED
      CASE WHEN cs.status = 'CANCELLED' THEN 'CANCELLED'::\"ClinicalSeriesStatus\"
      ELSE (
        WITH event_dates AS (
          SELECT
            MAX(
              CASE
                WHEN COALESCE(
                  e.start_date_time AT TIME ZONE ${TIMEZONE},
                  e.start_date::timestamp AT TIME ZONE ${TIMEZONE}
                ) <= ${now}::timestamptz
                THEN COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date)
              END
            ) AS last_past,
            MIN(
              CASE
                WHEN COALESCE(
                  e.start_date_time AT TIME ZONE ${TIMEZONE},
                  e.start_date::timestamp AT TIME ZONE ${TIMEZONE}
                ) > ${now}::timestamptz
                THEN COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date)
              END
            ) AS next_future
          FROM events e
          WHERE e.clinical_series_id = cs.id
        )
        SELECT
          CASE cs.kind
            WHEN 'SUBCUTANEOUS_TREATMENT' THEN
              CASE
                WHEN (SELECT last_past FROM event_dates) IS NULL                                THEN 'PLANNED'
                WHEN (SELECT last_past FROM event_dates) >= (${today}::date - INTERVAL '60 days')  THEN 'ACTIVE'
                WHEN (SELECT last_past FROM event_dates) >= (${today}::date - INTERVAL '180 days') THEN 'INACTIVE'
                ELSE 'COMPLETED'
              END
            ELSE -- PATCH_TEST, SKIN_TEST
              CASE
                WHEN (SELECT last_past FROM event_dates) IS NULL                                THEN 'PLANNED'
                WHEN (SELECT next_future FROM event_dates) IS NOT NULL                          THEN 'ACTIVE'
                ELSE 'COMPLETED'
              END
          END::\"ClinicalSeriesStatus\"
        FROM event_dates
      )
      END
    )
  `;
  return { updated: result };
}

export async function rebuildClinicalSeries(
  params?: { autoMerge?: boolean; from?: string; to?: string },
  onProgress?: (processed: number, total: number) => void,
) {
  const rows = await db.$queryRaw<Array<{ eventId: number }>>`
    SELECT e.id AS "eventId"
    FROM events e
    WHERE (
      e.category IN ('Test y exámenes', 'Tratamiento subcutáneo')
      OR e.clinical_series_id IS NOT NULL
    )
      AND (
        ${params?.from ?? null}::date IS NULL
        OR COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) >= ${params?.from ?? null}::date
      )
      AND (
        ${params?.to ?? null}::date IS NULL
        OR COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) <= ${params?.to ?? null}::date
      )
    ORDER BY COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) ASC, e.id ASC
  `;

  const total = rows.length;
  // Signal total is now known before processing starts
  onProgress?.(0, total);
  await syncClinicalSeriesForEventIds(rows.map((row) => row.eventId), onProgress);

  // Cleanup: delete series that ended up with no events after reassignment.
  const { count: deleted } = await db.clinicalSeries.deleteMany({
    where: { events: { none: {} } },
  });

  // Dedup pass: merge duplicates only when explicitly requested
  let deduped = 0;
  if (params?.autoMerge) {
    const duplicates = await detectDuplicateSeries();
    for (const dup of duplicates) {
      await mergeClinicalSeries({ isAuto: true, mergeReason: dup.reason, sourceId: dup.sourceId, targetId: dup.targetId });
    }
    deduped = duplicates.length;
  }

  // Update derived statuses for all series based on event dates.
  await updateAllSeriesStatuses();

  return {
    deleted,
    deduped,
    from: params?.from ?? null,
    processed: total,
    to: params?.to ?? null,
  };
}

// ─── Rebuild Job State (SSE progress) ────────────────────────────────────────

export interface RebuildJob {
  error?: string;
  from: null | string;
  jobId: string;
  processed: number;
  progress: number;
  status: "completed" | "failed" | "running";
  currentStep: string;
  to: null | string;
  total: number;
}

let currentRebuildJob: null | RebuildJob = null;

export function getCurrentRebuildJob(): null | RebuildJob {
  return currentRebuildJob;
}

export function startRebuildClinicalSeries(params?: { autoMerge?: boolean; from?: string; to?: string }): string {
  const jobId = `rebuild-${Date.now()}`;
  currentRebuildJob = {
    jobId,
    status: "running",
    progress: 0,
    processed: 0,
    total: 0,
    currentStep: "Consultando eventos...",
    from: params?.from ?? null,
    to: params?.to ?? null,
  };

  rebuildClinicalSeries(params, (processed, total) => {
    if (!currentRebuildJob || currentRebuildJob.jobId !== jobId) return;
    currentRebuildJob.processed = processed;
    currentRebuildJob.total = total;
    currentRebuildJob.progress = total > 0 ? Math.round((processed / total) * 100) : 0;
    currentRebuildJob.currentStep =
      processed === 0
        ? `${total} eventos encontrados, reorganizando...`
        : `Reorganizando ${processed} de ${total}...`;
  })
    .then((result) => {
      if (!currentRebuildJob || currentRebuildJob.jobId !== jobId) return;
      currentRebuildJob.status = "completed";
      currentRebuildJob.progress = 100;
      currentRebuildJob.processed = result.processed;
      currentRebuildJob.currentStep =
        result.deduped > 0
          ? `${result.processed} eventos procesados · ${result.deduped} serie${result.deduped !== 1 ? "s" : ""} fusionada${result.deduped !== 1 ? "s" : ""}`
          : `${result.processed} eventos procesados`;
      setTimeout(() => {
        if (currentRebuildJob?.jobId === jobId) currentRebuildJob = null;
      }, 8000);
    })
    .catch((err: unknown) => {
      if (!currentRebuildJob || currentRebuildJob.jobId !== jobId) return;
      currentRebuildJob.status = "failed";
      currentRebuildJob.error = err instanceof Error ? err.message : "Error desconocido";
      setTimeout(() => {
        if (currentRebuildJob?.jobId === jobId) currentRebuildJob = null;
      }, 8000);
    });

  return jobId;
}

export async function getClinicalSeriesSnapshotByExternalEvent(params: {
  calendarId: string;
  eventId: string;
}): Promise<ClinicalSeriesSnapshot | null> {
  const event = await loadEventSeriesCandidateByExternalIds(params.calendarId, params.eventId);
  if (!event?.clinicalSeriesId) {
    return null;
  }

  const series = await db.clinicalSeries.findUnique({
    where: { id: event.clinicalSeriesId },
    include: {
      events: {
        include: {
          calendar: {
            select: {
              googleId: true,
            },
          },
        },
        orderBy: [{ startDate: "asc" }, { startDateTime: "asc" }, { id: "asc" }],
      },
    },
  });

  // note: dosageValue and dosageUnit are included via the ORM (no extra selection needed)

  if (!series) {
    return null;
  }

  const linkedDocuments = await db.$queryRaw<ClinicalSeriesLinkedDocument[]>`
    SELECT DISTINCT ON (s.id)
      s.id AS "dteSaleDetailId",
      s.client_name AS "clientName",
      s.client_rut AS "clientRUT",
      to_char(s.document_date, 'YYYY-MM-DD') AS "documentDate",
      s.folio AS "folio",
      COALESCE(s.total_amount, 0)::float AS "totalAmount",
      l.matched_by AS "matchedBy",
      l.confidence_score::float AS "confidenceScore"
    FROM event_dte_sale_links l
    JOIN events e ON e.id = l.event_id
    JOIN dte_sale_details s ON s.id = l.dte_sale_detail_id
    WHERE e.clinical_series_id = ${series.id}
      AND l.status != 'REJECTED'
    ORDER BY s.id, l.updated_at DESC
  `;

  const eventFolioRows = await db.$queryRaw<Array<{ eventId: number; folios: string[] }>>`
    SELECT l.event_id AS "eventId", ARRAY_AGG(s.folio ORDER BY s.document_date) AS "folios"
    FROM event_dte_sale_links l
    JOIN events e ON e.id = l.event_id
    JOIN dte_sale_details s ON s.id = l.dte_sale_detail_id
    WHERE e.clinical_series_id = ${series.id}
      AND l.status != 'REJECTED'
    GROUP BY l.event_id
  `;
  const foliosByEventId = new Map(eventFolioRows.map((r) => [r.eventId, r.folios]));
  const identityRuts = [series.patientRut, series.beneficiaryRut].filter(
    (value): value is string => Boolean(value),
  );
  const identityRows =
    identityRuts.length > 0
      ? await db.$queryRaw<Array<{ phone: null | string; rut: string }>>`
          SELECT p.rut, p.phone
          FROM people p
          WHERE p.rut IN (${sql.join(identityRuts.map((value) => sql`${value}`), sql`, `)})
        `
      : [];
  const phoneByRut = new Map(
    identityRows.map((row) => [normalizeRut(row.rut) ?? row.rut, row.phone ?? null]),
  );

  const events = series.events.map((item) => ({
    amountExpected: item.amountExpected,
    amountPaid: item.amountPaid,
    beneficiaryName: item.beneficiaryName ?? null,
    beneficiaryRut: item.beneficiaryRut ?? null,
    calendarGoogleId: item.calendar.googleId,
    dosageUnit: item.dosageUnit ?? null,
    dosageValue: item.dosageValue ?? null,
    eventDate: dayjs(item.startDate ?? item.startDateTime ?? item.endDate ?? item.endDateTime)
      .tz(TIMEZONE)
      .format("YYYY-MM-DD"),
    eventId: item.id,
    externalEventId: item.externalEventId,
    linkedFolios: foliosByEventId.get(item.id) ?? [],
    patientName: item.patientName ?? null,
    patientRut: item.patientRut ?? null,
    seriesStageKind: (item.seriesStageKind as ClinicalSeriesStageKind | null) ?? null,
    seriesStageLabel: item.seriesStageLabel ?? null,
    seriesStageNumber: item.seriesStageNumber ?? null,
    summary: item.summary ?? null,
  }));

  const totalLinkedAmount = linkedDocuments.reduce((sum, item) => sum + item.totalAmount, 0);
  const today = dayjs().tz(TIMEZONE).format("YYYY-MM-DD");
  const dueEvents = events.filter((item) => isPastOrTodayEvent(item.eventDate, today));
  const totalExpectedDue = dueEvents.reduce((sum, item) => sum + (item.amountExpected ?? 0), 0);
  const totalPaidDue = dueEvents.reduce((sum, item) => sum + (item.amountPaid ?? 0), 0);
  const eventDates = events.map((item) => item.eventDate).sort();
  const startDate = eventDates[0] ?? dayjs().tz(TIMEZONE).format("YYYY-MM-DD");
  const endDate = eventDates[eventDates.length - 1] ?? startDate;
  const eligibleDocumentDateFrom = dayjs
    .tz(startDate, TIMEZONE)
    .subtract(7, "day")
    .format("YYYY-MM-DD");
  const eligibleDocumentDateTo = dayjs
    .tz(endDate, TIMEZONE)
    .add(30, "day")
    .endOf("day")
    .isAfter(dayjs().tz(TIMEZONE))
    ? dayjs().tz(TIMEZONE).format("YYYY-MM-DD")
    : dayjs.tz(endDate, TIMEZONE).add(30, "day").format("YYYY-MM-DD");

  return {
    allergenType: (series.allergenType as SubcutaneousAllergenType | null) ?? null,
    vaccineProduct: (series.vaccineProduct as SubcutaneousVaccineProduct | null) ?? null,
    healthInsurance: (series.healthInsurance as HealthInsuranceType | null) ?? null,
    deliveryModality: (series.deliveryModality as DeliveryModality | null) ?? null,
    beneficiaryName: series.beneficiaryName ?? null,
    beneficiaryPhone:
      (series.beneficiaryRut
        ? phoneByRut.get(normalizeRut(series.beneficiaryRut) ?? series.beneficiaryRut)
        : null) ?? null,
    beneficiaryRut: series.beneficiaryRut ?? null,
    displayName: series.displayName ?? null,
    eligibleDocumentDateFrom,
    eligibleDocumentDateTo,
    events,
    id: series.id,
    kind: series.kind as ClinicalSeriesKind,
    linkedDocuments,
    patientName: series.patientName ?? null,
    patientPhone:
      (series.patientRut
        ? phoneByRut.get(normalizeRut(series.patientRut) ?? series.patientRut)
        : null) ?? null,
    patientRut: series.patientRut ?? null,
    remainingExpected: Math.max(0, totalExpectedDue - totalLinkedAmount),
    remainingPaid: Math.max(0, totalPaidDue - totalLinkedAmount),
    status: series.status as ClinicalSeriesSnapshot["status"],
    totalExpected: totalExpectedDue,
    totalLinkedAmount,
    totalPaid: totalPaidDue,
  };
}

export async function getClinicalSeriesSnapshotById(id: number): Promise<ClinicalSeriesSnapshot | null> {
  const series = await db.clinicalSeries.findUnique({
    where: { id },
    include: {
      events: {
        include: {
          calendar: {
            select: {
              googleId: true,
            },
          },
        },
        orderBy: [{ startDate: "asc" }, { startDateTime: "asc" }, { id: "asc" }],
      },
    },
  });
  // dosageValue and dosageUnit are fetched as part of standard event fields via ORM

  if (!series) {
    return null;
  }

  const syntheticEvent = series.events[0];
  if (!syntheticEvent) {
    return {
      allergenType: (series.allergenType as SubcutaneousAllergenType | null) ?? null,
      beneficiaryName: series.beneficiaryName ?? null,
      beneficiaryPhone: null,
      beneficiaryRut: series.beneficiaryRut ?? null,
      deliveryModality: (series.deliveryModality as DeliveryModality | null) ?? null,
      displayName: series.displayName ?? null,
      eligibleDocumentDateFrom: dayjs().tz(TIMEZONE).format("YYYY-MM-DD"),
      eligibleDocumentDateTo: dayjs().tz(TIMEZONE).format("YYYY-MM-DD"),
      events: [],
      healthInsurance: (series.healthInsurance as HealthInsuranceType | null) ?? null,
      id: series.id,
      kind: series.kind as ClinicalSeriesKind,
      linkedDocuments: [],
      patientName: series.patientName ?? null,
      patientPhone: null,
      patientRut: series.patientRut ?? null,
      remainingExpected: 0,
      remainingPaid: 0,
      status: series.status as ClinicalSeriesSnapshot["status"],
      vaccineProduct: (series.vaccineProduct as SubcutaneousVaccineProduct | null) ?? null,
      totalExpected: 0,
      totalLinkedAmount: 0,
      totalPaid: 0,
    };
  }

  return getClinicalSeriesSnapshotByExternalEvent({
    calendarId: syntheticEvent.calendar.googleId,
    eventId: syntheticEvent.externalEventId,
  });
}

export async function listClinicalSeriesSnapshots(filters?: ClinicalSeriesFilters) {
  const page = Math.max(1, filters?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters?.pageSize ?? 20));
  const today = dayjs().tz(TIMEZONE).format("YYYY-MM-DD");
  const normalizedBeneficiaryRut = filters?.beneficiaryRut ? normalizeRut(filters.beneficiaryRut) : null;
  const normalizedPatientRut = filters?.patientRut ? normalizeRut(filters.patientRut) : null;
  const normalizedPatientName = filters?.patientName ? `%${normalizeName(filters.patientName)}%` : null;
  const normalizedPatientPhone = filters?.patientPhone ? `%${normalizePhoneSearch(filters.patientPhone)}%` : null;
  const nextVisitFrom = filters?.nextVisitFrom ?? null;
  const nextVisitTo = filters?.nextVisitTo ?? null;
  const normalizedQuery = filters?.query ? normalizeName(filters.query) : null;
  const queryRut = filters?.query ? normalizeRut(filters.query) : null;
  const queryPhone = filters?.query ? normalizePhoneSearch(filters.query) : null;
  const queryTokens = normalizedQuery
    ? normalizedQuery
        .split(" ")
        .map((token) => token.trim())
        .filter((token) => token.length >= 2)
    : [];

  const textHaystack = sql`lower(concat_ws(' ', coalesce(cs.patient_name, ''), coalesce(cs.beneficiary_name, ''), coalesce(cs.display_name, ''), coalesce(cs.patient_rut, ''), coalesce(cs.beneficiary_rut, ''), coalesce(pp.phone, ''), coalesce(pb.phone, '')))`;
  const queryFilterSql =
    normalizedQuery || queryRut || queryPhone
      ? sql`(
          (${queryRut}::text IS NOT NULL AND (cs.patient_rut = ${queryRut} OR cs.beneficiary_rut = ${queryRut}))
          OR (${queryPhone}::text IS NOT NULL AND (regexp_replace(coalesce(pp.phone, ''), '\D', '', 'g') LIKE ${queryPhone ? `%${queryPhone}%` : null} OR regexp_replace(coalesce(pb.phone, ''), '\D', '', 'g') LIKE ${queryPhone ? `%${queryPhone}%` : null}))
          OR (${normalizedQuery ? `%${normalizedQuery}%` : null}::text IS NOT NULL AND ${textHaystack} LIKE ${normalizedQuery ? `%${normalizedQuery}%` : null})
          OR ${
            queryTokens.length > 0
              ? sql.join(
                  queryTokens.map((token) => sql`${textHaystack} LIKE ${`%${token}%`}`),
                  sql` AND `,
                )
              : sql`FALSE`
          }
        )`
      : sql`TRUE`;

  // Count total matching records (without pagination)
  const total = Number(
    (
      await sql<{ count: number }>`
        WITH event_stats AS (
          SELECT
            e.clinical_series_id AS series_id,
            MIN(
              CASE
                WHEN COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) > ${today}::date
                THEN COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date)
                ELSE NULL
              END
            ) AS next_event_date
          FROM events e
          WHERE e.clinical_series_id IS NOT NULL
          GROUP BY e.clinical_series_id
        )
        SELECT COUNT(*)::int AS count
        FROM clinical_series cs
        LEFT JOIN event_stats es ON es.series_id = cs.id
        LEFT JOIN people pp ON pp.rut = cs.patient_rut
        LEFT JOIN people pb ON pb.rut = cs.beneficiary_rut
        WHERE (${normalizedBeneficiaryRut}::text IS NULL OR cs.beneficiary_rut = ${normalizedBeneficiaryRut})
          AND (${filters?.kind ?? null}::text IS NULL OR cs.kind::text = ${filters?.kind ?? null})
          AND (${filters?.status ?? null}::text IS NULL OR cs.status::text = ${filters?.status ?? null})
          AND (${normalizedPatientRut}::text IS NULL OR cs.patient_rut = ${normalizedPatientRut})
          AND (${normalizedPatientName}::text IS NULL OR lower(coalesce(cs.patient_name, '')) LIKE ${normalizedPatientName})
          AND (${normalizedPatientPhone}::text IS NULL OR regexp_replace(coalesce(pp.phone, ''), '\D', '', 'g') LIKE ${normalizedPatientPhone} OR regexp_replace(coalesce(pb.phone, ''), '\D', '', 'g') LIKE ${normalizedPatientPhone})
          AND (${nextVisitFrom}::date IS NULL OR es.next_event_date >= ${nextVisitFrom}::date)
          AND (${nextVisitTo}::date IS NULL OR es.next_event_date <= ${nextVisitTo}::date)
          AND ${queryFilterSql}
      `.execute(kysely)
    ).rows[0]?.count ?? 0,
  );

  const orderBy = resolveClinicalSeriesOrderBy(filters);
  const seriesResult = await sql<{ id: number }>`
    WITH event_stats AS (
      SELECT
        e.clinical_series_id AS series_id,
        MAX(
          CASE
            WHEN COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) <= ${today}::date
            THEN COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date)
            ELSE NULL
          END
        ) AS last_event_date,
        MIN(
          CASE
            WHEN COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) > ${today}::date
            THEN COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date)
            ELSE NULL
          END
        ) AS next_event_date,
        COUNT(*)::int AS total_events,
        SUM(
          CASE
            WHEN COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) > ${today}::date
            THEN 1
            ELSE 0
          END
        )::int AS upcoming_events,
        COALESCE(SUM(e.amount_expected), 0)::float AS total_expected,
        COALESCE(
          SUM(
            CASE
              WHEN COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) <= ${today}::date
              THEN e.amount_expected
              ELSE 0
            END
          ),
          0
        )::float AS total_expected_due
      FROM events e
      WHERE e.clinical_series_id IS NOT NULL
      GROUP BY e.clinical_series_id
    ),
    linked_totals AS (
      SELECT
        linked.series_id,
        COALESCE(SUM(linked.total_amount), 0)::float AS total_linked_amount
      FROM (
        SELECT DISTINCT ON (e.clinical_series_id, s.id)
          e.clinical_series_id AS series_id,
          COALESCE(s.total_amount, 0) AS total_amount
        FROM event_dte_sale_links l
        JOIN events e ON e.id = l.event_id
        JOIN dte_sale_details s ON s.id = l.dte_sale_detail_id
        WHERE e.clinical_series_id IS NOT NULL
        ORDER BY e.clinical_series_id, s.id, l.updated_at DESC
      ) AS linked
      GROUP BY linked.series_id
    )
    SELECT cs.id
    FROM clinical_series cs
    LEFT JOIN event_stats es ON es.series_id = cs.id
    LEFT JOIN linked_totals lt ON lt.series_id = cs.id
    LEFT JOIN people pp ON pp.rut = cs.patient_rut
    LEFT JOIN people pb ON pb.rut = cs.beneficiary_rut
    WHERE (${normalizedBeneficiaryRut}::text IS NULL OR cs.beneficiary_rut = ${normalizedBeneficiaryRut})
      AND (${filters?.kind ?? null}::text IS NULL OR cs.kind::text = ${filters?.kind ?? null})
      AND (${filters?.status ?? null}::text IS NULL OR cs.status::text = ${filters?.status ?? null})
      AND (${normalizedPatientName}::text IS NULL OR lower(coalesce(cs.patient_name, '')) LIKE ${normalizedPatientName})
      AND (${normalizedPatientRut}::text IS NULL OR cs.patient_rut = ${normalizedPatientRut})
      AND (${normalizedPatientPhone}::text IS NULL OR regexp_replace(coalesce(pp.phone, ''), '\D', '', 'g') LIKE ${normalizedPatientPhone} OR regexp_replace(coalesce(pb.phone, ''), '\D', '', 'g') LIKE ${normalizedPatientPhone})
      AND (${nextVisitFrom}::date IS NULL OR es.next_event_date >= ${nextVisitFrom}::date)
      AND (${nextVisitTo}::date IS NULL OR es.next_event_date <= ${nextVisitTo}::date)
      AND ${queryFilterSql}
    ORDER BY ${orderBy}
    LIMIT ${pageSize}
    OFFSET ${(page - 1) * pageSize}
  `.execute(kysely);

  const series = seriesResult.rows;

  const items = (
    await Promise.all(series.map((item) => getClinicalSeriesSnapshotById(item.id)))
  ).filter((item): item is ClinicalSeriesSnapshot => item != null);

  return { items, page, pageSize, total };
}

// ─── Duplicate Detection & Merge ─────────────────────────────────────────────

/**
 * Returns true only if the normalized name has at least 2 tokens that are NOT
 * in the clinical stopword list and are at least 3 characters long.
 * Prevents product/test names like "multitest aero" from matching as persons.
 */
function isLikelyPersonName(name: string): boolean {
  const normalized = normalizeName(name);
  const significantTokens = normalized
    .split(" ")
    .filter((t) => t.length >= 3 && !LOWERCASE_NAME_STOPWORDS.has(t));
  return significantTokens.length >= 2;
}

export interface ClinicalSeriesDuplicate {
  confidence: "high" | "medium";
  kind: ClinicalSeriesKind;
  patientName: null | string;
  reason: string;
  sourceEventCount: number;
  sourceId: number;
  sourcePatientName: null | string;
  sourcePatientRut: null | string;
  targetEventCount: number;
  targetId: number;
}

export async function detectDuplicateSeries(): Promise<ClinicalSeriesDuplicate[]> {
  // Fetch all series that have at least one event, ordered by id ASC so the
  // lower (older) id becomes the target and the higher (newer) becomes source.
  type SeriesRow = {
    beneficiaryName: null | string;
    beneficiaryRut: null | string;
    id: number;
    kind: ClinicalSeriesKind;
    patientName: string | null;
    patientRut: string | null;
    _count: { events: number };
  };
  const allSeries: SeriesRow[] = await db.clinicalSeries.findMany({
    select: {
      beneficiaryName: true,
      beneficiaryRut: true,
      id: true,
      kind: true,
      patientName: true,
      patientRut: true,
      _count: { select: { events: true } },
    },
    where: { events: { some: {} } },
    orderBy: { id: "asc" },
  });

  const results: ClinicalSeriesDuplicate[] = [];
  const usedAsSources = new Set<number>();

  const chooseCanonicalTarget = (group: SeriesRow[]): SeriesRow =>
    [...group].sort((a, b) => {
      const scoreDelta =
        scoreClinicalSeriesIdentityQuality({
          beneficiaryName: b.beneficiaryName,
          beneficiaryRut: b.beneficiaryRut,
          eventCount: b._count.events,
          patientName: b.patientName,
          patientRut: b.patientRut,
        }) -
        scoreClinicalSeriesIdentityQuality({
          beneficiaryName: a.beneficiaryName,
          beneficiaryRut: a.beneficiaryRut,
          eventCount: a._count.events,
          patientName: a.patientName,
          patientRut: a.patientRut,
        });
      if (scoreDelta !== 0) return scoreDelta;
      const eventDelta = b._count.events - a._count.events;
      if (eventDelta !== 0) return eventDelta;
      return a.id - b.id;
    })[0]!;

  // ── Pass 1: RUT-based grouping — O(n) ────────────────────────────────────
  // Group by (normalizedRut, beneficiaryRut, kind). Series with different
  // beneficiaryRuts serve different patients (e.g. family members under one
  // account) and must NOT be treated as duplicates.
  const rutGroups = new Map<string, SeriesRow[]>();
  for (const s of allSeries) {
    if (!s.patientRut) continue;
    const key = `${normalizeRut(s.patientRut)}:${s.beneficiaryRut ?? ""}:${s.kind}`;
    const group = rutGroups.get(key);
    if (group) group.push(s);
    else rutGroups.set(key, [s]);
  }

  for (const group of rutGroups.values()) {
    if (group.length < 2) continue;
    const target = chooseCanonicalTarget(group);
    for (const src of group) {
      if (src.id === target.id) continue;
      results.push({
        confidence: "high",
        kind: target.kind,
        patientName: target.patientName,
        reason: `Mismo RUT de paciente (${target.patientRut})`,
        sourceEventCount: src._count.events,
        sourceId: src.id,
        sourcePatientName: src.patientName,
        sourcePatientRut: src.patientRut,
        targetEventCount: target._count.events,
        targetId: target.id,
      });
      usedAsSources.add(src.id);
    }
  }

  // ── Pass 2: name-based grouping — O(n) ───────────────────────────────────
  // Group by (normalizedName, kind), ignoring series already used as sources.
  // Only groups of exactly 2 are merged — 3+ with the same name are likely
  // different patients sharing a common name, so we leave them alone.
  const nameGroups = new Map<string, SeriesRow[]>();
  for (const s of allSeries) {
    if (!s.patientName || usedAsSources.has(s.id)) continue;
    const normalized = normalizeName(s.patientName);
    if (!isLikelyPersonName(normalized)) continue;
    const key = `${normalized}:${s.kind}`;
    const group = nameGroups.get(key);
    if (group) group.push(s);
    else nameGroups.set(key, [s]);
  }

  for (const group of nameGroups.values()) {
    if (group.length !== 2) continue;
    const target = chooseCanonicalTarget(group);
    const src = group.find((series) => series.id !== target.id);
    if (!src) continue;
    if (hasConflictingPrimaryIdentity(target, src)) continue;
    results.push({
      confidence: "high",
      kind: target.kind,
      patientName: target.patientName,
      reason: `Mismo nombre de paciente (${target.patientName})`,
      sourceEventCount: src._count.events,
      sourceId: src.id,
      sourcePatientName: src.patientName,
      sourcePatientRut: src.patientRut,
      targetEventCount: target._count.events,
      targetId: target.id,
    });
    usedAsSources.add(src.id);
  }

  return results;
}

export async function mergeClinicalSeries(params: {
  isAuto?: boolean;
  mergeReason?: string;
  mergedBy?: number;
  sourceId: number;
  targetId: number;
}): Promise<{ eventsMovedCount: number }> {
  const [source, target] = await Promise.all([
    db.clinicalSeries.findUnique({ select: { id: true, kind: true }, where: { id: params.sourceId } }),
    db.clinicalSeries.findUnique({ select: { id: true, kind: true }, where: { id: params.targetId } }),
  ]);

  if (!source) throw new Error(`Serie fuente #${params.sourceId} no encontrada`);
  if (!target) throw new Error(`Serie destino #${params.targetId} no encontrada`);
  if (source.kind !== target.kind) {
    throw new Error(
      `No se pueden fusionar series de distinto tipo (${source.kind} vs ${target.kind})`,
    );
  }

  const eventsMovedCount = await db.$transaction(async (tx) => {
    const { count } = await tx.event.updateMany({
      where: { clinicalSeriesId: params.sourceId },
      data: { clinicalSeriesId: params.targetId },
    });

    await tx.$executeRaw`
      INSERT INTO clinical_series_merge_log
        (source_id, target_id, events_moved, merged_by, merge_reason, is_auto)
      VALUES
        (${params.sourceId}, ${params.targetId}, ${count},
         ${params.mergedBy ?? null}, ${params.mergeReason ?? null}, ${params.isAuto ?? false})
    `;

    await tx.clinicalSeries.delete({ where: { id: params.sourceId } });

    return count;
  });

  await refreshClinicalSeriesMetadata(params.targetId);

  return { eventsMovedCount };
}

import { db, kysely } from "@finanzas/db";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
import { sql } from "kysely";
import { normalizeRut } from "../lib/rut";

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = "America/Santiago";
const RUT_REGEX = /\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]\b/g;
const LOWERCASE_NAME_STOPWORDS = new Set([
  // Allergy / treatment terms
  "acaros",
  "administracion",
  "aeroalergenos",
  "alimentario",
  "ambiente",
  "ampolla",
  "antigenos",
  "clustoid",
  "confirma",
  "control",
  "cutaneo",
  "dosis",
  "entrega",
  "fase",
  "frasco",
  "gramineas",
  "inyeccion",
  "instalacion",
  "lectura",
  "mantencion",
  "mensual",
  "pagada",
  "pagado",
  "parche",
  "presento",
  "prueba",
  "reaccion",
  "retiro",
  "semanal",
  "semana",
  "subcutaneo",
  "test",
  "tratamiento",
  "vacuna",
  // Vaccine / product names
  "alxoid",
  "clust",
  "cluxin",
  "clustek",
  "forte",
  "multitest",
  "oral",
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
  // Chilean health/admin terms that appear in clinical notes but are not names
  "aer",
  "ali",
  "amb",
  "ambiental",
  "boleta",
  "colmena",
  "consalud",
  "contacto",
  "domicilio",
  "dte",
  "edad",
  "evento",
  "fonasa",
  "hualpen",
  "isapre",
  "lucas",
  "numero",
  "particular",
  "pago",
  "rut",
  "vincular",
  // Communes / cities that appear as patient origin but are not names
  "cauquenes",
  "chillan",
  "concepcion",
  "coronel",
  "lota",
  "penco",
  "talcahuano",
  "tome",
  // Common Spanish words that appear in clinical notes but are not names
  "beneficiario",
  "nombre",
  "paciente",
  "con",
  "del",
  "desde",
  "ella",
  "este",
  "hace",
  "hijo",
  "hija",
  "llego",
  "lleva",
  "llevara",
  "llevo",
  "para",
  "pero",
  "retiran",
  "sale",
  "sera",
  "tiene",
  "trae",
  "traen",
  "venir",
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
  beneficiaryRut: null | string;
  displayName: null | string;
  eligibleDocumentDateFrom: string;
  eligibleDocumentDateTo: string;
  events: ClinicalSeriesEventSnapshot[];
  id: number;
  kind: ClinicalSeriesKind;
  linkedDocuments: ClinicalSeriesLinkedDocument[];
  patientName: null | string;
  patientRut: null | string;
  remainingExpected: number;
  remainingPaid: number;
  status: "ACTIVE" | "CANCELLED" | "COMPLETED";
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
  page?: number;
  pageSize?: number;
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
  status?: "ACTIVE" | "CANCELLED" | "COMPLETED";
};

function normalizeName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function extractLowercaseNameHints(text: string): string[] {
  const normalized = normalizeName(text);
  if (!normalized) return [];

  const tokens = normalized
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);

  const matches = new Set<string>();

  for (let start = 0; start < tokens.length; start += 1) {
    for (let length = 2; length <= 4; length += 1) {
      const candidate = tokens.slice(start, start + length);
      if (candidate.length < 2) continue;
      if (
        candidate.some(
          (token) =>
            token.length < 4 || /\d/.test(token) || LOWERCASE_NAME_STOPWORDS.has(token),
        )
      ) {
        continue;
      }
      // Require at least one "substantial" token to rule out noise pairs.
      // ≥5 chars catches short-but-real names like "Rosa Pineda" / "Sara Mena Gaona"
      // while still filtering generic word pairs like "bien mal".
      if (!candidate.some((token) => token.length >= 5)) {
        continue;
      }

      matches.add(candidate.join(" "));
    }
  }

  return [...matches].sort((a, b) => {
    const tokenDiff = b.split(" ").length - a.split(" ").length;
    if (tokenDiff !== 0) return tokenDiff;
    return b.length - a.length;
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
// This is the highest-confidence source: secretaries typically write the
// patient name right before the RUT ("Nadia Yañez Rojas 12.345.678-9 ...").
function extractRutAdjacentNames(text: string): string[] {
  const results: string[] = [];
  const globalRutRegex = new RegExp(RUT_REGEX.source, "g");
  let m: RegExpExecArray | null;

  while ((m = globalRutRegex.exec(text)) !== null) {
    const raw = text.slice(0, m.index).trim();
    // Strip age annotations like "18 años:", "2 años;" that secretaries
    // write between the patient name and the RUT. Without this, the digit
    // breaks the backwards walk before we reach the name.
    const before = raw.replace(/\b\d{1,3}\s+a[ñn]os?[;:,]?\s*/gi, "").trim();
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
      const n = normalizeName(stripped || token);
      if (!n || /\d/.test(n) || LOWERCASE_NAME_STOPWORDS.has(n)) break;
      if (n.length < 3 && !PARTICLES.has(n)) break;
      nameTokens.unshift(n);
    }
    // Drop leading/trailing particles — a name must start and end with a real token.
    while (nameTokens.length > 0 && PARTICLES.has(nameTokens[0]!)) nameTokens.shift();
    while (nameTokens.length > 0 && PARTICLES.has(nameTokens[nameTokens.length - 1]!)) nameTokens.pop();
    if (nameTokens.length >= 2) results.push(nameTokens.join(" "));
  }

  return [...new Set(results)];
}

// Walk the token stream looking for a token that starts with an uppercase
// letter (likely a name start) and extend it with following tokens that also
// look like name tokens (any case, no stopwords, no digits).
// Handles two common patterns in Chilean medical notes:
//   - "Nadia yañez rojas" — only the first word is Title-cased
//   - "RENATO RIQUELME MUÑOZ" — secretaries sometimes type in ALL-CAPS
function extractCapitalizedStartNames(text: string): string[] {
  const results: string[] = [];
  const tokens = text.split(/\s+/).filter(Boolean);

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    // Accept Title-case ("Nadia") OR all-caps sequences of 3+ letters ("RENATO").
    // Pure lowercase tokens are handled by extractLowercaseNameHints instead.
    const isTitleCase = /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]/.test(token);
    const isAllCaps = /^[A-ZÁÉÍÓÚÑ]{3,}$/.test(token);
    if (!isTitleCase && !isAllCaps) continue;
    const normalized = normalizeName(token);
    if (!normalized || normalized.length < 3 || LOWERCASE_NAME_STOPWORDS.has(normalized)) continue;

    const sequence = [normalized];
    for (let j = i + 1; j < Math.min(i + 4, tokens.length); j++) {
      const next = tokens[j]!;
      // Hyphen-prefixed tokens are field labels ("-Rut:", "-Edad") — stop here.
      if (next.startsWith("-")) break;
      // Tokens like "VIDAUX,vacuna" normalize to "vidaux vacuna" (embedded space).
      // Only use the first word; the rest is a new clause separated by a comma.
      const rawNorm = normalizeName(next);
      const nextNorm = rawNorm.split(" ")[0]!;
      if (!nextNorm || nextNorm.length < 3 || /\d/.test(nextNorm) || LOWERCASE_NAME_STOPWORDS.has(nextNorm)) break;
      sequence.push(nextNorm);
      if (rawNorm !== nextNorm) break; // comma/separator found — don't extend further
    }

    if (sequence.length >= 2) results.push(sequence.join(" "));
  }

  return [...new Set(results)];
}

function extractNamesFromText(text: string): string[] {
  if (!text) return [];
  return [
    ...extractRutAdjacentNames(text),
    ...extractCapitalizedStartNames(text),
    ...extractLowercaseNameHints(text),
  ];
}

export function extractIdentityHints(summary: null | string, description: null | string) {
  // RUTs are extracted from combined text — they appear in either field.
  const combinedText = `${summary ?? ""} ${description ?? ""}`.trim();
  const ruts = [
    ...new Set(
      (combinedText.match(RUT_REGEX) ?? []).map((value) => normalizeRut(value)).filter(Boolean),
    ),
  ];

  // Names: summary always has priority over description.
  // Running extractors separately prevents description noise (clinical notes,
  // field labels like "-Rut del paciente:", previous visit history) from
  // overriding a clearly-identified name in the event title/summary.
  const summaryNames = extractNamesFromText((summary ?? "").trim());
  const descriptionNames = extractNamesFromText((description ?? "").trim());

  const uniqueNames = [...new Set([...summaryNames, ...descriptionNames])];
  const patientRut = ruts[0] ?? null;
  const beneficiaryRut = ruts.find((value) => value !== patientRut) ?? null;
  const patientName = uniqueNames[0] ?? null;
  const beneficiaryName = uniqueNames.find((value) => value !== patientName) ?? null;

  return { beneficiaryName, beneficiaryRut, patientName, patientRut };
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
    const text = `${event.summary ?? ""} ${event.description ?? ""}`;
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
    const text = `${event.summary ?? ""} ${event.description ?? ""}`;
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
    const text = `${event.summary ?? ""} ${event.description ?? ""}`;
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
    const text = `${event.summary ?? ""} ${event.description ?? ""}`;
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

async function findMatchingSeries(params: {
  eventDate: string;
  kind: ClinicalSeriesKind;
  patientName: null | string;
  patientRut: null | string;
}): Promise<null | number> {
  const candidates = await db.clinicalSeries.findMany({
    where: {
      kind: params.kind,
      OR: [
        params.patientRut ? { patientRut: params.patientRut } : undefined,
        params.patientName ? { patientName: params.patientName } : undefined,
      ].filter(Boolean) as Array<{ patientName?: string; patientRut?: string }>,
    },
    include: {
      events: {
        select: {
          endDate: true,
          endDateTime: true,
          startDate: true,
          startDateTime: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const thresholdDays = getSeriesWindowDays(params.kind);
  const eventDate = dayjs.tz(params.eventDate, TIMEZONE);

  let bestMatch: null | { distance: number; seriesId: number } = null;

  for (const candidate of candidates) {
    if (candidate.events.length === 0) {
      return candidate.id;
    }

    const eventDates = candidate.events
      .map((item) => item.startDate ?? item.startDateTime ?? item.endDate ?? item.endDateTime)
      .filter((value): value is Date => value instanceof Date)
      .map((value) => dayjs(value).tz(TIMEZONE))
      .sort((a, b) => a.valueOf() - b.valueOf());

    const start = eventDates[0];
    const end = eventDates[eventDates.length - 1];
    const distance = eventDate.isBefore(start)
      ? start.diff(eventDate, "day")
      : eventDate.isAfter(end)
        ? eventDate.diff(end, "day")
        : 0;

    if (distance > thresholdDays) {
      continue;
    }

    if (!bestMatch || distance < bestMatch.distance) {
      bestMatch = { distance, seriesId: candidate.id };
    }
  }

  return bestMatch?.seriesId ?? null;
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
  // stored values. Fall back to the stored DB value if extraction finds nothing.
  let patientName: null | string = null;
  let patientRut: null | string = null;
  let beneficiaryName: null | string = null;
  let beneficiaryRut: null | string = null;

  for (const event of series.events) {
    const hints = extractIdentityHints(event.summary, event.description);
    if (!patientRut && hints.patientRut) patientRut = hints.patientRut;
    if (!patientName && hints.patientName) patientName = hints.patientName;
    if (!beneficiaryRut && hints.beneficiaryRut) beneficiaryRut = hints.beneficiaryRut;
    if (!beneficiaryName && hints.beneficiaryName) beneficiaryName = hints.beneficiaryName;
    if (patientName && patientRut && beneficiaryName && beneficiaryRut) break;
  }

  // Fall back to whatever was in the DB if fresh extraction came up empty.
  patientName ??= series.patientName;
  patientRut ??= series.patientRut;
  beneficiaryName ??= series.beneficiaryName;
  beneficiaryRut ??= series.beneficiaryRut;

  if (!beneficiaryRut || !beneficiaryName) {
    const linkedDocuments = await db.$queryRaw<Array<{ clientName: string; clientRUT: string }>>`
      SELECT DISTINCT
        s.client_name AS "clientName",
        s.client_rut AS "clientRUT"
      FROM event_dte_sale_links l
      JOIN events e ON e.id = l.event_id
      JOIN dte_sale_details s ON s.id = l.dte_sale_detail_id
      WHERE e.clinical_series_id = ${seriesId}
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
async function assignEventToSeries(event: EventSeriesCandidate): Promise<null | number> {
  const kind = inferSeriesKind(event);
  if (!kind) {
    if (event.clinicalSeriesId != null) {
      await db.event.update({
        where: { id: event.eventId },
        data: { clinicalSeries: { disconnect: true } },
      });
    }
    return null;
  }

  const inferredIdentity = extractIdentityHints(event.summary, event.description);
  // Prefer fresh extraction so an improved algorithm overwrites stale stored values.
  // Fall back to whatever is already in the DB if extraction returns nothing.
  const identity = {
    beneficiaryName: inferredIdentity.beneficiaryName ?? event.beneficiaryName,
    beneficiaryRut: inferredIdentity.beneficiaryRut ?? event.beneficiaryRut,
    patientName: inferredIdentity.patientName ?? event.patientName,
    patientRut: inferredIdentity.patientRut ?? event.patientRut,
  };

  await db.event.update({
    where: { id: event.eventId },
    data: {
      beneficiaryName: identity.beneficiaryName,
      beneficiaryRut: identity.beneficiaryRut,
      patientName: identity.patientName,
      patientRut: identity.patientRut,
    },
  });

  if (!identity.patientName && !identity.patientRut) {
    return event.clinicalSeriesId ?? null;
  }

  let targetSeriesId: null | number = null;

  if (event.clinicalSeriesId != null) {
    const currentSeries = await db.clinicalSeries.findUnique({
      where: { id: event.clinicalSeriesId },
      select: { beneficiaryRut: true, id: true, kind: true, patientRut: true },
    });

    const sameKind = currentSeries?.kind === kind;
    const samePatient =
      !identity.patientRut || !currentSeries?.patientRut || currentSeries.patientRut === identity.patientRut;
    const compatibleBeneficiary =
      !identity.beneficiaryRut ||
      !currentSeries?.beneficiaryRut ||
      currentSeries.beneficiaryRut === identity.beneficiaryRut;

    if (sameKind && samePatient && compatibleBeneficiary) {
      targetSeriesId = currentSeries.id;
    }
  }

  targetSeriesId ||= await findMatchingSeries({
    eventDate: event.eventDate,
    kind,
    patientName: identity.patientName,
    patientRut: identity.patientRut,
  });

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
  }

  if (event.clinicalSeriesId !== targetSeriesId) {
    await db.event.update({
      where: { id: event.eventId },
      data: { clinicalSeries: { connect: { id: targetSeriesId } } },
    });
  }

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

  // One query for all events instead of N individual round trips.
  const events = await loadEventSeriesCandidatesByIds(unique);

  // Collect which series were touched so we can refresh metadata exactly once
  // per series at the end — eliminates redundant refreshes and race conditions
  // when the same series has multiple events in the batch.
  const touchedSeriesIds = new Set<number>();
  let processed = 0;

  // 8 concurrent workers sharing a queue — ~8x throughput vs serial processing.
  await runConcurrent(events, 8, async (event) => {
    const seriesId = await assignEventToSeries(event).catch(() => null);
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

export async function rebuildClinicalSeries(
  params?: { autoMerge?: boolean; from?: string; to?: string },
  onProgress?: (processed: number, total: number) => void,
) {
  const rows = await db.$queryRaw<Array<{ eventId: number }>>`
    SELECT e.id AS "eventId"
    FROM events e
    WHERE e.category IN ('Test y exámenes', 'Tratamiento subcutáneo')
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

  // Dedup pass: merge duplicates only when explicitly requested
  let deduped = 0;
  if (params?.autoMerge) {
    const duplicates = await detectDuplicateSeries();
    for (const dup of duplicates) {
      await mergeClinicalSeries({ isAuto: true, mergeReason: dup.reason, sourceId: dup.sourceId, targetId: dup.targetId });
    }
    deduped = duplicates.length;
  }

  return {
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

export function startRebuildClinicalSeries(params?: { from?: string; to?: string }): string {
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
    ORDER BY s.id, l.updated_at DESC
  `;

  const eventIds = series.events.map((e) => e.id);
  const eventFolioRows = eventIds.length
    ? await db.$queryRaw<Array<{ eventId: number; folios: string[] }>>`
        SELECT l.event_id AS "eventId", ARRAY_AGG(s.folio ORDER BY s.document_date) AS "folios"
        FROM event_dte_sale_links l
        JOIN dte_sale_details s ON s.id = l.dte_sale_detail_id
        WHERE l.event_id = ANY(${eventIds}::int[])
        GROUP BY l.event_id
      `
    : [];
  const foliosByEventId = new Map(eventFolioRows.map((r) => [r.eventId, r.folios]));

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
    beneficiaryRut: series.beneficiaryRut ?? null,
    displayName: series.displayName ?? null,
    eligibleDocumentDateFrom,
    eligibleDocumentDateTo,
    events,
    id: series.id,
    kind: series.kind as ClinicalSeriesKind,
    linkedDocuments,
    patientName: series.patientName ?? null,
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

  const baseWhere = {
    beneficiaryRut: filters?.beneficiaryRut ? normalizeRut(filters.beneficiaryRut) : undefined,
    kind: filters?.kind,
    status: filters?.status,
    patientName: filters?.patientName
      ? {
          contains: normalizeName(filters.patientName),
        }
      : undefined,
    patientRut: filters?.patientRut ? normalizeRut(filters.patientRut) : undefined,
  };

  // Count total matching records (without pagination)
  const total = await db.clinicalSeries.count({ where: baseWhere });

  const normalizedPatientName = filters?.patientName ? `%${normalizeName(filters.patientName)}%` : null;
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
    WHERE (${filters?.beneficiaryRut ? normalizeRut(filters.beneficiaryRut) : null}::text IS NULL OR cs.beneficiary_rut = ${filters?.beneficiaryRut ? normalizeRut(filters.beneficiaryRut) : null})
      AND (${filters?.kind ?? null}::text IS NULL OR cs.kind::text = ${filters?.kind ?? null})
      AND (${filters?.status ?? null}::text IS NULL OR cs.status::text = ${filters?.status ?? null})
      AND (${normalizedPatientName}::text IS NULL OR lower(coalesce(cs.patient_name, '')) LIKE ${normalizedPatientName})
      AND (${filters?.patientRut ? normalizeRut(filters.patientRut) : null}::text IS NULL OR cs.patient_rut = ${filters?.patientRut ? normalizeRut(filters.patientRut) : null})
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
  targetEventCount: number;
  targetId: number;
}

export async function detectDuplicateSeries(): Promise<ClinicalSeriesDuplicate[]> {
  // Fetch all series that have at least one event, ordered by id ASC so the
  // lower (older) id becomes the target and the higher (newer) becomes source.
  const allSeries = await db.clinicalSeries.findMany({
    select: {
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
  // Track which IDs have already been paired to avoid chaining A→B→C
  const paired = new Set<number>();

  for (let i = 0; i < allSeries.length; i++) {
    const a = allSeries[i]!;
    if (paired.has(a.id)) continue;

    for (let j = i + 1; j < allSeries.length; j++) {
      const b = allSeries[j]!;
      if (paired.has(b.id)) continue;
      if (a.kind !== b.kind) continue;

      const aRut = a.patientRut ? normalizeRut(a.patientRut) : null;
      const bRut = b.patientRut ? normalizeRut(b.patientRut) : null;
      const aName = a.patientName ? normalizeName(a.patientName) : null;
      const bName = b.patientName ? normalizeName(b.patientName) : null;

      // High confidence: same non-null RUT
      if (aRut && bRut && aRut === bRut) {
        results.push({
          confidence: "high",
          kind: a.kind,
          patientName: a.patientName,
          reason: `Mismo RUT de paciente (${a.patientRut})`,
          sourceEventCount: b._count.events,
          sourceId: b.id,
          targetEventCount: a._count.events,
          targetId: a.id,
        });
        paired.add(b.id);
        break;
      }

      // High confidence: same non-null normalized name that looks like a real person name
      if (aName && bName && aName === bName && isLikelyPersonName(aName)) {
        results.push({
          confidence: "high",
          kind: a.kind,
          patientName: a.patientName,
          reason: `Mismo nombre de paciente (${a.patientName})`,
          sourceEventCount: b._count.events,
          sourceId: b.id,
          targetEventCount: a._count.events,
          targetId: a.id,
        });
        paired.add(b.id);
        break;
      }
    }
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

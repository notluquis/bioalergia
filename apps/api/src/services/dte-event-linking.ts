import { db } from "@finanzas/db";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
import { normalizeRut } from "../lib/rut";
import {
  type ClinicalSeriesSnapshot,
  extractIdentityHints,
  getClinicalSeriesSnapshotByExternalEvent,
  syncClinicalSeriesForInternalEventId,
} from "./clinical-series";

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = "America/Santiago";
const RUT_REGEX = /\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]\b/g;
const CAPITALIZED_NAME_REGEX = /([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,4})/g;

const EVENT_NOISE_TOKENS = new Set([
  "acaros",
  "ampolla",
  "clust",
  "control",
  "dosis",
  "entrega",
  "inyeccion",
  "llego",
  "mantencion",
  "mantencion",
  "ml",
  "pagado",
  "retira",
  "se",
  "servicio",
  "test",
  "vac",
  "vacuna",
]);

const MIN_AUTO_LINK_SCORE = 90;
const MAX_AUTO_LINK_AMOUNT_DIFF = 5000;

interface SkipReasonCount {
  count: number;
  reason: string;
}

interface AutoLinkPeriodSummary {
  daysProcessed: number;
  linked: number;
  period: string;
  skipped: number;
  totalEvents: number;
}

interface AutoLinkProgressSnapshot {
  completedPeriods: number;
  currentPeriod: string;
  linked: number;
  skipped: number;
  totalEvents: number;
  totalPeriods: number;
}

type AutoLinkStrategy = "missing_only" | "relink_all";

function incrementReason(counter: Map<string, number>, reason: string, increment = 1) {
  counter.set(reason, (counter.get(reason) ?? 0) + increment);
}

function normalizeReasonCounts(counter: Map<string, number>): SkipReasonCount[] {
  return [...counter.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
}

function parseLinkedDocumentsJson(value: unknown): EventDteLinkedDocument[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const clientName = typeof record.clientName === "string" ? record.clientName : null;
    const clientRUT = typeof record.clientRUT === "string" ? record.clientRUT : null;
    const dteSaleDetailId =
      typeof record.dteSaleDetailId === "string" ? record.dteSaleDetailId : null;
    const folio = typeof record.folio === "string" ? record.folio : null;
    const matchedBy = typeof record.matchedBy === "string" ? record.matchedBy : null;
    const confidenceScore =
      typeof record.confidenceScore === "number" ? record.confidenceScore : null;
    const totalAmount = typeof record.totalAmount === "number" ? record.totalAmount : null;

    if (
      !clientName ||
      !clientRUT ||
      !dteSaleDetailId ||
      !folio ||
      !matchedBy ||
      confidenceScore == null ||
      totalAmount == null
    ) {
      return [];
    }

    return [
      {
        clientName,
        clientRUT,
        confidenceScore,
        dteSaleDetailId,
        folio,
        matchedBy,
        totalAmount,
      },
    ];
  });
}

export interface EventDteSuggestion {
  dteSaleDetailId: string;
  documentType: number;
  clientRUT: string;
  clientName: string;
  folio: string;
  documentDate: string;
  totalAmount: number;
  exemptAmount: number;
  netAmount: number;
  ivaAmount: number;
  method: "mixed" | "name_exact" | "name_fuzzy" | "rut";
  confidenceScore: number;
  reasons: string[];
}

export interface EventDteBundleSuggestion {
  clientName: string;
  clientRUT: string;
  confidenceScore: number;
  count: number;
  documentDate: string;
  documents: EventDteSuggestion[];
  dteSaleDetailIds: string[];
  folios: string[];
  method: "mixed" | "name_exact" | "name_fuzzy" | "rut";
  reasons: string[];
  totalAmount: number;
}

export interface EventDteLinkRecord {
  id: number;
  eventId: number;
  dteSaleDetailId: string;
  status: "CONFIRMED" | "MANUAL" | "REJECTED";
  matchedBy: string;
  confidenceScore: number;
  matchedRUT: null | string;
  matchedName: null | string;
  evidence: unknown;
  createdBy: null | number;
  createdAt: string;
  updatedAt: string;
  dte: {
    clientName: string;
    clientRUT: string;
    documentDate: string;
    documentType: number;
    folio: string;
    totalAmount: number;
  };
}

interface EventDteLinkedDocument {
  clientName: string;
  clientRUT: string;
  confidenceScore: number;
  dteSaleDetailId: string;
  folio: string;
  matchedBy: string;
  totalAmount: number;
}

interface EventRow {
  amountExpected: null | number;
  amountPaid: null | number;
  clinicalSeriesId: null | number;
  description: null | string;
  eventDate: string;
  eventId: number;
  externalEventId: string;
  googleCalendarId: string;
  linkedDteSaleDetailId: null | string;
  seriesStageKind: null | "DOSE" | "INSTALLATION" | "MAINTENANCE" | "READING";
  seriesStageLabel: null | string;
  seriesStageNumber: null | number;
  summary: null | string;
}

interface DteSaleRow {
  clientName: string;
  clientRUT: string;
  documentDate: string;
  documentType: number;
  dteSaleDetailId: string;
  exemptAmount: number;
  folio: string;
  ivaAmount: number;
  linkedEventsCount: number;
  netAmount: number;
  totalAmount: number;
}

interface EventDteOverviewRow {
  amountExpected: null | number;
  amountPaid: null | number;
  calendarId: string;
  clinicalSeriesId: null | number;
  confidenceScore: null | number;
  displayName: null | string;
  eventDate: string;
  eventTime: null | string;
  eventId: string;
  lastAutoLinkSkipAt: Date | null;
  lastAutoLinkSkipReason: null | string;
  linkedCount: number;
  linkedClientName: null | string;
  linkedClientRUT: null | string;
  linkedDocumentsJson: unknown;
  linkedDteSaleDetailId: null | string;
  linkedFolio: null | string;
  linkedMatchedBy: null | string;
  linkedTotalAmount: null | number;
  seriesKind: null | "PATCH_TEST" | "SKIN_TEST" | "SUBCUTANEOUS_TREATMENT";
  summary: null | string;
}

async function recordAutoLinkAttempt(params: {
  confidenceScore?: number;
  dteSaleDetailId?: null | string;
  eventId: number;
  reason: string;
  status: "LINKED" | "SKIPPED";
  userId: number;
}) {
  const normalizedScore =
    params.confidenceScore != null && Number.isFinite(params.confidenceScore)
      ? Math.max(0, Math.min(100, params.confidenceScore))
      : null;

  await db.$executeRaw`
    INSERT INTO event_dte_auto_link_attempts (
      event_id,
      candidate_dte_sale_detail_id,
      status,
      reason,
      confidence_score,
      created_by,
      created_at
    ) VALUES (
      ${params.eventId},
      ${params.dteSaleDetailId ?? null},
      ${params.status},
      ${params.reason},
      ${normalizedScore},
      ${params.userId},
      NOW()
    )
  `;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(value: string): string {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 1 && !EVENT_NOISE_TOKENS.has(token))
    .join(" ")
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeName(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function bigrams(value: string): string[] {
  const cleaned = normalizeName(value).replace(/\s+/g, " ");
  if (cleaned.length < 2) return cleaned ? [cleaned] : [];
  const result: string[] = [];
  for (let i = 0; i < cleaned.length - 1; i += 1) {
    result.push(cleaned.slice(i, i + 2));
  }
  return result;
}

function diceCoefficient(a: string, b: string): number {
  const aPairs = bigrams(a);
  const bPairs = bigrams(b);
  if (aPairs.length === 0 || bPairs.length === 0) return 0;

  const aMap = new Map<string, number>();
  for (const pair of aPairs) {
    aMap.set(pair, (aMap.get(pair) ?? 0) + 1);
  }

  let overlap = 0;
  for (const pair of bPairs) {
    const count = aMap.get(pair) ?? 0;
    if (count > 0) {
      overlap += 1;
      aMap.set(pair, count - 1);
    }
  }

  return (2 * overlap) / (aPairs.length + bPairs.length);
}

function tokenSetF1(a: string, b: string): number {
  const aTokens = new Set(tokenize(a));
  const bTokens = new Set(tokenize(b));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;

  let intersection = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) {
      intersection += 1;
    }
  }

  if (intersection === 0) return 0;
  const precision = intersection / aTokens.size;
  const recall = intersection / bTokens.size;
  return (2 * precision * recall) / (precision + recall);
}

function containsName(hint: string, candidateName: string): boolean {
  const normalizedHint = normalizeName(hint);
  const normalizedCandidate = normalizeName(candidateName);
  if (!normalizedHint || !normalizedCandidate) return false;
  return (
    normalizedHint.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedHint)
  );
}

function surnameTokens(value: string): string[] {
  const tokens = tokenize(value).filter((token) => token.length >= 4);
  return tokens.slice(-2);
}

function findSharedSurnameToken(nameHints: string[], candidateName: string): null | string {
  const candidateSurnames = new Set(surnameTokens(candidateName));
  if (candidateSurnames.size === 0) return null;

  for (const hint of nameHints) {
    for (const token of surnameTokens(hint)) {
      if (candidateSurnames.has(token)) {
        return token;
      }
    }
  }

  return null;
}

function extractRutHints(text: string): string[] {
  const matches = text.match(RUT_REGEX) ?? [];
  const normalized = matches
    .map((value) => normalizeRut(value) || value.trim().toUpperCase())
    .filter(Boolean);
  return [...new Set(normalized)];
}

function extractNameHints(text: string): string[] {
  const raw = Array.from(text.matchAll(CAPITALIZED_NAME_REGEX), (m) => (m[1] ?? "").trim())
    .filter((value) => value.length >= 7)
    .filter((value) => tokenize(value).length >= 2);

  const normalized = raw
    .map((value) => normalizeName(value))
    .filter((value) => value.length >= 5)
    .filter((value) => tokenize(value).length >= 2);

  return [...new Set(normalized)].slice(0, 8);
}

function computeAmountHint(event: EventRow): null | number {
  if (event.amountPaid != null && Number.isFinite(event.amountPaid)) {
    return Number(event.amountPaid);
  }
  if (event.amountExpected != null && Number.isFinite(event.amountExpected)) {
    return Number(event.amountExpected);
  }
  const mergedText = `${event.summary ?? ""} ${event.description ?? ""}`;
  const amountMatches = Array.from(mergedText.matchAll(/\((\d{2,7})\)/g), (m) => m[1]);
  const first = amountMatches[0] ? Number(amountMatches[0]) : Number.NaN;
  return Number.isFinite(first) ? first : null;
}

function computeSeriesAmountHint(
  series: ClinicalSeriesSnapshot | null,
  event: EventRow,
): null | number {
  if (series) {
    if (series.remainingPaid > 0) {
      return series.remainingPaid;
    }
    if (series.remainingExpected > 0) {
      return series.remainingExpected;
    }
  }

  return computeAmountHint(event);
}

export function scoreCandidate(params: {
  amountHint: null | number;
  dte: DteSaleRow;
  nameHints: string[];
  rutHints: string[];
}): EventDteSuggestion {
  const candidateRut = normalizeRut(params.dte.clientRUT) || params.dte.clientRUT;
  const rutMatch = params.rutHints.some((rut) => rut === candidateRut);

  let bestNameScore = 0;
  let exactNameMatch = false;

  for (const nameHint of params.nameHints) {
    const tokenScore = tokenSetF1(nameHint, params.dte.clientName);
    const diceScore = diceCoefficient(nameHint, params.dte.clientName);
    const combined = Math.max(tokenScore, diceScore);
    if (containsName(nameHint, params.dte.clientName)) {
      exactNameMatch = true;
      bestNameScore = Math.max(bestNameScore, 1);
    } else {
      bestNameScore = Math.max(bestNameScore, combined);
    }
  }

  let score = 0;
  const reasons: string[] = [];
  let method: EventDteSuggestion["method"] = "name_fuzzy";
  const amountDiff =
    params.amountHint != null ? Math.abs(params.amountHint - params.dte.totalAmount) : null;

  if (rutMatch) {
    score += 95;
    reasons.push("RUT exacto encontrado en título/descripción del evento");
    method = params.nameHints.length > 0 ? "mixed" : "rut";
  }

  if (exactNameMatch) {
    score += rutMatch ? 5 : 88;
    reasons.push("Nombre exacto detectado en título/descripción");
    method = rutMatch ? "mixed" : "name_exact";
  } else if (bestNameScore > 0) {
    const fuzzyContribution = Math.round(bestNameScore * 80);
    score += fuzzyContribution;
    reasons.push(`Coincidencia difusa de nombre: ${Math.round(bestNameScore * 100)}%`);
    if (!rutMatch) {
      method = "name_fuzzy";
    }
  }

  if (amountDiff != null) {
    if (amountDiff <= 500) {
      score += 8;
      reasons.push("Monto coincide casi exacto");
    } else if (amountDiff <= 2000) {
      score += 5;
      reasons.push("Monto cercano");
    } else if (amountDiff <= 5000) {
      score += 3;
      reasons.push("Monto compatible");
    }
  }

  if (!rutMatch && !exactNameMatch && params.dte.linkedEventsCount === 0 && amountDiff != null) {
    const sharedSurnameToken = findSharedSurnameToken(params.nameHints, params.dte.clientName);
    if (sharedSurnameToken && amountDiff <= 500) {
      score += 30;
      reasons.push(
        `Apellido compartido (${sharedSurnameToken}) con posible responsable/paciente y DTE aún libre`,
      );
    }
  }

  const confidenceScore = Math.max(0, Math.min(100, score));

  return {
    dteSaleDetailId: params.dte.dteSaleDetailId,
    documentType: params.dte.documentType,
    clientRUT: params.dte.clientRUT,
    clientName: params.dte.clientName,
    folio: params.dte.folio,
    documentDate: params.dte.documentDate,
    totalAmount: params.dte.totalAmount,
    exemptAmount: params.dte.exemptAmount,
    netAmount: params.dte.netAmount,
    ivaAmount: params.dte.ivaAmount,
    method,
    confidenceScore,
    reasons,
  };
}

function isSkinTestBundleEligible(series: ClinicalSeriesSnapshot | null): boolean {
  return series?.kind === "SKIN_TEST";
}

function candidateHasExactRutMatch(candidate: DteSaleRow, rutHints: string[]): boolean {
  const candidateRut = normalizeRut(candidate.clientRUT) || candidate.clientRUT;
  return rutHints.some((rut) => rut === candidateRut);
}

function combineSuggestionMethod(
  documents: EventDteSuggestion[],
): EventDteBundleSuggestion["method"] {
  if (documents.some((candidate) => candidate.method === "mixed")) return "mixed";
  if (documents.some((candidate) => candidate.method === "name_exact")) return "name_exact";
  if (documents.some((candidate) => candidate.method === "name_fuzzy")) return "name_fuzzy";
  return "rut";
}

function compareBundleSuggestions(
  a: EventDteBundleSuggestion,
  b: EventDteBundleSuggestion,
  amountHint: null | number,
): number {
  const diffA =
    amountHint != null ? Math.abs(amountHint - a.totalAmount) : Number.POSITIVE_INFINITY;
  const diffB =
    amountHint != null ? Math.abs(amountHint - b.totalAmount) : Number.POSITIVE_INFINITY;

  if (diffA !== diffB) return diffA - diffB;
  if (a.confidenceScore !== b.confidenceScore) return b.confidenceScore - a.confidenceScore;
  if (a.count !== b.count) return a.count - b.count;
  return a.folios.join(",").localeCompare(b.folios.join(","));
}

export function findSkinTestBundleSuggestions(params: {
  amountHint: null | number;
  candidates: DteSaleRow[];
  limit?: number;
  nameHints: string[];
  rutHints: string[];
}): EventDteBundleSuggestion[] {
  if (params.amountHint == null) return [];

  const eligible = params.candidates
    .filter((candidate) => candidate.linkedEventsCount === 0)
    .filter((candidate) => candidateHasExactRutMatch(candidate, params.rutHints))
    .map((candidate) => ({
      candidate,
      suggestion: scoreCandidate({
        amountHint: params.amountHint,
        dte: candidate,
        nameHints: params.nameHints,
        rutHints: params.rutHints,
      }),
    }));

  if (eligible.length < 2) return [];

  const bundles = new Map<string, EventDteBundleSuggestion>();
  const limit = params.limit ?? 5;

  const visit = (startIndex: number, current: typeof eligible) => {
    if (current.length >= 2) {
      const totalAmount = current.reduce((sum, entry) => sum + entry.candidate.totalAmount, 0);
      const amountDiff = Math.abs(params.amountHint - totalAmount);

      if (amountDiff <= MAX_AUTO_LINK_AMOUNT_DIFF) {
        const sorted = [...current].sort((a, b) =>
          a.candidate.dteSaleDetailId.localeCompare(b.candidate.dteSaleDetailId),
        );
        const dteSaleDetailIds = sorted.map((entry) => entry.candidate.dteSaleDetailId);
        const reasons = [
          `Bundle de ${sorted.length} DTE del mismo día y mismo RUT`,
          `Suma total ${currencyFormatterForReason(totalAmount)} frente a evento ${currencyFormatterForReason(params.amountHint)}`,
        ];

        const exactNameSignals = sorted.filter(
          (entry) =>
            entry.suggestion.method === "mixed" || entry.suggestion.method === "name_exact",
        ).length;

        if (exactNameSignals > 0) {
          reasons.push("El bundle conserva coincidencias nominales fuertes");
        }

        if (amountDiff <= 500) {
          reasons.push("La suma del bundle coincide casi exacto");
        } else if (amountDiff <= 2000) {
          reasons.push("La suma del bundle es cercana");
        } else {
          reasons.push("La suma del bundle es compatible");
        }

        const confidenceScore = Math.min(
          100,
          amountDiff <= 500 ? 100 : amountDiff <= 2000 ? 96 : 92,
        );

        const bundle: EventDteBundleSuggestion = {
          clientName: sorted[0]!.candidate.clientName,
          clientRUT: sorted[0]!.candidate.clientRUT,
          confidenceScore,
          count: sorted.length,
          documentDate: sorted[0]!.candidate.documentDate,
          documents: sorted.map((entry) => entry.suggestion),
          dteSaleDetailIds,
          folios: sorted.map((entry) => entry.candidate.folio),
          method: combineSuggestionMethod(sorted.map((entry) => entry.suggestion)),
          reasons,
          totalAmount,
        };

        bundles.set(dteSaleDetailIds.join("|"), bundle);
      }
    }

    if (current.length === 3) return;

    for (let index = startIndex; index < eligible.length; index += 1) {
      current.push(eligible[index]!);
      visit(index + 1, current);
      current.pop();
    }
  };

  visit(0, []);

  return [...bundles.values()]
    .sort((a, b) => compareBundleSuggestions(a, b, params.amountHint))
    .slice(0, limit);
}

function currencyFormatterForReason(value: number): string {
  return new Intl.NumberFormat("es-CL", {
    currency: "CLP",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function isAmbiguous(top: EventDteSuggestion, second: EventDteSuggestion | undefined): boolean {
  if (!second) return false;
  return (
    top.confidenceScore >= 70 &&
    second.confidenceScore >= 70 &&
    top.confidenceScore - second.confidenceScore <= 7
  );
}

function hasExactRutSignal(candidate: EventDteSuggestion): boolean {
  return candidate.reasons.some((reason) => reason.includes("RUT exacto"));
}

function shouldTreatAsAmbiguous(
  top: EventDteSuggestion,
  second: EventDteSuggestion | undefined,
): boolean {
  if (hasExactRutSignal(top)) return false;
  return isAmbiguous(top, second);
}

async function getEventByExternalIds(
  calendarGoogleId: string,
  externalEventId: string,
): Promise<EventRow | null> {
  const rows = await db.$queryRaw<EventRow[]>`
    SELECT
      e.id AS "eventId",
      c.google_id AS "googleCalendarId",
      e.external_event_id AS "externalEventId",
      COALESCE(to_char(e.start_date, 'YYYY-MM-DD'), to_char((e.start_date_time AT TIME ZONE ${TIMEZONE})::date, 'YYYY-MM-DD')) AS "eventDate",
      e.summary AS "summary",
      e.description AS "description",
      e.clinical_series_id AS "clinicalSeriesId",
      link_stats."linkedDteSaleDetailId" AS "linkedDteSaleDetailId",
      e.series_stage_kind AS "seriesStageKind",
      e.series_stage_label AS "seriesStageLabel",
      e.series_stage_number AS "seriesStageNumber",
      e.amount_expected AS "amountExpected",
      e.amount_paid AS "amountPaid"
    FROM events e
    JOIN calendars c ON c.id = e.calendar_id
    LEFT JOIN LATERAL (
      SELECT
        MIN(l.dte_sale_detail_id) AS "linkedDteSaleDetailId"
      FROM event_dte_sale_links l
      WHERE l.event_id = e.id
    ) link_stats ON TRUE
    WHERE c.google_id = ${calendarGoogleId}
      AND e.external_event_id = ${externalEventId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

async function getEventsByDate(date: string): Promise<EventRow[]> {
  return db.$queryRaw<EventRow[]>`
    SELECT
      e.id AS "eventId",
      c.google_id AS "googleCalendarId",
      e.external_event_id AS "externalEventId",
      COALESCE(to_char(e.start_date, 'YYYY-MM-DD'), to_char((e.start_date_time AT TIME ZONE ${TIMEZONE})::date, 'YYYY-MM-DD')) AS "eventDate",
      e.summary AS "summary",
      e.description AS "description",
      e.clinical_series_id AS "clinicalSeriesId",
      link_stats."linkedDteSaleDetailId" AS "linkedDteSaleDetailId",
      e.series_stage_kind AS "seriesStageKind",
      e.series_stage_label AS "seriesStageLabel",
      e.series_stage_number AS "seriesStageNumber",
      e.amount_expected AS "amountExpected",
      e.amount_paid AS "amountPaid"
    FROM events e
    JOIN calendars c ON c.id = e.calendar_id
    LEFT JOIN LATERAL (
      SELECT
        MIN(l.dte_sale_detail_id) AS "linkedDteSaleDetailId"
      FROM event_dte_sale_links l
      WHERE l.event_id = e.id
    ) link_stats ON TRUE
    WHERE COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) = ${date}::date
    ORDER BY e.start_date_time ASC NULLS LAST, e.id ASC
  `;
}

async function getSalesCandidatesByDate(date: string): Promise<DteSaleRow[]> {
  return db.$queryRaw<DteSaleRow[]>`
    SELECT
      s.id AS "dteSaleDetailId",
      s.document_type AS "documentType",
      s.client_rut AS "clientRUT",
      s.client_name AS "clientName",
      s.folio AS "folio",
      to_char(s.document_date, 'YYYY-MM-DD') AS "documentDate",
      COALESCE(s.exempt_amount, 0)::float AS "exemptAmount",
      COALESCE(s.net_amount, 0)::float AS "netAmount",
      COALESCE(s.iva_amount, 0)::float AS "ivaAmount",
      COALESCE(s.total_amount, 0)::float AS "totalAmount",
      (
        SELECT COUNT(*)::int
        FROM event_dte_sale_links l
        WHERE l.dte_sale_detail_id = s.id
      ) AS "linkedEventsCount"
    FROM dte_sale_details s
    WHERE s.document_date = ${date}::date
      AND s.document_type <> 61
      AND NOT EXISTS (
        SELECT 1
        FROM dte_sale_details nce
        WHERE nce.document_type = 61
          AND nce.reference_doc_type = s.document_type::varchar
          AND nce.reference_doc_folio = s.folio
      )
    ORDER BY s.document_date DESC, s.register_number DESC
  `;
}

async function getSalesCandidatesByDateRange(params: {
  excludeDteSaleDetailIds?: string[];
  from: string;
  to: string;
}): Promise<DteSaleRow[]> {
  const excludedIds = params.excludeDteSaleDetailIds ?? [];

  return db.$queryRaw<DteSaleRow[]>`
    SELECT
      s.id AS "dteSaleDetailId",
      s.document_type AS "documentType",
      s.client_rut AS "clientRUT",
      s.client_name AS "clientName",
      s.folio AS "folio",
      to_char(s.document_date, 'YYYY-MM-DD') AS "documentDate",
      COALESCE(s.exempt_amount, 0)::float AS "exemptAmount",
      COALESCE(s.net_amount, 0)::float AS "netAmount",
      COALESCE(s.iva_amount, 0)::float AS "ivaAmount",
      COALESCE(s.total_amount, 0)::float AS "totalAmount",
      (
        SELECT COUNT(*)::int
        FROM event_dte_sale_links l
        WHERE l.dte_sale_detail_id = s.id
      ) AS "linkedEventsCount"
    FROM dte_sale_details s
    WHERE s.document_date BETWEEN ${params.from}::date AND ${params.to}::date
      AND s.document_type <> 61
      AND (
        cardinality(${excludedIds}::text[]) = 0
        OR s.id <> ALL(${excludedIds}::text[])
      )
      AND NOT EXISTS (
        SELECT 1
        FROM dte_sale_details nce
        WHERE nce.document_type = 61
          AND nce.reference_doc_type = s.document_type::varchar
          AND nce.reference_doc_folio = s.folio
      )
    ORDER BY s.document_date DESC, s.register_number DESC
  `;
}

export async function getEventDteSuggestions(params: {
  calendarId: string;
  eventId: string;
  limit?: number;
  sameDayOnly?: boolean;
}) {
  let event = await getEventByExternalIds(params.calendarId, params.eventId);
  if (!event) {
    return {
      bundleSuggestions: [] as EventDteBundleSuggestion[],
      event: null,
      series: null as ClinicalSeriesSnapshot | null,
      sameDayUnlinkedSuggestions: [] as EventDteSuggestion[],
      suggestions: [] as EventDteSuggestion[],
      linked: [] as EventDteLinkRecord[],
    };
  }

  if (event.clinicalSeriesId == null) {
    await syncClinicalSeriesForInternalEventId(event.eventId);
    event = await getEventByExternalIds(params.calendarId, params.eventId);
    if (!event) {
      return {
        bundleSuggestions: [] as EventDteBundleSuggestion[],
        event: null,
        series: null as ClinicalSeriesSnapshot | null,
        sameDayUnlinkedSuggestions: [] as EventDteSuggestion[],
        suggestions: [] as EventDteSuggestion[],
        linked: [] as EventDteLinkRecord[],
      };
    }
  }

  const [linked, series] = await Promise.all([
    getEventDteLinksByInternalEventId(event.eventId),
    getClinicalSeriesSnapshotByExternalEvent({
      calendarId: params.calendarId,
      eventId: params.eventId,
    }),
  ]);

  const sameDayCandidates = await getSalesCandidatesByDate(event.eventDate);

  const candidates = params.sameDayOnly
    ? sameDayCandidates
    : series
      ? await getSalesCandidatesByDateRange({
          excludeDteSaleDetailIds: series.linkedDocuments.map((item) => item.dteSaleDetailId),
          from: series.eligibleDocumentDateFrom,
          to: series.eligibleDocumentDateTo,
        })
      : await getSalesCandidatesByDate(event.eventDate);

  const mergedText = `${event.summary ?? ""} ${event.description ?? ""}`;
  const identityHints = extractIdentityHints(event.summary, event.description);

  const rutHints = [
    ...new Set([
      ...extractRutHints(mergedText),
      ...(identityHints.patientRut ? [identityHints.patientRut] : []),
      ...(identityHints.beneficiaryRut ? [identityHints.beneficiaryRut] : []),
      ...(series?.patientRut ? [series.patientRut] : []),
      ...(series?.beneficiaryRut ? [series.beneficiaryRut] : []),
    ]),
  ];
  const nameHints = [
    ...new Set([
      ...extractNameHints(mergedText),
      ...(identityHints.patientName ? [identityHints.patientName] : []),
      ...(identityHints.beneficiaryName ? [identityHints.beneficiaryName] : []),
      ...(series?.patientName ? [series.patientName] : []),
      ...(series?.beneficiaryName ? [series.beneficiaryName] : []),
    ]),
  ];
  const amountHint = computeSeriesAmountHint(series, event);
  const bundleSuggestions = isSkinTestBundleEligible(series)
    ? findSkinTestBundleSuggestions({
        amountHint,
        candidates: sameDayCandidates,
        limit: params.limit ?? 5,
        nameHints,
        rutHints,
      })
    : [];

  let suggestions = candidates
    .map((candidate) =>
      scoreCandidate({
        amountHint,
        dte: candidate,
        nameHints,
        rutHints,
      }),
    )
    .filter((candidate) => candidate.confidenceScore >= 35)
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, params.limit ?? 15);

  const sameDayUnlinkedSuggestions = sameDayCandidates
    .filter((candidate) => candidate.linkedEventsCount === 0)
    .map((candidate) =>
      scoreCandidate({
        amountHint,
        dte: candidate,
        nameHints,
        rutHints,
      }),
    )
    .filter((candidate) => !suggestions.some((suggestion) => suggestion.dteSaleDetailId === candidate.dteSaleDetailId))
    .sort((a, b) => {
      const amountDiffA =
        amountHint != null ? Math.abs(amountHint - a.totalAmount) : Number.POSITIVE_INFINITY;
      const amountDiffB =
        amountHint != null ? Math.abs(amountHint - b.totalAmount) : Number.POSITIVE_INFINITY;

      if (amountDiffA !== amountDiffB) {
        return amountDiffA - amountDiffB;
      }

      return b.confidenceScore - a.confidenceScore;
    })
    .slice(0, params.limit ?? 5)
    .map((candidate) => ({
      ...candidate,
      reasons: [...candidate.reasons, "DTE del mismo día sin eventos vinculados"],
    }));

  if (suggestions.length > 1 && shouldTreatAsAmbiguous(suggestions[0], suggestions[1])) {
    suggestions = suggestions.map((candidate, idx) => {
      if (idx <= 1) {
        return {
          ...candidate,
          confidenceScore: Math.max(0, candidate.confidenceScore - 8),
          reasons: [...candidate.reasons, "Coincidencia ambigua con otro candidato"],
        };
      }
      return candidate;
    });
  }

  return {
    bundleSuggestions,
    event: {
      amountExpected: event.amountExpected,
      amountPaid: event.amountPaid,
      calendarId: event.googleCalendarId,
      eventDate: event.eventDate,
      eventId: event.externalEventId,
      summary: event.summary,
      description: event.description,
      hints: {
        nameHints,
        rutHints,
      },
    },
    series,
    sameDayUnlinkedSuggestions,
    suggestions,
    linked,
  };
}

export async function listEventDteLinksByDate(date: string) {
  const rows = await db.$queryRaw<
    Array<{
      calendarId: string;
      confidenceScore: number;
      dteSaleDetailId: string;
      eventId: string;
      folio: string;
      matchedBy: string;
      status: string;
      totalAmount: number;
      clientName: string;
      clientRUT: string;
    }>
  >`
    SELECT
      c.google_id AS "calendarId",
      e.external_event_id AS "eventId",
      l.dte_sale_detail_id AS "dteSaleDetailId",
      l.status AS "status",
      l.matched_by AS "matchedBy",
      l.confidence_score::float AS "confidenceScore",
      s.client_name AS "clientName",
      s.client_rut AS "clientRUT",
      s.folio AS "folio",
      COALESCE(s.total_amount, 0)::float AS "totalAmount"
    FROM event_dte_sale_links l
    JOIN events e ON e.id = l.event_id
    JOIN calendars c ON c.id = e.calendar_id
    JOIN dte_sale_details s ON s.id = l.dte_sale_detail_id
    WHERE COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) = ${date}::date
    ORDER BY e.start_date_time ASC NULLS LAST, e.id ASC
  `;

  return rows;
}

export async function listEventDteLinkOverview(params: {
  page?: number;
  pageSize?: number;
  period: string;
  query?: string;
  status?: "all" | "linked" | "pending_issuance" | "unlinked";
}) {
  const page = Math.max(0, params.page ?? 0);
  const pageSize = Math.min(100, Math.max(10, params.pageSize ?? 25));
  const status = params.status ?? "all";
  const trimmedQuery = params.query?.trim() ?? "";
  const hasSearch = trimmedQuery.length > 0;
  const offset = page * pageSize;
  const periodDate = dayjs(`${params.period}-01`, "YYYY-MM-DD", true);
  const today = dayjs().tz(TIMEZONE).format("YYYY-MM-DD");

  if (!periodDate.isValid()) {
    throw new Error("Periodo inválido. Usa formato YYYY-MM");
  }

  const periodStart = periodDate.startOf("month").format("YYYY-MM-DD");
  const periodEnd = periodDate.endOf("month").format("YYYY-MM-DD");

  const searchLike = `%${trimmedQuery}%`;

  const statsRows = await db.$queryRaw<
    Array<{
      avgLinkedScore: null | number;
      dueEvents: number;
      linkedDueEvents: number;
      linkedEvents: number;
      pendingIssuanceEvents: number;
      totalEvents: number;
      unlinkedEvents: number;
      withPerfectScore: number;
    }>
  >`
    SELECT
      COUNT(*)::int AS "totalEvents",
      COUNT(*) FILTER (WHERE link_stats."linkedCount" > 0)::int AS "linkedEvents",
      COUNT(*) FILTER (
        WHERE COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) <= ${today}::date
      )::int AS "dueEvents",
      COUNT(*) FILTER (
        WHERE link_stats."linkedCount" > 0
          AND COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) <= ${today}::date
      )::int AS "linkedDueEvents",
      COUNT(*) FILTER (
        WHERE link_stats."linkedCount" = 0
          AND COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) <= ${today}::date
      )::int AS "unlinkedEvents",
      COUNT(*) FILTER (
        WHERE link_stats."linkedCount" = 0
          AND COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) > ${today}::date
      )::int AS "pendingIssuanceEvents",
      COUNT(*) FILTER (WHERE link_stats."maxConfidenceScore" = 100)::int AS "withPerfectScore",
      AVG(link_stats."avgConfidenceScore") FILTER (WHERE link_stats."linkedCount" > 0) AS "avgLinkedScore"
    FROM events e
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::int AS "linkedCount",
        MAX(l.confidence_score::float) AS "maxConfidenceScore",
        AVG(l.confidence_score::float) AS "avgConfidenceScore"
      FROM event_dte_sale_links l
      WHERE l.event_id = e.id
    ) link_stats ON TRUE
    WHERE COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date)
      BETWEEN ${periodStart}::date AND ${periodEnd}::date
  `;

  const totalCountRows = await db.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS "count"
    FROM events e
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS "linkedCount"
      FROM event_dte_sale_links l
      WHERE l.event_id = e.id
    ) link_stats ON TRUE
    WHERE COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date)
      BETWEEN ${periodStart}::date AND ${periodEnd}::date
      AND (
        (
          ${status} = 'all'
          AND (
            link_stats."linkedCount" > 0
            OR COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) <= ${today}::date
          )
        )
        OR (${status} = 'linked' AND link_stats."linkedCount" > 0)
        OR (
          ${status} = 'unlinked'
          AND link_stats."linkedCount" = 0
          AND COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) <= ${today}::date
        )
        OR (
          ${status} = 'pending_issuance'
          AND link_stats."linkedCount" = 0
          AND COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) > ${today}::date
        )
      )
      AND (
        ${hasSearch} = false
        OR COALESCE(e.summary, '') ILIKE ${searchLike}
        OR COALESCE(e.description, '') ILIKE ${searchLike}
      )
  `;
  const totalCount = totalCountRows[0]?.count ?? 0;

  const rows = await db.$queryRaw<EventDteOverviewRow[]>`
    SELECT
      c.google_id AS "calendarId",
      e.external_event_id AS "eventId",
      e.summary AS "summary",
      COALESCE(to_char(e.start_date, 'YYYY-MM-DD'), to_char((e.start_date_time AT TIME ZONE ${TIMEZONE})::date, 'YYYY-MM-DD')) AS "eventDate",
      to_char(e.start_date_time AT TIME ZONE ${TIMEZONE}, 'HH24:MI') AS "eventTime",
      e.amount_expected AS "amountExpected",
      e.amount_paid AS "amountPaid",
      e.clinical_series_id AS "clinicalSeriesId",
      auto_skip."lastAutoLinkSkipAt" AS "lastAutoLinkSkipAt",
      auto_skip."lastAutoLinkSkipReason" AS "lastAutoLinkSkipReason",
      link_stats."linkedCount" AS "linkedCount",
      link_stats."linkedDocumentsJson" AS "linkedDocumentsJson",
      link_stats."linkedDteSaleDetailId" AS "linkedDteSaleDetailId",
      link_stats."linkedMatchedBy" AS "linkedMatchedBy",
      link_stats."confidenceScore" AS "confidenceScore",
      link_stats."linkedClientName" AS "linkedClientName",
      link_stats."linkedClientRUT" AS "linkedClientRUT",
      link_stats."linkedFolio" AS "linkedFolio",
      link_stats."linkedTotalAmount" AS "linkedTotalAmount",
      cs.display_name AS "displayName",
      cs.kind AS "seriesKind"
    FROM events e
    JOIN calendars c ON c.id = e.calendar_id
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::int AS "linkedCount",
        MIN(l.dte_sale_detail_id) AS "linkedDteSaleDetailId",
        MIN(l.matched_by) AS "linkedMatchedBy",
        MAX(l.confidence_score::float) AS "confidenceScore",
        MIN(s.client_name) AS "linkedClientName",
        MIN(s.client_rut) AS "linkedClientRUT",
        MIN(s.folio) AS "linkedFolio",
        COALESCE(SUM(s.total_amount), 0)::float AS "linkedTotalAmount",
        COALESCE(
          json_agg(
            json_build_object(
              'clientName', s.client_name,
              'clientRUT', s.client_rut,
              'confidenceScore', l.confidence_score::float,
              'dteSaleDetailId', l.dte_sale_detail_id,
              'folio', s.folio,
              'matchedBy', l.matched_by,
              'totalAmount', COALESCE(s.total_amount, 0)::float
            )
            ORDER BY s.folio ASC
          ) FILTER (WHERE l.id IS NOT NULL),
          '[]'::json
        ) AS "linkedDocumentsJson"
      FROM event_dte_sale_links l
      JOIN dte_sale_details s ON s.id = l.dte_sale_detail_id
      WHERE l.event_id = e.id
    ) link_stats ON TRUE
    LEFT JOIN clinical_series cs ON e.clinical_series_id = cs.id
    LEFT JOIN LATERAL (
      SELECT
        a.created_at AS "lastAutoLinkSkipAt",
        a.reason AS "lastAutoLinkSkipReason"
      FROM event_dte_auto_link_attempts a
      WHERE a.event_id = e.id
        AND a.status = 'SKIPPED'
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT 1
    ) auto_skip ON TRUE
    WHERE COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date)
      BETWEEN ${periodStart}::date AND ${periodEnd}::date
      AND (
        (
          ${status} = 'all'
          AND (
            link_stats."linkedCount" > 0
            OR COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) <= ${today}::date
          )
        )
        OR (${status} = 'linked' AND link_stats."linkedCount" > 0)
        OR (
          ${status} = 'unlinked'
          AND link_stats."linkedCount" = 0
          AND COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) <= ${today}::date
        )
        OR (
          ${status} = 'pending_issuance'
          AND link_stats."linkedCount" = 0
          AND COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) > ${today}::date
        )
      )
      AND (
        ${hasSearch} = false
        OR COALESCE(e.summary, '') ILIKE ${searchLike}
        OR COALESCE(e.description, '') ILIKE ${searchLike}
      )
    ORDER BY COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) DESC, e.id DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  const items = await Promise.all(
    rows.map(async (row) => {
      let topBundleSuggestion: null | (EventDteBundleSuggestion & { amountDiff: null | number }) =
        null;
      let topSuggestion: null | (EventDteSuggestion & { amountDiff: null | number }) = null;
      const linkedDocuments = parseLinkedDocumentsJson(row.linkedDocumentsJson);

      const isDueForEmission = row.eventDate <= today;
      const linkStatus: "linked" | "pending_issuance" | "unlinked" = row.linkedCount > 0
        ? "linked"
        : isDueForEmission
          ? "unlinked"
          : "pending_issuance";

      if (row.linkedCount === 0 && isDueForEmission) {
        const suggestions = await getEventDteSuggestions({
          calendarId: row.calendarId,
          eventId: row.eventId,
          // Pull enough candidates to preserve ambiguity handling.
          limit: 3,
          sameDayOnly: true,
        });
        const firstBundle = suggestions.bundleSuggestions[0];
        const first = suggestions.suggestions[0];
        const amountHint =
          row.amountPaid != null && Number.isFinite(row.amountPaid)
            ? Number(row.amountPaid)
            : row.amountExpected != null && Number.isFinite(row.amountExpected)
              ? Number(row.amountExpected)
              : null;
        if (firstBundle) {
          topBundleSuggestion = {
            ...firstBundle,
            amountDiff: amountHint != null ? Math.abs(amountHint - firstBundle.totalAmount) : null,
          };
        }
        if (first) {
          topSuggestion = {
            ...first,
            amountDiff: amountHint != null ? Math.abs(amountHint - first.totalAmount) : null,
          };
        }
      }

      return {
        amountExpected: row.amountExpected,
        amountPaid: row.amountPaid,
        calendarId: row.calendarId,
        clinicalSeriesId: row.clinicalSeriesId,
        confidenceScore: row.confidenceScore,
        displayName: row.displayName,
        eventDate: row.eventDate,
        eventTime: row.eventTime,
        eventId: row.eventId,
        lastAutoLinkSkip:
          row.lastAutoLinkSkipReason && row.lastAutoLinkSkipAt
            ? {
                attemptedAt: row.lastAutoLinkSkipAt.toISOString(),
                reason: row.lastAutoLinkSkipReason,
              }
            : null,
        linkStatus,
        linked: row.linkedCount > 0,
        linkedClientName: row.linkedClientName,
        linkedClientRUT: row.linkedClientRUT,
        linkedDocuments,
        linkedDteSaleDetailId: row.linkedDteSaleDetailId,
        linkedFolio: row.linkedFolio,
        linkedMatchedBy: row.linkedMatchedBy,
        linkedTotalAmount: row.linkedTotalAmount,
        seriesKind: row.seriesKind,
        summary: row.summary,
        topBundleSuggestion,
        topSuggestion,
      };
    }),
  );

  const stats = statsRows[0] ?? {
    avgLinkedScore: null,
    dueEvents: 0,
    linkedDueEvents: 0,
    linkedEvents: 0,
    pendingIssuanceEvents: 0,
    totalEvents: 0,
    unlinkedEvents: 0,
    withPerfectScore: 0,
  };

  return {
    items,
    page,
    pageSize,
    period: params.period,
    stats: {
      avgLinkedScore: stats.avgLinkedScore ?? 0,
      dueEvents: stats.dueEvents,
      linkedEvents: stats.linkedEvents,
      linkRate:
        stats.dueEvents > 0
          ? Number(((stats.linkedDueEvents / stats.dueEvents) * 100).toFixed(1))
          : 0,
      totalEvents: stats.totalEvents,
      pendingIssuanceEvents: stats.pendingIssuanceEvents,
      unlinkedEvents: stats.unlinkedEvents,
      withPerfectScore: stats.withPerfectScore,
    },
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
  };
}

export async function getEventDteLinksByInternalEventId(
  eventId: number,
): Promise<EventDteLinkRecord[]> {
  const rows = await db.$queryRaw<
    Array<{
      id: number;
      eventId: number;
      dteSaleDetailId: string;
      status: "CONFIRMED" | "MANUAL" | "REJECTED";
      matchedBy: string;
      confidenceScore: number;
      matchedRUT: null | string;
      matchedName: null | string;
      evidence: unknown;
      createdBy: null | number;
      createdAt: Date;
      updatedAt: Date;
      clientName: string;
      clientRUT: string;
      documentDate: string;
      documentType: number;
      folio: string;
      totalAmount: number;
    }>
  >`
    SELECT
      l.id AS "id",
      l.event_id AS "eventId",
      l.dte_sale_detail_id AS "dteSaleDetailId",
      l.status AS "status",
      l.matched_by AS "matchedBy",
      l.confidence_score::float AS "confidenceScore",
      l.matched_rut AS "matchedRUT",
      l.matched_name AS "matchedName",
      l.evidence AS "evidence",
      l.created_by AS "createdBy",
      l.created_at AS "createdAt",
      l.updated_at AS "updatedAt",
      s.client_name AS "clientName",
      s.client_rut AS "clientRUT",
      to_char(s.document_date, 'YYYY-MM-DD') AS "documentDate",
      s.document_type AS "documentType",
      s.folio AS "folio",
      COALESCE(s.total_amount, 0)::float AS "totalAmount"
    FROM event_dte_sale_links l
    JOIN dte_sale_details s ON s.id = l.dte_sale_detail_id
    WHERE l.event_id = ${eventId}
    ORDER BY s.document_date ASC, s.folio ASC
  `;

  return rows.map((row) => ({
    id: row.id,
    eventId: row.eventId,
    dteSaleDetailId: row.dteSaleDetailId,
    status: row.status,
    matchedBy: row.matchedBy,
    confidenceScore: row.confidenceScore,
    matchedRUT: row.matchedRUT,
    matchedName: row.matchedName,
    evidence: row.evidence,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    dte: {
      clientName: row.clientName,
      clientRUT: row.clientRUT,
      documentDate: row.documentDate,
      documentType: row.documentType,
      folio: row.folio,
      totalAmount: row.totalAmount,
    },
  }));
}

export async function confirmEventDteLink(params: {
  calendarId: string;
  confidenceScore?: number;
  dteSaleDetailId?: string;
  dteSaleDetailIds?: string[];
  eventId: string;
  matchedBy?: "manual" | "mixed" | "name_exact" | "name_fuzzy" | "rut";
  matchedName?: null | string;
  matchedRUT?: null | string;
  userId: number;
}) {
  const event = await getEventByExternalIds(params.calendarId, params.eventId);
  if (!event) {
    throw new Error("Evento no encontrado");
  }

  const targetDteSaleDetailIds = [
    ...(params.dteSaleDetailIds ?? []),
    ...(params.dteSaleDetailId ? [params.dteSaleDetailId] : []),
  ];
  const normalizedDteSaleDetailIds = [...new Set(targetDteSaleDetailIds)].slice(0, 3);

  if (normalizedDteSaleDetailIds.length === 0) {
    throw new Error("Debes indicar al menos un DTE para confirmar el vínculo");
  }

  const dteRows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT s.id
    FROM dte_sale_details s
    WHERE s.id = ANY(${normalizedDteSaleDetailIds}::text[])
  `;

  if (dteRows.length !== normalizedDteSaleDetailIds.length) {
    throw new Error("Uno o más DTE de venta no existen");
  }

  await db.$executeRaw`
    DELETE FROM event_dte_sale_links
    WHERE event_id = ${event.eventId}
       OR dte_sale_detail_id = ANY(${normalizedDteSaleDetailIds}::text[])
  `;

  const evidence = JSON.stringify({
    bundleSize: normalizedDteSaleDetailIds.length,
    source: "manual_confirm",
  });

  for (const dteSaleDetailId of normalizedDteSaleDetailIds) {
    await db.$executeRaw`
      INSERT INTO event_dte_sale_links (
        event_id,
        dte_sale_detail_id,
        status,
        matched_by,
        confidence_score,
        matched_rut,
        matched_name,
        evidence,
        created_by,
        created_at,
        updated_at
      ) VALUES (
        ${event.eventId},
        ${dteSaleDetailId},
        'MANUAL',
        ${params.matchedBy ?? "manual"},
        ${Math.max(0, Math.min(100, params.confidenceScore ?? 100))},
        ${params.matchedRUT ?? null},
        ${params.matchedName ?? null},
        ${evidence}::jsonb,
        ${params.userId},
        NOW(),
        NOW()
      )
      ON CONFLICT (dte_sale_detail_id)
      DO UPDATE SET
        event_id = EXCLUDED.event_id,
        status = EXCLUDED.status,
        matched_by = EXCLUDED.matched_by,
        confidence_score = EXCLUDED.confidence_score,
        matched_rut = EXCLUDED.matched_rut,
        matched_name = EXCLUDED.matched_name,
        evidence = EXCLUDED.evidence,
        created_by = EXCLUDED.created_by,
        updated_at = NOW()
    `;
  }

  return getEventDteLinksByInternalEventId(event.eventId);
}

export async function unlinkEventDteLink(params: { calendarId: string; eventId: string }) {
  const event = await getEventByExternalIds(params.calendarId, params.eventId);
  if (!event) {
    return { deleted: false };
  }

  const deleted = await db.$executeRaw`
    DELETE FROM event_dte_sale_links
    WHERE event_id = ${event.eventId}
  `;

  return { deleted: Number(deleted) > 0 };
}

export async function autoLinkEventDate(params: {
  date: string;
  minScore?: number;
  strategy?: AutoLinkStrategy;
  userId: number;
}) {
  const today = dayjs().tz(TIMEZONE).format("YYYY-MM-DD");
  if (params.date > today) {
    throw new Error(
      `No se puede auto-vincular una fecha futura (${params.date}). Hoy es ${today} en ${TIMEZONE}.`,
    );
  }

  const minScore = params.minScore ?? MIN_AUTO_LINK_SCORE;
  const strategy = params.strategy ?? "missing_only";
  const events = await getEventsByDate(params.date);
  const eventsToProcess =
    strategy === "relink_all" ? events : events.filter((event) => !event.linkedDteSaleDetailId);

  let linked = 0;
  let skipped = 0;
  const details: Array<{ eventId: string; reason: string }> = [];
  const skippedByReason = new Map<string, number>();

  for (const event of eventsToProcess) {
    const suggestionsResponse = await getEventDteSuggestions({
      calendarId: event.googleCalendarId,
      eventId: event.externalEventId,
      limit: 3,
      sameDayOnly: true,
    });
    const topBundle = suggestionsResponse.bundleSuggestions[0];
    const secondBundle = suggestionsResponse.bundleSuggestions[1];
    const top = suggestionsResponse.suggestions[0];
    const second = suggestionsResponse.suggestions[1];

    if (
      suggestionsResponse.series?.kind === "SKIN_TEST" &&
      topBundle &&
      (!secondBundle || topBundle.confidenceScore - secondBundle.confidenceScore > 3)
    ) {
      if (topBundle.confidenceScore < minScore) {
        skipped += 1;
        const reason = `Score bajo bundle (${topBundle.confidenceScore})`;
        await recordAutoLinkAttempt({
          confidenceScore: topBundle.confidenceScore,
          dteSaleDetailId: topBundle.dteSaleDetailIds[0] ?? null,
          eventId: event.eventId,
          reason,
          status: "SKIPPED",
          userId: params.userId,
        });
        incrementReason(skippedByReason, reason);
        details.push({ eventId: event.externalEventId, reason });
        continue;
      }

      const amountHint = computeAmountHint(event);
      if (amountHint != null) {
        const amountDiff = Math.abs(amountHint - topBundle.totalAmount);
        if (amountDiff > MAX_AUTO_LINK_AMOUNT_DIFF) {
          skipped += 1;
          const reason = `Monto bundle no coincide (dif ${Math.round(amountDiff)})`;
          await recordAutoLinkAttempt({
            confidenceScore: topBundle.confidenceScore,
            dteSaleDetailId: topBundle.dteSaleDetailIds[0] ?? null,
            eventId: event.eventId,
            reason,
            status: "SKIPPED",
            userId: params.userId,
          });
          incrementReason(skippedByReason, reason);
          details.push({ eventId: event.externalEventId, reason });
          continue;
        }
      }

      await confirmEventDteLink({
        calendarId: event.googleCalendarId,
        confidenceScore: topBundle.confidenceScore,
        dteSaleDetailIds: topBundle.dteSaleDetailIds,
        eventId: event.externalEventId,
        matchedBy: topBundle.method,
        matchedName: topBundle.clientName,
        matchedRUT: topBundle.clientRUT,
        userId: params.userId,
      });
      await recordAutoLinkAttempt({
        confidenceScore: topBundle.confidenceScore,
        dteSaleDetailId: topBundle.dteSaleDetailIds[0] ?? null,
        eventId: event.eventId,
        reason: `Auto-linked bundle (${topBundle.confidenceScore})`,
        status: "LINKED",
        userId: params.userId,
      });

      linked += 1;
      details.push({
        eventId: event.externalEventId,
        reason: `Auto-linked bundle (${topBundle.confidenceScore})`,
      });
      continue;
    }

    if (!top) {
      skipped += 1;
      const reason = "Sin candidatos";
      await recordAutoLinkAttempt({
        eventId: event.eventId,
        reason,
        status: "SKIPPED",
        userId: params.userId,
      });
      incrementReason(skippedByReason, reason);
      details.push({ eventId: event.externalEventId, reason });
      continue;
    }

    if (top.confidenceScore < minScore) {
      skipped += 1;
      const reason = `Score bajo (${top.confidenceScore})`;
      await recordAutoLinkAttempt({
        confidenceScore: top.confidenceScore,
        dteSaleDetailId: top.dteSaleDetailId,
        eventId: event.eventId,
        reason,
        status: "SKIPPED",
        userId: params.userId,
      });
      incrementReason(skippedByReason, reason);
      details.push({
        eventId: event.externalEventId,
        reason,
      });
      continue;
    }

    const amountHint = computeAmountHint(event);
    if (amountHint != null) {
      const amountDiff = Math.abs(amountHint - top.totalAmount);
      if (amountDiff > MAX_AUTO_LINK_AMOUNT_DIFF) {
        skipped += 1;
        const reason = `Monto no coincide (dif ${Math.round(amountDiff)})`;
        await recordAutoLinkAttempt({
          confidenceScore: top.confidenceScore,
          dteSaleDetailId: top.dteSaleDetailId,
          eventId: event.eventId,
          reason,
          status: "SKIPPED",
          userId: params.userId,
        });
        incrementReason(skippedByReason, reason);
        details.push({
          eventId: event.externalEventId,
          reason,
        });
        continue;
      }
    }

    const isPerfectScore = top.confidenceScore === 100;
    if (!isPerfectScore && shouldTreatAsAmbiguous(top, second)) {
      skipped += 1;
      const reason = "Ambiguo";
      await recordAutoLinkAttempt({
        confidenceScore: top.confidenceScore,
        dteSaleDetailId: top.dteSaleDetailId,
        eventId: event.eventId,
        reason,
        status: "SKIPPED",
        userId: params.userId,
      });
      incrementReason(skippedByReason, reason);
      details.push({ eventId: event.externalEventId, reason });
      continue;
    }

    await confirmEventDteLink({
      calendarId: event.googleCalendarId,
      confidenceScore: top.confidenceScore,
      dteSaleDetailId: top.dteSaleDetailId,
      eventId: event.externalEventId,
      matchedBy: top.method,
      matchedName: top.clientName,
      matchedRUT: top.clientRUT,
      userId: params.userId,
    });
    await recordAutoLinkAttempt({
      confidenceScore: top.confidenceScore,
      dteSaleDetailId: top.dteSaleDetailId,
      eventId: event.eventId,
      reason: `Auto-linked (${top.confidenceScore})`,
      status: "LINKED",
      userId: params.userId,
    });

    linked += 1;
    details.push({
      eventId: event.externalEventId,
      reason: `Auto-linked (${top.confidenceScore})`,
    });
  }

  return {
    date: params.date,
    totalEvents: eventsToProcess.length,
    linked,
    skipped,
    skippedByReason: normalizeReasonCounts(skippedByReason),
    details,
  };
}

export async function autoLinkEventPeriod(params: {
  minScore?: number;
  period: string;
  strategy?: AutoLinkStrategy;
  userId: number;
}) {
  const periodDate = dayjs(`${params.period}-01`, "YYYY-MM-DD", true);
  if (!periodDate.isValid()) {
    throw new Error("Periodo inválido. Usa formato YYYY-MM");
  }

  const today = dayjs().tz(TIMEZONE).format("YYYY-MM-DD");
  const periodStart = periodDate.startOf("month").format("YYYY-MM-DD");
  const periodEnd = periodDate.endOf("month").format("YYYY-MM-DD");
  const maxDate = periodEnd < today ? periodEnd : today;

  if (periodStart > maxDate) {
    return {
      period: params.period,
      totalEvents: 0,
      linked: 0,
      skipped: 0,
      daysProcessed: 0,
      skippedByReason: [] as SkipReasonCount[],
      details: [] as Array<{ date: string; linked: number; skipped: number; totalEvents: number }>,
    };
  }

  const dateRows = await db.$queryRaw<Array<{ eventDate: string }>>`
    SELECT DISTINCT
      COALESCE(
        to_char(e.start_date, 'YYYY-MM-DD'),
        to_char((e.start_date_time AT TIME ZONE ${TIMEZONE})::date, 'YYYY-MM-DD')
      ) AS "eventDate"
    FROM events e
    WHERE COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date)
      BETWEEN ${periodStart}::date AND ${maxDate}::date
    ORDER BY "eventDate" ASC
  `;

  const details: Array<{ date: string; linked: number; skipped: number; totalEvents: number }> = [];
  let totalEvents = 0;
  let linked = 0;
  let skipped = 0;
  const skippedByReason = new Map<string, number>();

  for (const row of dateRows) {
    const result = await autoLinkEventDate({
      date: row.eventDate,
      minScore: params.minScore,
      strategy: params.strategy,
      userId: params.userId,
    });
    totalEvents += result.totalEvents;
    linked += result.linked;
    skipped += result.skipped;
    for (const reasonCount of result.skippedByReason) {
      incrementReason(skippedByReason, reasonCount.reason, reasonCount.count);
    }
    details.push({
      date: row.eventDate,
      linked: result.linked,
      skipped: result.skipped,
      totalEvents: result.totalEvents,
    });
  }

  return {
    period: params.period,
    totalEvents,
    linked,
    skipped,
    daysProcessed: details.length,
    skippedByReason: normalizeReasonCounts(skippedByReason),
    details,
  };
}

export async function autoLinkAllEventPeriods(params: {
  minScore?: number;
  strategy?: AutoLinkStrategy;
  userId: number;
}) {
  const strategy = params.strategy ?? "missing_only";
  const periodRows = await listAutoLinkEligiblePeriods();
  const periodConcurrency = 3;
  const queue = [...periodRows];
  const details: AutoLinkPeriodSummary[] = [];
  let totalEvents = 0;
  let linked = 0;
  let skipped = 0;
  const skippedByReason = new Map<string, number>();

  const workers = Array.from({ length: Math.min(periodConcurrency, queue.length || 1) }, () =>
    (async () => {
      while (true) {
        const row = queue.shift();
        if (!row) {
          return;
        }

        const result = await autoLinkEventPeriod({
          minScore: params.minScore,
          period: row.period,
          strategy,
          userId: params.userId,
        });

        totalEvents += result.totalEvents;
        linked += result.linked;
        skipped += result.skipped;
        for (const reasonCount of result.skippedByReason) {
          incrementReason(skippedByReason, reasonCount.reason, reasonCount.count);
        }
        details.push({
          period: row.period,
          linked: result.linked,
          skipped: result.skipped,
          totalEvents: result.totalEvents,
          daysProcessed: result.daysProcessed,
        });
      }
    })(),
  );

  await Promise.all(workers);

  return {
    periodsProcessed: details.length,
    strategy,
    totalEvents,
    linked,
    skipped,
    skippedByReason: normalizeReasonCounts(skippedByReason),
    details,
  };
}

export async function listAutoLinkEligiblePeriods() {
  const today = dayjs().tz(TIMEZONE).format("YYYY-MM-DD");
  return db.$queryRaw<Array<{ period: string }>>`
    SELECT DISTINCT
      to_char(COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date), 'YYYY-MM') AS "period"
    FROM events e
    WHERE COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) <= ${today}::date
    ORDER BY "period" DESC
  `;
}

export async function autoLinkAllEventPeriodsWithProgress(params: {
  minScore?: number;
  onProgress?: (snapshot: AutoLinkProgressSnapshot) => void;
  periodConcurrency?: number;
  periods: Array<{ period: string }>;
  strategy?: AutoLinkStrategy;
  userId: number;
}) {
  const strategy = params.strategy ?? "missing_only";
  const queue = [...params.periods];
  const details: AutoLinkPeriodSummary[] = [];
  const concurrency = Math.max(1, Math.min(params.periodConcurrency ?? 3, 6));
  let totalEvents = 0;
  let linked = 0;
  let skipped = 0;
  let completedPeriods = 0;
  const skippedByReason = new Map<string, number>();

  const workers = Array.from({ length: Math.min(concurrency, queue.length || 1) }, () =>
    (async () => {
      while (true) {
        const row = queue.shift();
        if (!row) {
          return;
        }

        const result = await autoLinkEventPeriod({
          minScore: params.minScore,
          period: row.period,
          strategy,
          userId: params.userId,
        });

        totalEvents += result.totalEvents;
        linked += result.linked;
        skipped += result.skipped;
        for (const reasonCount of result.skippedByReason) {
          incrementReason(skippedByReason, reasonCount.reason, reasonCount.count);
        }
        details.push({
          period: row.period,
          linked: result.linked,
          skipped: result.skipped,
          totalEvents: result.totalEvents,
          daysProcessed: result.daysProcessed,
        });

        completedPeriods += 1;
        params.onProgress?.({
          completedPeriods,
          currentPeriod: row.period,
          linked,
          skipped,
          totalEvents,
          totalPeriods: params.periods.length,
        });
      }
    })(),
  );

  await Promise.all(workers);
  details.sort((a, b) => b.period.localeCompare(a.period));

  return {
    periodsProcessed: details.length,
    strategy,
    totalEvents,
    linked,
    skipped,
    skippedByReason: normalizeReasonCounts(skippedByReason),
    details,
  };
}

export function normalizeLinkDate(input: string): string {
  const parsed = dayjs(input, "YYYY-MM-DD", true);
  if (!parsed.isValid()) {
    throw new Error("Fecha inválida. Usa formato YYYY-MM-DD");
  }
  return parsed.tz(TIMEZONE).format("YYYY-MM-DD");
}

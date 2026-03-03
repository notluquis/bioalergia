import { db } from "@finanzas/db";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
import { normalizeRut } from "../lib/rut";

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

export interface EventDteSuggestion {
  dteSaleDetailId: string;
  registerNumber: number;
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

interface EventRow {
  amountExpected: null | number;
  amountPaid: null | number;
  description: null | string;
  eventDate: string;
  eventId: number;
  externalEventId: string;
  googleCalendarId: string;
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
  netAmount: number;
  registerNumber: number;
  totalAmount: number;
}

interface EventDteOverviewRow {
  amountExpected: null | number;
  amountPaid: null | number;
  calendarId: string;
  confidenceScore: null | number;
  eventDate: string;
  eventId: string;
  linkedClientName: null | string;
  linkedClientRUT: null | string;
  linkedDteSaleDetailId: null | string;
  linkedFolio: null | string;
  linkedMatchedBy: null | string;
  linkedTotalAmount: null | number;
  summary: null | string;
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

function scoreCandidate(params: {
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

  if (params.amountHint != null) {
    const diff = Math.abs(params.amountHint - params.dte.totalAmount);
    if (diff <= 500) {
      score += 8;
      reasons.push("Monto coincide casi exacto");
    } else if (diff <= 2000) {
      score += 5;
      reasons.push("Monto cercano");
    } else if (diff <= 5000) {
      score += 3;
      reasons.push("Monto compatible");
    }
  }

  const confidenceScore = Math.max(0, Math.min(100, score));

  return {
    dteSaleDetailId: params.dte.dteSaleDetailId,
    registerNumber: params.dte.registerNumber,
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

function isAmbiguous(top: EventDteSuggestion, second: EventDteSuggestion | undefined): boolean {
  if (!second) return false;
  return (
    top.confidenceScore >= 70 &&
    second.confidenceScore >= 70 &&
    top.confidenceScore - second.confidenceScore <= 7
  );
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

async function getEventsByDate(date: string): Promise<EventRow[]> {
  return db.$queryRaw<EventRow[]>`
    SELECT
      e.id AS "eventId",
      c.google_id AS "googleCalendarId",
      e.external_event_id AS "externalEventId",
      COALESCE(to_char(e.start_date, 'YYYY-MM-DD'), to_char((e.start_date_time AT TIME ZONE ${TIMEZONE})::date, 'YYYY-MM-DD')) AS "eventDate",
      e.summary AS "summary",
      e.description AS "description",
      e.amount_expected AS "amountExpected",
      e.amount_paid AS "amountPaid"
    FROM events e
    JOIN calendars c ON c.id = e.calendar_id
    WHERE COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) = ${date}::date
    ORDER BY e.start_date_time ASC NULLS LAST, e.id ASC
  `;
}

async function getSalesCandidatesByDate(date: string): Promise<DteSaleRow[]> {
  return db.$queryRaw<DteSaleRow[]>`
    SELECT
      s.id AS "dteSaleDetailId",
      s.register_number AS "registerNumber",
      s.document_type AS "documentType",
      s.client_rut AS "clientRUT",
      s.client_name AS "clientName",
      s.folio AS "folio",
      to_char(s.document_date, 'YYYY-MM-DD') AS "documentDate",
      COALESCE(s.exempt_amount, 0)::float AS "exemptAmount",
      COALESCE(s.net_amount, 0)::float AS "netAmount",
      COALESCE(s.iva_amount, 0)::float AS "ivaAmount",
      COALESCE(s.total_amount, 0)::float AS "totalAmount"
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

export async function getEventDteSuggestions(params: {
  calendarId: string;
  eventId: string;
  limit?: number;
}) {
  const event = await getEventByExternalIds(params.calendarId, params.eventId);
  if (!event) {
    return {
      event: null,
      suggestions: [] as EventDteSuggestion[],
      linked: null as EventDteLinkRecord | null,
    };
  }

  const [candidates, linked] = await Promise.all([
    getSalesCandidatesByDate(event.eventDate),
    getEventDteLinkByInternalEventId(event.eventId),
  ]);

  const mergedText = `${event.summary ?? ""} ${event.description ?? ""}`;
  const rutHints = extractRutHints(mergedText);
  const nameHints = extractNameHints(mergedText);
  const amountHint = computeAmountHint(event);

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

  if (suggestions.length > 1 && isAmbiguous(suggestions[0], suggestions[1])) {
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
      COUNT(l.id)::int AS "linkedEvents",
      COUNT(*) FILTER (
        WHERE COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) <= ${today}::date
      )::int AS "dueEvents",
      COUNT(l.id) FILTER (
        WHERE COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) <= ${today}::date
      )::int AS "linkedDueEvents",
      COUNT(*) FILTER (
        WHERE l.id IS NULL
          AND COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) <= ${today}::date
      )::int AS "unlinkedEvents",
      COUNT(*) FILTER (
        WHERE l.id IS NULL
          AND COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) > ${today}::date
      )::int AS "pendingIssuanceEvents",
      COUNT(*) FILTER (WHERE l.confidence_score::float = 100)::int AS "withPerfectScore",
      AVG(l.confidence_score::float) AS "avgLinkedScore"
    FROM events e
    LEFT JOIN event_dte_sale_links l ON l.event_id = e.id
    WHERE COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date)
      BETWEEN ${periodStart}::date AND ${periodEnd}::date
  `;

  const totalCountRows = await db.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS "count"
    FROM events e
    LEFT JOIN event_dte_sale_links l ON l.event_id = e.id
    WHERE COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date)
      BETWEEN ${periodStart}::date AND ${periodEnd}::date
      AND (
        ${status} = 'all'
        OR (${status} = 'linked' AND l.id IS NOT NULL)
        OR (
          ${status} = 'unlinked'
          AND l.id IS NULL
          AND COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) <= ${today}::date
        )
        OR (
          ${status} = 'pending_issuance'
          AND l.id IS NULL
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
      e.amount_expected AS "amountExpected",
      e.amount_paid AS "amountPaid",
      l.dte_sale_detail_id AS "linkedDteSaleDetailId",
      l.matched_by AS "linkedMatchedBy",
      l.confidence_score::float AS "confidenceScore",
      s.client_name AS "linkedClientName",
      s.client_rut AS "linkedClientRUT",
      s.folio AS "linkedFolio",
      COALESCE(s.total_amount, 0)::float AS "linkedTotalAmount"
    FROM events e
    JOIN calendars c ON c.id = e.calendar_id
    LEFT JOIN event_dte_sale_links l ON l.event_id = e.id
    LEFT JOIN dte_sale_details s ON s.id = l.dte_sale_detail_id
    WHERE COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date)
      BETWEEN ${periodStart}::date AND ${periodEnd}::date
      AND (
        ${status} = 'all'
        OR (${status} = 'linked' AND l.id IS NOT NULL)
        OR (
          ${status} = 'unlinked'
          AND l.id IS NULL
          AND COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) <= ${today}::date
        )
        OR (
          ${status} = 'pending_issuance'
          AND l.id IS NULL
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
      let topSuggestion: null | (EventDteSuggestion & { amountDiff: null | number }) = null;

      const isDueForEmission = row.eventDate <= today;
      if (!row.linkedDteSaleDetailId && isDueForEmission) {
        const suggestions = await getEventDteSuggestions({
          calendarId: row.calendarId,
          eventId: row.eventId,
          limit: 1,
        });
        const first = suggestions.suggestions[0];
        if (first) {
          const amountHint =
            row.amountPaid != null && Number.isFinite(row.amountPaid)
              ? Number(row.amountPaid)
              : row.amountExpected != null && Number.isFinite(row.amountExpected)
                ? Number(row.amountExpected)
                : null;
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
        confidenceScore: row.confidenceScore,
        eventDate: row.eventDate,
        eventId: row.eventId,
        linkStatus: row.linkedDteSaleDetailId
          ? "linked"
          : isDueForEmission
            ? "unlinked"
            : "pending_issuance",
        linked: Boolean(row.linkedDteSaleDetailId),
        linkedClientName: row.linkedClientName,
        linkedClientRUT: row.linkedClientRUT,
        linkedDteSaleDetailId: row.linkedDteSaleDetailId,
        linkedFolio: row.linkedFolio,
        linkedMatchedBy: row.linkedMatchedBy,
        linkedTotalAmount: row.linkedTotalAmount,
        summary: row.summary,
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

export async function getEventDteLinkByInternalEventId(
  eventId: number,
): Promise<EventDteLinkRecord | null> {
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
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) return null;

  return {
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
  };
}

export async function confirmEventDteLink(params: {
  calendarId: string;
  confidenceScore?: number;
  dteSaleDetailId: string;
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

  const dteRows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT s.id
    FROM dte_sale_details s
    WHERE s.id = ${params.dteSaleDetailId}
    LIMIT 1
  `;

  if (!dteRows[0]) {
    throw new Error("DTE sale no encontrado");
  }

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
      ${params.dteSaleDetailId},
      'MANUAL',
      ${params.matchedBy ?? "manual"},
      ${Math.max(0, Math.min(100, params.confidenceScore ?? 100))},
      ${params.matchedRUT ?? null},
      ${params.matchedName ?? null},
      ${JSON.stringify({ source: "manual_confirm" })}::jsonb,
      ${params.userId},
      NOW(),
      NOW()
    )
    ON CONFLICT (event_id)
    DO UPDATE SET
      dte_sale_detail_id = EXCLUDED.dte_sale_detail_id,
      status = EXCLUDED.status,
      matched_by = EXCLUDED.matched_by,
      confidence_score = EXCLUDED.confidence_score,
      matched_rut = EXCLUDED.matched_rut,
      matched_name = EXCLUDED.matched_name,
      evidence = EXCLUDED.evidence,
      created_by = EXCLUDED.created_by,
      updated_at = NOW()
  `;

  return getEventDteLinkByInternalEventId(event.eventId);
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
  userId: number;
}) {
  const today = dayjs().tz(TIMEZONE).format("YYYY-MM-DD");
  if (params.date > today) {
    throw new Error(
      `No se puede auto-vincular una fecha futura (${params.date}). Hoy es ${today} en ${TIMEZONE}.`,
    );
  }

  const minScore = params.minScore ?? MIN_AUTO_LINK_SCORE;
  const events = await getEventsByDate(params.date);

  let linked = 0;
  let skipped = 0;
  const details: Array<{ eventId: string; reason: string }> = [];

  for (const event of events) {
    const suggestionsResponse = await getEventDteSuggestions({
      calendarId: event.googleCalendarId,
      eventId: event.externalEventId,
      limit: 3,
    });
    const top = suggestionsResponse.suggestions[0];
    const second = suggestionsResponse.suggestions[1];

    if (!top) {
      skipped += 1;
      details.push({ eventId: event.externalEventId, reason: "Sin candidatos" });
      continue;
    }

    if (top.confidenceScore < minScore) {
      skipped += 1;
      details.push({
        eventId: event.externalEventId,
        reason: `Score bajo (${top.confidenceScore})`,
      });
      continue;
    }

    const amountHint = computeAmountHint(event);
    if (amountHint != null) {
      const amountDiff = Math.abs(amountHint - top.totalAmount);
      if (amountDiff > MAX_AUTO_LINK_AMOUNT_DIFF) {
        skipped += 1;
        details.push({
          eventId: event.externalEventId,
          reason: `Monto no coincide (dif ${Math.round(amountDiff)})`,
        });
        continue;
      }
    }

    const isPerfectScore = top.confidenceScore === 100;
    if (!isPerfectScore && isAmbiguous(top, second)) {
      skipped += 1;
      details.push({ eventId: event.externalEventId, reason: "Ambiguo" });
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

    linked += 1;
    details.push({
      eventId: event.externalEventId,
      reason: `Auto-linked (${top.confidenceScore})`,
    });
  }

  return {
    date: params.date,
    totalEvents: events.length,
    linked,
    skipped,
    details,
  };
}

export async function autoLinkEventPeriod(params: {
  minScore?: number;
  period: string;
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

  for (const row of dateRows) {
    const result = await autoLinkEventDate({
      date: row.eventDate,
      minScore: params.minScore,
      userId: params.userId,
    });
    totalEvents += result.totalEvents;
    linked += result.linked;
    skipped += result.skipped;
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
    details,
  };
}

export async function autoLinkAllEventPeriods(params: { minScore?: number; userId: number }) {
  const today = dayjs().tz(TIMEZONE).format("YYYY-MM-DD");

  const periodRows = await db.$queryRaw<Array<{ period: string }>>`
    SELECT DISTINCT
      to_char(COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date), 'YYYY-MM') AS "period"
    FROM events e
    WHERE COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) <= ${today}::date
    ORDER BY "period" DESC
  `;

  const details: Array<{
    daysProcessed: number;
    linked: number;
    period: string;
    skipped: number;
    totalEvents: number;
  }> = [];
  let totalEvents = 0;
  let linked = 0;
  let skipped = 0;

  for (const row of periodRows) {
    const result = await autoLinkEventPeriod({
      minScore: params.minScore,
      period: row.period,
      userId: params.userId,
    });
    totalEvents += result.totalEvents;
    linked += result.linked;
    skipped += result.skipped;
    details.push({
      period: row.period,
      linked: result.linked,
      skipped: result.skipped,
      totalEvents: result.totalEvents,
      daysProcessed: result.daysProcessed,
    });
  }

  return {
    periodsProcessed: details.length,
    totalEvents,
    linked,
    skipped,
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

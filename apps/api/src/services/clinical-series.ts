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
const CAPITALIZED_NAME_REGEX = /([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,4})/g;
const LOWERCASE_NAME_STOPWORDS = new Set([
  "acaros",
  "administracion",
  "aeroalergenos",
  "alimentario",
  "ambiente",
  "clustoid",
  "confirma",
  "control",
  "dosis",
  "gramineas",
  "instalacion",
  "llego",
  "lectura",
  "mantencion",
  "mensual",
  "parche",
  "presento",
  "reaccion",
  "retiro",
  "semanal",
  "se",
  "subcutaneo",
  "test",
  "tratamiento",
  "vacuna",
]);

type ClinicalSeriesKind = "PATCH_TEST" | "SKIN_TEST" | "SUBCUTANEOUS_TREATMENT";
type ClinicalSeriesStageKind = "DOSE" | "INSTALLATION" | "MAINTENANCE" | "READING";

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
        return "greatest(0, coalesce(es.total_expected, 0) - coalesce(lt.total_linked_amount, 0))";
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
      if (!candidate.some((token) => token.length >= 7)) {
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

export function extractIdentityHints(summary: null | string, description: null | string) {
  const text = `${summary ?? ""} ${description ?? ""}`;
  const ruts = [
    ...new Set((text.match(RUT_REGEX) ?? []).map((value) => normalizeRut(value)).filter(Boolean)),
  ];
  const names =
    [
      ...new Set(
        Array.from(text.matchAll(CAPITALIZED_NAME_REGEX), (match) =>
          normalizeName((match[1] ?? "").trim()),
        ).filter((value) => value.length >= 5),
      ),
    ].concat(extractLowercaseNameHints(text));

  const uniqueNames = [...new Set(names)];
  const patientRut = ruts[0] ?? null;
  const beneficiaryRut = ruts.find((value) => value !== patientRut) ?? null;
  const patientName = uniqueNames[0] ?? null;
  const beneficiaryName = uniqueNames.find((value) => value !== patientName) ?? null;

  return { beneficiaryName, beneficiaryRut, patientName, patientRut };
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

  let patientName = series.patientName;
  let patientRut = series.patientRut;
  let beneficiaryName = series.beneficiaryName;
  let beneficiaryRut = series.beneficiaryRut;

  if (!patientName || !patientRut || !beneficiaryName || !beneficiaryRut) {
    for (const event of series.events) {
      const hints = extractIdentityHints(event.summary, event.description);
      if (!patientRut && hints.patientRut) {
        patientRut = hints.patientRut;
      }
      if (!patientName && hints.patientName) {
        patientName = hints.patientName;
      }
      if (!beneficiaryRut && hints.beneficiaryRut) {
        beneficiaryRut = hints.beneficiaryRut;
      }
      if (!beneficiaryName && hints.beneficiaryName) {
        beneficiaryName = hints.beneficiaryName;
      }
      if (patientName && patientRut && beneficiaryName && beneficiaryRut) {
        break;
      }
    }
  }

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

  await db.clinicalSeries.update({
    where: { id: seriesId },
    data: {
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

export async function syncClinicalSeriesForInternalEventId(
  eventId: number,
): Promise<null | number> {
  const event = await loadEventSeriesCandidateByInternalId(eventId);
  if (!event) {
    return null;
  }

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
  const identity = {
    beneficiaryName: event.beneficiaryName ?? inferredIdentity.beneficiaryName,
    beneficiaryRut: event.beneficiaryRut ?? inferredIdentity.beneficiaryRut,
    patientName: event.patientName ?? inferredIdentity.patientName,
    patientRut: event.patientRut ?? inferredIdentity.patientRut,
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
      select: {
        beneficiaryRut: true,
        id: true,
        kind: true,
        patientRut: true,
      },
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

  targetSeriesId ||=
    (await findMatchingSeries({
      eventDate: event.eventDate,
      kind,
      patientName: identity.patientName,
      patientRut: identity.patientRut,
    }));

  if (!targetSeriesId) {
    const created = await db.clinicalSeries.create({
      data: {
        beneficiaryName: identity.beneficiaryName,
        beneficiaryRut: identity.beneficiaryRut,
        displayName: buildSeriesDisplayName({
          kind,
          patientName: identity.patientName,
          patientRut: identity.patientRut,
        }),
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
      data: {
        clinicalSeries: {
          connect: { id: targetSeriesId },
        },
      },
    });
  }

  await refreshClinicalSeriesMetadata(targetSeriesId);
  return targetSeriesId;
}

export async function syncClinicalSeriesForEventIds(
  eventIds: number[],
  onProgress?: (processed: number, total: number) => void,
) {
  const unique = [...new Set(eventIds.filter((value) => Number.isFinite(value) && value > 0))];
  let processed = 0;
  for (const eventId of unique) {
    await syncClinicalSeriesForInternalEventId(eventId);
    processed++;
    onProgress?.(processed, unique.length);
  }
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
  params?: { from?: string; to?: string },
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

  return {
    processed: total,
    from: params?.from ?? null,
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
      currentRebuildJob.currentStep = `${result.processed} eventos procesados`;
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
    patientName: item.patientName ?? null,
    patientRut: item.patientRut ?? null,
    seriesStageKind: (item.seriesStageKind as ClinicalSeriesStageKind | null) ?? null,
    seriesStageLabel: item.seriesStageLabel ?? null,
    seriesStageNumber: item.seriesStageNumber ?? null,
    summary: item.summary ?? null,
  }));

  const totalExpected = events.reduce((sum, item) => sum + (item.amountExpected ?? 0), 0);
  const totalPaid = events.reduce((sum, item) => sum + (item.amountPaid ?? 0), 0);
  const totalLinkedAmount = linkedDocuments.reduce((sum, item) => sum + item.totalAmount, 0);
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
    remainingExpected: Math.max(0, totalExpected - totalLinkedAmount),
    remainingPaid: Math.max(0, totalPaid - totalLinkedAmount),
    status: series.status as ClinicalSeriesSnapshot["status"],
    totalExpected,
    totalLinkedAmount,
    totalPaid,
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
      displayName: series.displayName ?? null,
      beneficiaryName: series.beneficiaryName ?? null,
      beneficiaryRut: series.beneficiaryRut ?? null,
      eligibleDocumentDateFrom: dayjs().tz(TIMEZONE).format("YYYY-MM-DD"),
      eligibleDocumentDateTo: dayjs().tz(TIMEZONE).format("YYYY-MM-DD"),
      events: [],
      id: series.id,
      kind: series.kind as ClinicalSeriesKind,
      linkedDocuments: [],
      patientName: series.patientName ?? null,
      patientRut: series.patientRut ?? null,
      remainingExpected: 0,
      remainingPaid: 0,
      status: series.status as ClinicalSeriesSnapshot["status"],
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
        COALESCE(SUM(e.amount_expected), 0)::float AS total_expected
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

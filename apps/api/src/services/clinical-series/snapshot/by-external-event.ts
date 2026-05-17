import { db } from "@finanzas/db";
import type { SchemaType } from "@finanzas/db/schema";
import type { ModelResult } from "@zenstackhq/orm";
import dayjs from "dayjs";

import { inferHealthInsurance } from "../classification/insurance.ts";
import { TIMEZONE } from "../constants.ts";
import { extractSeriesPhones } from "../extraction/phones.ts";
import { loadEventSeriesCandidateByExternalIds } from "../matching/candidates.ts";
import { normalizeStoredPhoneArray } from "../normalization/phones.ts";
import type {
  ClinicalSeriesEventSnapshot,
  ClinicalSeriesKind,
  ClinicalSeriesLinkedDocument,
  ClinicalSeriesSnapshot,
  ClinicalSeriesStageKind,
  DeliveryModality,
  HealthInsuranceType,
  SubcutaneousAllergenType,
  SubcutaneousVaccineProduct,
} from "../types.ts";

import { computeSnapshotTiming, isPastOrTodayEvent } from "./timing.ts";

export async function getClinicalSeriesSnapshotByExternalEvent(params: {
  calendarId: string;
  eventId: string;
}): Promise<ClinicalSeriesSnapshot | null> {
  const event = await loadEventSeriesCandidateByExternalIds(params.calendarId, params.eventId);
  if (!event?.clinicalSeriesId) {
    return null;
  }

  // Explicit ModelResult escape-hatch (ZenStack v3 docs canonical
  // pattern) — pins the nested-include shape so tsgo doesn't have to
  // resolve the relation graph through inference. Without this, the
  // 3-level include (clinicalSeries → events → calendar) cascades
  // implicit-any across every downstream `series.events.map(...)`
  // and `series.events.reduce(...)` callback.
  type SeriesWithEvents = ModelResult<
    SchemaType,
    "ClinicalSeries",
    {
      include: {
        events: {
          include: { calendar: { select: { googleId: true } } };
        };
      };
    }
  >;

  const series = (await db.clinicalSeries.findUnique({
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
  })) as SeriesWithEvents | null;

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
  const eventDocumentRows = await db.$queryRaw<
    Array<{ dteSaleDetailId: string; eventId: number; folio: string; totalAmount: number }>
  >`
    SELECT DISTINCT ON (l.event_id, s.id)
      l.event_id AS "eventId",
      s.id AS "dteSaleDetailId",
      s.folio AS "folio",
      COALESCE(s.total_amount, 0)::float AS "totalAmount"
    FROM event_dte_sale_links l
    JOIN events e ON e.id = l.event_id
    JOIN dte_sale_details s ON s.id = l.dte_sale_detail_id
    WHERE e.clinical_series_id = ${series.id}
      AND l.status != 'REJECTED'
    ORDER BY l.event_id, s.id, l.updated_at DESC
  `;
  const documentsByEventId = new Map<
    number,
    Array<{ dteSaleDetailId: string; folio: string; totalAmount: number }>
  >();
  for (const row of eventDocumentRows) {
    const documents = documentsByEventId.get(row.eventId) ?? [];
    documents.push({
      dteSaleDetailId: row.dteSaleDetailId,
      folio: row.folio,
      totalAmount: row.totalAmount,
    });
    documentsByEventId.set(row.eventId, documents);
  }
  const storedPatientPhones = normalizeStoredPhoneArray(series.patientPhones);
  const storedBeneficiaryPhones = normalizeStoredPhoneArray(series.beneficiaryPhones);
  const seriesPhones =
    storedPatientPhones.length > 0 || storedBeneficiaryPhones.length > 0
      ? {
          beneficiaryPhones: new Set(storedBeneficiaryPhones),
          patientPhones: new Set(storedPatientPhones),
        }
      : series.events.reduce(
          (
            acc: { beneficiaryPhones: Set<string>; patientPhones: Set<string> },
            item: { description: null | string; summary: null | string }
          ) => {
            const extracted = extractSeriesPhones(item.summary ?? null, item.description ?? null);
            extracted.patientPhones.forEach((phone) => acc.patientPhones.add(phone));
            extracted.beneficiaryPhones.forEach((phone) => acc.beneficiaryPhones.add(phone));
            return acc;
          },
          { beneficiaryPhones: new Set<string>(), patientPhones: new Set<string>() }
        );

  const events: ClinicalSeriesEventSnapshot[] = series.events.map((item) => ({
    amountExpected: item.amountExpected,
    amountPaid: item.amountPaid,
    beneficiaryName: item.beneficiaryName ?? null,
    beneficiaryRut: item.beneficiaryRut ?? null,
    calendarGoogleId: item.calendar.googleId,
    description: item.description ?? null,
    dosageUnit: item.dosageUnit ?? null,
    dosageValue: item.dosageValue ?? null,
    eventDate: dayjs(item.startDate ?? item.startDateTime ?? item.endDate ?? item.endDateTime)
      .tz(TIMEZONE)
      .format("YYYY-MM-DD"),
    eventTime:
      item.startDateTime != null
        ? dayjs(item.startDateTime).tz(TIMEZONE).format("HH:mm")
        : item.endDateTime != null
          ? dayjs(item.endDateTime).tz(TIMEZONE).format("HH:mm")
          : null,
    eventId: item.id,
    externalEventId: item.externalEventId,
    linkedDocuments: documentsByEventId.get(item.id) ?? [],
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
  const inferredInsurance = inferHealthInsurance(
    series.events.map((item) => ({
      description: item.description ?? null,
      eventDate: dayjs(item.startDate ?? item.startDateTime ?? item.endDate ?? item.endDateTime)
        .tz(TIMEZONE)
        .format("YYYY-MM-DD"),
      eventId: item.id,
      summary: item.summary ?? null,
    }))
  );
  const resolvedHealthInsurance =
    (series.healthInsurance as HealthInsuranceType | null) ??
    inferredInsurance.healthInsurance ??
    null;
  const resolvedIsapreName = series.isapreName ?? inferredInsurance.isapreName ?? null;

  const baseSnapshot: ClinicalSeriesSnapshot = {
    allergenType: (series.allergenType as SubcutaneousAllergenType | null) ?? null,
    abandonmentBucket: null,
    daysSinceLastEvent: null,
    vaccineProduct: (series.vaccineProduct as SubcutaneousVaccineProduct | null) ?? null,
    healthInsurance: resolvedHealthInsurance,
    isapreName: resolvedIsapreName,
    deliveryModality: (series.deliveryModality as DeliveryModality | null) ?? null,
    beneficiaryName: series.beneficiaryName ?? null,
    beneficiaryPhones: [...seriesPhones.beneficiaryPhones],
    beneficiaryRut: series.beneficiaryRut ?? null,
    displayName: series.displayName ?? null,
    eligibleDocumentDateFrom,
    eligibleDocumentDateTo,
    events,
    id: series.id,
    kind: series.kind as ClinicalSeriesKind,
    lastAbandonmentContact: null,
    lastEventDate: null,
    linkedDocuments,
    nextEventDate: null,
    patientName: series.patientName ?? null,
    patientPhones: [...seriesPhones.patientPhones],
    patientRut: series.patientRut ?? null,
    remainingExpected: Math.max(0, totalExpectedDue - totalLinkedAmount),
    remainingPaid: Math.max(0, totalPaidDue - totalLinkedAmount),
    status: series.status as ClinicalSeriesSnapshot["status"],
    totalExpected: totalExpectedDue,
    totalLinkedAmount,
    totalPaid: totalPaidDue,
    upcomingCount: 0,
  };

  return {
    ...baseSnapshot,
    ...computeSnapshotTiming(baseSnapshot, today),
  };
}

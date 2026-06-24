import type { SchemaType } from "@finanzas/db/schema";
import type { ModelResult } from "@zenstackhq/orm";

import {
  dbDateToISO,
  formatChileTime,
  instantToChileDate,
  toChileDateString,
} from "../../../lib/time.ts";
import { inferHealthInsurance } from "../classification/insurance.ts";
import { extractSeriesPhones } from "../extraction/phones.ts";
import { normalizeStoredPhoneArray } from "../normalization/phones.ts";

// Event calendar date: startDate/endDate are @db.Date (UTC, dbDateToISO);
// startDateTime/endDateTime are @db.Timestamptz instants (instantToChileDate).
// Same priority as the old coalesce, but the right rule per column type.
function coalesceEventDate(item: {
  startDate?: Date | null;
  startDateTime?: Date | null;
  endDate?: Date | null;
  endDateTime?: Date | null;
}): string {
  return (
    dbDateToISO(item.startDate) ??
    instantToChileDate(item.startDateTime) ??
    dbDateToISO(item.endDate) ??
    instantToChileDate(item.endDateTime) ??
    ""
  );
}
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

// A clinical series with its events (+ calendar googleId) and the most recent
// abandonment contact already loaded. Both the single-snapshot path
// (by-external-event / by-id) and the batched list path materialise this exact
// shape before delegating to the pure assembler below, so the two paths can
// never diverge.
export type SeriesWithEventsAndContacts = ModelResult<
  SchemaType,
  "ClinicalSeries",
  {
    include: {
      abandonmentContacts: { select: { contactedAt: true; outcome: true } };
      events: {
        include: { calendar: { select: { googleId: true } } };
      };
    };
  }
>;

// Per-series DTE-link projections. The single-snapshot path fills these from
// three `WHERE clinical_series_id = $id` queries; the list path fills them from
// three batched `WHERE clinical_series_id = ANY($ids)` queries grouped per
// series. Identical content either way.
export interface SnapshotLinkMaps {
  linkedDocuments: ClinicalSeriesLinkedDocument[];
  foliosByEventId: Map<number, string[]>;
  documentsByEventId: Map<
    number,
    Array<{ dteSaleDetailId: string; folio: string; totalAmount: number }>
  >;
}

const EMPTY_LINK_MAPS: SnapshotLinkMaps = {
  linkedDocuments: [],
  foliosByEventId: new Map(),
  documentsByEventId: new Map(),
};

function resolveLastAbandonmentContact(
  series: SeriesWithEventsAndContacts
): ClinicalSeriesSnapshot["lastAbandonmentContact"] {
  const lastContact = series.abandonmentContacts[0] ?? null;
  if (!lastContact) return null;
  type LastContact = NonNullable<ClinicalSeriesSnapshot["lastAbandonmentContact"]>;
  return {
    contactedAt: lastContact.contactedAt.toISOString(),
    outcome: lastContact.outcome as LastContact["outcome"],
  };
}

/**
 * Pure (no-DB) assembly of a ClinicalSeriesSnapshot from an already-loaded
 * series and its already-loaded DTE-link maps. This is the single source of
 * truth for snapshot shape — extracted from the old by-external-event/by-id
 * bodies so the per-row and batched-list paths share identical logic.
 */
export function assembleClinicalSeriesSnapshot(
  series: SeriesWithEventsAndContacts,
  linkMaps: SnapshotLinkMaps = EMPTY_LINK_MAPS
): ClinicalSeriesSnapshot {
  const today = toChileDateString(new Date());
  const lastAbandonmentContact = resolveLastAbandonmentContact(series);
  const inferredInsurance = inferHealthInsurance(
    series.events.map((item) => ({
      description: item.description ?? null,
      eventDate: coalesceEventDate(item),
      eventId: item.id,
      summary: item.summary ?? null,
    }))
  );
  const resolvedHealthInsurance =
    (series.healthInsurance as HealthInsuranceType | null) ??
    inferredInsurance.healthInsurance ??
    null;
  const resolvedIsapreName = series.isapreName ?? inferredInsurance.isapreName ?? null;

  // No events → empty snapshot (mirrors the old by-id syntheticEvent branch).
  if (series.events.length === 0) {
    return {
      allergenType: (series.allergenType as SubcutaneousAllergenType | null) ?? null,
      abandonmentBucket: null,
      beneficiaryName: series.beneficiaryName ?? null,
      beneficiaryPhones: normalizeStoredPhoneArray(series.beneficiaryPhones),
      beneficiaryRut: series.beneficiaryRut ?? null,
      daysSinceLastEvent: null,
      deliveryModality: (series.deliveryModality as DeliveryModality | null) ?? null,
      displayName: series.displayName ?? null,
      eligibleDocumentDateFrom: today,
      eligibleDocumentDateTo: today,
      events: [],
      healthInsurance: resolvedHealthInsurance,
      id: series.id,
      isapreName: resolvedIsapreName,
      kind: series.kind as ClinicalSeriesKind,
      lastAbandonmentContact,
      lastEventDate: null,
      linkedDocuments: [],
      nextEventDate: null,
      patientName: series.patientName ?? null,
      patientPhones: normalizeStoredPhoneArray(series.patientPhones),
      patientRut: series.patientRut ?? null,
      remainingExpected: 0,
      remainingPaid: 0,
      status: series.status as ClinicalSeriesSnapshot["status"],
      vaccineProduct: (series.vaccineProduct as SubcutaneousVaccineProduct | null) ?? null,
      totalExpected: 0,
      totalLinkedAmount: 0,
      totalPaid: 0,
      upcomingCount: 0,
    };
  }

  const { linkedDocuments, foliosByEventId, documentsByEventId } = linkMaps;

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
    eventDate: coalesceEventDate(item),
    eventTime:
      item.startDateTime != null
        ? formatChileTime(item.startDateTime)
        : item.endDateTime != null
          ? formatChileTime(item.endDateTime)
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
  const dueEvents = events.filter((item) => isPastOrTodayEvent(item.eventDate, today));
  const totalExpectedDue = dueEvents.reduce((sum, item) => sum + (item.amountExpected ?? 0), 0);
  const totalPaidDue = dueEvents.reduce((sum, item) => sum + (item.amountPaid ?? 0), 0);
  const eventDates = events.map((item) => item.eventDate).sort();
  const startDate = eventDates[0] ?? today;
  const endDate = eventDates[eventDates.length - 1] ?? startDate;
  // startDate/endDate are YYYY-MM-DD event-date strings -> PlainDate math.
  const eligibleDocumentDateFrom = Temporal.PlainDate.from(startDate)
    .subtract({ days: 7 })
    .toString();
  const endPlus30 = Temporal.PlainDate.from(endDate).add({ days: 30 });
  const eligibleDocumentDateTo =
    Temporal.PlainDate.compare(endPlus30, Temporal.PlainDate.from(today)) >= 0
      ? today
      : endPlus30.toString();

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
    lastAbandonmentContact,
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

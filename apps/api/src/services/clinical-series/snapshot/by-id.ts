import { db } from "@finanzas/db";
import dayjs from "dayjs";

import { inferHealthInsurance } from "../classification/insurance.ts";
import { TIMEZONE } from "../constants.ts";
import { normalizeStoredPhoneArray } from "../normalization/phones.ts";
import type {
  ClinicalSeriesKind,
  ClinicalSeriesSnapshot,
  DeliveryModality,
  HealthInsuranceType,
  SubcutaneousAllergenType,
  SubcutaneousVaccineProduct,
} from "../types.ts";

import { getClinicalSeriesSnapshotByExternalEvent } from "./by-external-event.ts";
import { computeSnapshotTiming } from "./timing.ts";

export async function getClinicalSeriesSnapshotById(
  id: number
): Promise<ClinicalSeriesSnapshot | null> {
  const series = await db.clinicalSeries.findUnique({
    where: { id },
    include: {
      abandonmentContacts: {
        orderBy: { contactedAt: "desc" },
        take: 1,
        select: { contactedAt: true, outcome: true },
      },
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

  if (!series) {
    return null;
  }

  const syntheticEvent = series.events[0];
  const today = dayjs().tz(TIMEZONE).format("YYYY-MM-DD");
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
  const lastContact = series.abandonmentContacts[0] ?? null;
  type LastContact = NonNullable<ClinicalSeriesSnapshot["lastAbandonmentContact"]>;
  const lastAbandonmentContact: ClinicalSeriesSnapshot["lastAbandonmentContact"] = lastContact
    ? {
        contactedAt: lastContact.contactedAt.toISOString(),
        outcome: lastContact.outcome as LastContact["outcome"],
      }
    : null;

  if (!syntheticEvent) {
    return {
      allergenType: (series.allergenType as SubcutaneousAllergenType | null) ?? null,
      abandonmentBucket: null,
      beneficiaryName: series.beneficiaryName ?? null,
      beneficiaryPhones: normalizeStoredPhoneArray(series.beneficiaryPhones),
      beneficiaryRut: series.beneficiaryRut ?? null,
      daysSinceLastEvent: null,
      deliveryModality: (series.deliveryModality as DeliveryModality | null) ?? null,
      displayName: series.displayName ?? null,
      eligibleDocumentDateFrom: dayjs().tz(TIMEZONE).format("YYYY-MM-DD"),
      eligibleDocumentDateTo: dayjs().tz(TIMEZONE).format("YYYY-MM-DD"),
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

  const snapshot = await getClinicalSeriesSnapshotByExternalEvent({
    calendarId: syntheticEvent.calendar.googleId,
    eventId: syntheticEvent.externalEventId,
  });
  if (!snapshot) return null;
  return {
    ...snapshot,
    ...computeSnapshotTiming(snapshot, today),
    lastAbandonmentContact,
  };
}

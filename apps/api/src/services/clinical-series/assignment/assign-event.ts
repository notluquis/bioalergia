import { db } from "@finanzas/db";
import dayjs from "dayjs";

import { parseCalendarMetadata } from "../../../lib/parsers.ts";

import { buildSeriesDisplayName } from "../classification/display.ts";
import { inferSeriesKind } from "../classification/kind.ts";
import { TIMEZONE } from "../constants.ts";
import { SeriesAssignmentContext } from "../context.ts";
import { resolveClinicalIdentity } from "../extraction/identity.ts";
import { extractSeriesPhones } from "../extraction/phones.ts";
import { findMatchingSeries } from "../matching/find.ts";
import type { EventSeriesCandidate } from "../types.ts";

/**
 * Core per-event sync logic — load-agnostic. Returns the series ID
 * that was touched (for the caller to schedule a deduplicated
 * metadata refresh), or null if the event does not qualify for a
 * clinical series.
 */
export async function assignEventToSeries(
  event: EventSeriesCandidate,
  ctx?: SeriesAssignmentContext
): Promise<null | number> {
  const inferredMetadata = parseCalendarMetadata({
    description: event.description,
    summary: event.summary,
  });
  const kind = inferredMetadata.clinicalSeriesKind ?? inferSeriesKind(event);
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

  const extractedPhones = extractSeriesPhones(event.summary, event.description);

  // Always call findMatchingSeries first — it returns the oldest
  // canonical series for this patient+kind by ordering candidates id
  // ASC and preferring the one with the smallest date distance. This
  // ensures that during a rebuild an event already sitting in a newer
  // duplicate series gets re-assigned to the original.
  let targetSeriesId = await findMatchingSeries(
    {
      beneficiaryRut: identity.beneficiaryRut,
      eventDate: event.eventDate,
      kind,
      patientName: identity.patientName,
      patientPhones: extractedPhones.patientPhones,
      patientRut: identity.patientRut,
    },
    ctx
  );

  // Fallback: if nothing found but the event already has a compatible
  // series (e.g. brand-new patient, no prior series of this kind),
  // keep it there.
  if (!targetSeriesId && event.clinicalSeriesId != null) {
    // Use context entry when available — avoids a DB round trip.
    const current =
      ctx?.seriesById.get(event.clinicalSeriesId) ??
      (await db.clinicalSeries.findUnique({
        where: { id: event.clinicalSeriesId },
        select: { beneficiaryRut: true, id: true, kind: true, patientRut: true },
      }));
    if (
      current?.kind === kind &&
      (!identity.patientRut || !current.patientRut || current.patientRut === identity.patientRut) &&
      (!identity.beneficiaryRut ||
        !current.beneficiaryRut ||
        current.beneficiaryRut === identity.beneficiaryRut)
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
    // Register new series in the context so subsequent events find it.
    // Use `created.id` directly (number) instead of the `let`-typed
    // `targetSeriesId` (number | null) so TS doesn't widen the union.
    ctx?.register({
      beneficiaryName: identity.beneficiaryName,
      beneficiaryRut: identity.beneficiaryRut,
      eventCount: 1,
      id: created.id,
      kind,
      maxDate: eventDateDjs,
      minDate: eventDateDjs,
      patientName: identity.patientName,
      patientPhones: extractedPhones.patientPhones,
      patientRut: identity.patientRut,
    });
  }

  // Past this point `targetSeriesId` is guaranteed non-null: either
  // findMatchingSeries returned an id, or the fallback assigned
  // current.id, or the create-branch above assigned created.id. The
  // null-check below is unreachable but keeps TS happy without an
  // assertion operator.
  if (targetSeriesId == null) {
    throw new Error("targetSeriesId unexpectedly null after series resolution");
  }
  const seriesId: number = targetSeriesId;

  if (event.clinicalSeriesId !== seriesId) {
    await db.event.update({
      where: { id: event.eventId },
      data: { clinicalSeries: { connect: { id: seriesId } } },
    });
  }

  // Extend the series' date span so subsequent events get accurate distances.
  ctx?.touch(seriesId, eventDateDjs);

  return seriesId;
}

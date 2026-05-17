import { SeriesAssignmentContext } from "../context.ts";
import {
  loadEventSeriesCandidateByExternalIds,
  loadEventSeriesCandidateByInternalId,
  loadEventSeriesCandidatesByIds,
} from "../matching/candidates.ts";
import { refreshClinicalSeriesMetadata } from "../metadata.ts";

import { assignEventToSeries } from "./assign-event.ts";
import { runConcurrent } from "./concurrent.ts";

export async function syncClinicalSeriesForInternalEventId(
  eventId: number
): Promise<null | number> {
  const event = await loadEventSeriesCandidateByInternalId(eventId);
  if (!event) return null;
  const seriesId = await assignEventToSeries(event);
  if (seriesId != null) await refreshClinicalSeriesMetadata(seriesId);
  return seriesId;
}

export async function syncClinicalSeriesForEventIds(
  eventIds: number[],
  onProgress?: (processed: number, total: number) => void
): Promise<void> {
  const unique = [...new Set(eventIds.filter((value) => Number.isFinite(value) && value > 0))];
  if (unique.length === 0) return;
  const total = unique.length;

  // One query for all events + one query for all existing series — no per-event DB lookups.
  const [events, ctx] = await Promise.all([
    loadEventSeriesCandidatesByIds(unique),
    SeriesAssignmentContext.load(),
  ]);

  // Collect which series were touched so we can refresh metadata
  // exactly once per series at the end — eliminates redundant
  // refreshes and race conditions when the same series has multiple
  // events in the batch.
  const touchedSeriesIds = new Set<number>();
  let processed = 0;

  // 8 concurrent workers sharing a queue — ~8x throughput vs serial.
  await runConcurrent(events, 8, async (event) => {
    const seriesId = await assignEventToSeries(event, ctx).catch(() => null);
    if (seriesId != null) touchedSeriesIds.add(seriesId);
    processed++;
    onProgress?.(processed, total);
  });

  // Refresh each touched series once, also concurrently. Errors are
  // isolated per series so one failure doesn't abort the rest.
  await runConcurrent([...touchedSeriesIds], 8, (id) =>
    refreshClinicalSeriesMetadata(id).catch((err: unknown) => {
      console.error(`[clinical-series] refreshClinicalSeriesMetadata(${id}) failed:`, err);
    })
  );
}

export async function syncClinicalSeriesForExternalEvents(
  events: Array<{ calendarId: string; eventId: string }>
): Promise<void> {
  for (const event of events) {
    const row = await loadEventSeriesCandidateByExternalIds(event.calendarId, event.eventId);
    if (!row) {
      continue;
    }
    await syncClinicalSeriesForInternalEventId(row.eventId);
  }
}

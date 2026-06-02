import { dbClinicalSeries as db } from "@finanzas/db/slices";
import type { ClinicalSeriesSnapshot } from "../types.ts";

import { loadEventSeriesCandidateByExternalIds } from "../matching/candidates.ts";

import { assembleClinicalSeriesSnapshot, type SeriesWithEventsAndContacts } from "./assemble.ts";
import { loadSnapshotLinkMaps } from "./links.ts";

export async function getClinicalSeriesSnapshotByExternalEvent(params: {
  calendarId: string;
  eventId: string;
}): Promise<ClinicalSeriesSnapshot | null> {
  // The candidate lookup only resolves which clinical series the external event
  // belongs to; every other field it returns is unused here.
  const event = await loadEventSeriesCandidateByExternalIds(params.calendarId, params.eventId);
  if (!event?.clinicalSeriesId) {
    return null;
  }

  const series = (await db.clinicalSeries.findUnique({
    where: { id: event.clinicalSeriesId },
    include: {
      abandonmentContacts: {
        orderBy: { contactedAt: "desc" },
        take: 1,
        select: { contactedAt: true, outcome: true },
      },
      events: {
        include: { calendar: { select: { googleId: true } } },
        orderBy: [{ startDate: "asc" }, { startDateTime: "asc" }, { id: "asc" }],
      },
    },
  })) as SeriesWithEventsAndContacts | null;

  if (!series) {
    return null;
  }

  const linkMaps = await loadSnapshotLinkMaps([series.id]);
  return assembleClinicalSeriesSnapshot(series, linkMaps.get(series.id));
}

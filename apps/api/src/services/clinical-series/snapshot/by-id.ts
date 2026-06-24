import { dbClinicalSeries as db } from "@finanzas/db/slices";
import type { ClinicalSeriesSnapshot } from "../types.ts";

import { assembleClinicalSeriesSnapshot, type SeriesWithEventsAndContacts } from "./assemble.ts";
import { loadSnapshotLinkMaps } from "./links.ts";

export async function getClinicalSeriesSnapshotById(
  id: number
): Promise<ClinicalSeriesSnapshot | null> {
  const series = (await db.clinicalSeries.findUnique({
    where: { id },
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

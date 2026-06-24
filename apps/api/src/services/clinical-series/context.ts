import { dbClinicalSeries as db } from "@finanzas/db/slices";

import { dbDateToISO, instantToChileDate } from "../../lib/time.ts";
import { normalizeRut } from "../../lib/rut.ts";

import { getSeriesPatientPhones } from "./extraction/phones.ts";
import { compareSeriesCanonicalPriority, haveCompatiblePatientNames } from "./matching/compare.ts";
import { getSignificantNameTokens, normalizeName } from "./normalization/names.ts";
import type { ClinicalSeriesKind } from "./types.ts";

type EventDateFields = {
  startDate?: Date | null;
  startDateTime?: Date | null;
  endDate?: Date | null;
  endDateTime?: Date | null;
};

// The event's Chile calendar day. @db.Date via dbDateToISO (UTC, no rollback);
// @db.Timestamptz via instantToChileDate. Same priority as the old coalesce.
function eventPlainDate(e: EventDateFields): Temporal.PlainDate | null {
  const iso =
    dbDateToISO(e.startDate) ??
    instantToChileDate(e.startDateTime) ??
    dbDateToISO(e.endDate) ??
    instantToChileDate(e.endDateTime);
  return iso ? Temporal.PlainDate.from(iso) : null;
}

/** Sorted (asc) list of each event's Chile calendar day. */
export function toEventPlainDates(events: EventDateFields[]): Temporal.PlainDate[] {
  return events
    .map(eventPlainDate)
    .filter((v): v is Temporal.PlainDate => v != null)
    .sort(Temporal.PlainDate.compare);
}

/** Distance in days from eventDate to the [min,max] span (0 if inside). */
export function dayDistanceToSpan(
  eventDate: Temporal.PlainDate,
  sortedDates: Temporal.PlainDate[]
): number {
  if (sortedDates.length === 0) return Infinity;
  const min = sortedDates[0];
  const max = sortedDates[sortedDates.length - 1];
  if (Temporal.PlainDate.compare(eventDate, min) < 0) {
    return eventDate.until(min, { largestUnit: "day" }).days;
  }
  if (Temporal.PlainDate.compare(eventDate, max) > 0) {
    return max.until(eventDate, { largestUnit: "day" }).days;
  }
  return 0;
}

export interface SeriesEntry {
  beneficiaryName: null | string;
  beneficiaryRut: null | string;
  eventCount: number;
  id: number;
  kind: ClinicalSeriesKind;
  maxDate: Temporal.PlainDate | null;
  minDate: Temporal.PlainDate | null;
  patientName: null | string;
  patientPhones: string[];
  patientRut: null | string;
}

/**
 * Pre-loaded in-memory index of all clinical series. Eliminates
 * per-event DB queries during bulk rebuilds — a single load replaces
 * O(N) round trips with O(1) map lookups and O(k) token-overlap
 * scans.
 */
export class SeriesAssignmentContext {
  // RUT index stays single-valued; exact-name collisions keep all
  // candidates so rebuild can prefer the best canonical series
  // rather than the oldest id.
  private readonly rutKindIndex = new Map<string, number>(); // `${rut}:${kind}` → id
  private readonly nameKindIndex = new Map<string, number[]>(); // `${name}:${kind}` → [id, …]
  private readonly phoneKindIndex = new Map<string, number[]>(); // `${phone}:${kind}` → [id, …]
  // Token inverted index — insertion order matches id ASC load order.
  private readonly tokenIndex = new Map<string, number[]>(); // token → [id, …]
  readonly seriesById = new Map<number, SeriesEntry>();

  private addEntry(entry: SeriesEntry): void {
    this.seriesById.set(entry.id, entry);

    if (entry.patientRut) {
      const key = `${normalizeRut(entry.patientRut)}:${entry.kind}`;
      this.rutKindIndex.getOrInsert(key, entry.id);
    }
    if (entry.patientName) {
      const key = `${normalizeName(entry.patientName)}:${entry.kind}`;
      const ids = this.nameKindIndex.get(key);
      if (ids) ids.push(entry.id);
      else this.nameKindIndex.set(key, [entry.id]);
      for (const token of getSignificantNameTokens(entry.patientName)) {
        const list = this.tokenIndex.get(token);
        if (list) list.push(entry.id);
        else this.tokenIndex.set(token, [entry.id]);
      }
    }

    for (const phone of entry.patientPhones) {
      const key = `${phone}:${entry.kind}`;
      const ids = this.phoneKindIndex.get(key);
      if (ids) ids.push(entry.id);
      else this.phoneKindIndex.set(key, [entry.id]);
    }
  }

  static async load(): Promise<SeriesAssignmentContext> {
    const ctx = new SeriesAssignmentContext();
    const rows = await db.clinicalSeries.findMany({
      select: {
        beneficiaryName: true,
        beneficiaryRut: true,
        id: true,
        kind: true,
        patientName: true,
        patientPhones: true,
        patientRut: true,
        events: {
          select: {
            description: true,
            endDate: true,
            endDateTime: true,
            startDate: true,
            startDateTime: true,
            summary: true,
          },
        },
      },
      orderBy: { id: "asc" },
    });
    for (const s of rows) {
      const dates = toEventPlainDates(s.events);
      ctx.addEntry({
        beneficiaryName: s.beneficiaryName,
        beneficiaryRut: s.beneficiaryRut,
        eventCount: s.events.length,
        id: s.id,
        kind: s.kind,
        maxDate: dates[dates.length - 1] ?? null,
        minDate: dates[0] ?? null,
        patientName: s.patientName,
        patientPhones: getSeriesPatientPhones(s),
        patientRut: s.patientRut,
      });
    }
    return ctx;
  }

  /** Distance in days between eventDate and the series' event span. */
  private dist(entry: SeriesEntry, eventDate: Temporal.PlainDate): number {
    if (!entry.minDate || !entry.maxDate) return Infinity;
    if (Temporal.PlainDate.compare(eventDate, entry.minDate) < 0) {
      return eventDate.until(entry.minDate, { largestUnit: "day" }).days;
    }
    if (Temporal.PlainDate.compare(eventDate, entry.maxDate) > 0) {
      return entry.maxDate.until(eventDate, { largestUnit: "day" }).days;
    }
    return 0;
  }

  /** RUT uniquely identifies the patient — returns the oldest series for this rut+kind. */
  findByRut(rut: string, kind: ClinicalSeriesKind): number | undefined {
    return this.rutKindIndex.get(`${normalizeRut(rut)}:${kind}`);
  }

  /** Exact normalized name match, closest within the date window. */
  findByName(
    name: string,
    kind: ClinicalSeriesKind,
    eventDate: Temporal.PlainDate,
    thresholdDays: number
  ): number | undefined {
    const ids = this.nameKindIndex.get(`${normalizeName(name)}:${kind}`) ?? [];
    const candidates = ids
      .map((id) => this.seriesById.get(id))
      .filter(
        (entry): entry is SeriesEntry => !!entry && this.dist(entry, eventDate) <= thresholdDays
      )
      .sort((a, b) => {
        const distanceDelta = this.dist(a, eventDate) - this.dist(b, eventDate);
        if (distanceDelta !== 0) return distanceDelta;
        return compareSeriesCanonicalPriority(a, b);
      });
    return candidates[0]?.id;
  }

  /** Choose the canonical same-kind series for this exact normalized name. */
  findUniqueByExactName(name: string, kind: ClinicalSeriesKind): number | undefined {
    const ids = this.nameKindIndex.get(`${normalizeName(name)}:${kind}`) ?? [];
    return ids
      .map((id) => this.seriesById.get(id))
      .filter((entry): entry is SeriesEntry => !!entry)
      .sort(compareSeriesCanonicalPriority)[0]?.id;
  }

  findDuplicateCanonicalByExactName(name: string, kind: ClinicalSeriesKind): number | undefined {
    const ids = this.nameKindIndex.get(`${normalizeName(name)}:${kind}`) ?? [];
    if (ids.length !== 2) return undefined;
    return ids
      .map((id) => this.seriesById.get(id))
      .filter((entry): entry is SeriesEntry => !!entry)
      .sort(compareSeriesCanonicalPriority)[0]?.id;
  }

  findByPhoneAndCompatibleName(
    phones: string[],
    name: string,
    kind: ClinicalSeriesKind,
    eventDate: Temporal.PlainDate,
    thresholdDays: number
  ): number | undefined {
    void eventDate;
    void thresholdDays;
    const candidateIds = new Set<number>();
    for (const phone of phones) {
      for (const id of this.phoneKindIndex.get(`${phone}:${kind}`) ?? []) {
        candidateIds.add(id);
      }
    }

    const candidates = [...candidateIds]
      .map((id) => this.seriesById.get(id))
      .filter(
        (entry): entry is SeriesEntry =>
          !!entry && !!entry.patientName && haveCompatiblePatientNames(entry.patientName, name)
      )
      .sort(compareSeriesCanonicalPriority);

    return candidates[0]?.id;
  }

  findCanonicalPhoneDuplicate(id: number): number | undefined {
    const base = this.seriesById.get(id);
    if (!base?.patientName || base.patientPhones.length === 0) return undefined;

    const candidateIds = new Set<number>([id]);
    for (const phone of base.patientPhones) {
      for (const candidateId of this.phoneKindIndex.get(`${phone}:${base.kind}`) ?? []) {
        candidateIds.add(candidateId);
      }
    }

    const candidates = [...candidateIds]
      .map((candidateId) => this.seriesById.get(candidateId))
      .filter(
        (entry): entry is SeriesEntry =>
          !!entry &&
          !!entry.patientName &&
          haveCompatiblePatientNames(entry.patientName, base.patientName)
      )
      .sort(compareSeriesCanonicalPriority);

    return candidates[0]?.id;
  }

  /**
   * Token-overlap fallback: finds the oldest same-kind series that
   * shares ≥2 significant tokens covering ≥2/3 of the shorter name.
   * Used when exact name matching fails (e.g. "jose luis ojeda" ↔
   * "jose ojeda carrasco").
   */
  findByTokenOverlap(
    name: string,
    kind: ClinicalSeriesKind,
    eventDate: Temporal.PlainDate,
    thresholdDays: number
  ): number | undefined {
    const eventTokens = getSignificantNameTokens(name);
    if (eventTokens.length < 2) return undefined;

    // Count how many event tokens appear in each candidate series.
    const overlapCount = new Map<number, number>();
    for (const token of eventTokens) {
      for (const id of this.tokenIndex.get(token) ?? []) {
        overlapCount.set(id, (overlapCount.get(id) ?? 0) + 1);
      }
    }

    let best: SeriesEntry | undefined;
    for (const [id, overlap] of overlapCount) {
      if (overlap < 2) continue;
      const entry = this.seriesById.get(id);
      if (!entry || entry.kind !== kind || !entry.patientName) continue;
      const shorterLen = Math.min(
        eventTokens.length,
        getSignificantNameTokens(entry.patientName).length
      );
      if (overlap / shorterLen < 2 / 3) continue;
      if (this.dist(entry, eventDate) > thresholdDays) continue;
      if (!best) {
        best = entry;
        continue;
      }
      const currentBest = best;
      const bestOverlap = eventTokens.filter((t) =>
        getSignificantNameTokens(currentBest.patientName ?? "").includes(t)
      ).length;
      if (
        overlap > bestOverlap ||
        (overlap === bestOverlap && compareSeriesCanonicalPriority(entry, currentBest) < 0)
      ) {
        best = entry;
      }
    }
    return best?.id;
  }

  /** Register a newly created series so subsequent lookups can find it. */
  register(entry: SeriesEntry): void {
    this.addEntry(entry);
  }

  /** Extend the series' date span after assigning an event to it. */
  touch(id: number, eventDate: Temporal.PlainDate): void {
    const entry = this.seriesById.get(id);
    if (!entry) return;
    if (!entry.minDate || Temporal.PlainDate.compare(eventDate, entry.minDate) < 0)
      entry.minDate = eventDate;
    if (!entry.maxDate || Temporal.PlainDate.compare(eventDate, entry.maxDate) > 0)
      entry.maxDate = eventDate;
  }
}

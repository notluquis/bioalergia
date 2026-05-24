import { dbClinicalSeries as db } from "@finanzas/db/slices";

import { normalizeRut } from "../../../lib/rut.ts";

import { getSeriesPatientPhones } from "../extraction/phones.ts";
import {
  hasConflictingPrimaryIdentity,
  hasHardPatientRutConflictForDuplicateDetection,
  haveCompatiblePatientNames,
  scoreClinicalSeriesIdentityQuality,
} from "../matching/compare.ts";
import { isLikelyPersonName, normalizeName } from "../normalization/names.ts";
import type { ClinicalSeriesDuplicate, ClinicalSeriesKind } from "../types.ts";

function toDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function toTimeZoneDateKey(value: Date, timeZone = "America/Santiago"): string {
  const parts = new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : toDateKey(value);
}

export async function detectDuplicateSeries(): Promise<ClinicalSeriesDuplicate[]> {
  // Fetch all series that have clinical evidence. Some imported skin tests
  // initially have a ClinicalSkinTest row but no calendar event; those still
  // must participate in duplicate detection.
  type SeriesRow = {
    beneficiaryName: null | string;
    beneficiaryPhones: unknown;
    beneficiaryRut: null | string;
    events?: Array<{
      description: null | string;
      endDate: Date | null;
      endDateTime: Date | null;
      startDate: Date | null;
      startDateTime: Date | null;
      summary: null | string;
    }>;
    id: number;
    kind: ClinicalSeriesKind;
    patientId: number | null;
    patientName: string | null;
    patientPhones: unknown;
    patientRut: string | null;
    skinTests: Array<{ testDate: Date }>;
    _count: { events: number };
  };
  const seriesRows = await db.clinicalSeries.findMany({
    select: {
      beneficiaryName: true,
      beneficiaryPhones: true,
      beneficiaryRut: true,
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
      id: true,
      kind: true,
      patientId: true,
      patientName: true,
      patientPhones: true,
      patientRut: true,
      _count: { select: { events: true } },
    },
    orderBy: { id: "asc" },
  });
  const skinTests = await db.$queryRaw<Array<{ clinicalSeriesId: number; testDate: Date }>>`
      SELECT clinical_series_id AS "clinicalSeriesId", test_date AS "testDate"
      FROM clinical_skin_tests
    `;
  const skinTestsBySeries = new Map<number, Array<{ testDate: Date }>>();
  for (const test of skinTests) {
    const group = skinTestsBySeries.get(test.clinicalSeriesId);
    if (group) group.push({ testDate: test.testDate });
    else skinTestsBySeries.set(test.clinicalSeriesId, [{ testDate: test.testDate }]);
  }
  const allSeries: SeriesRow[] = seriesRows
    .map((series) => ({
      ...series,
      skinTests: skinTestsBySeries.get(series.id) ?? [],
    }))
    .filter((series) => series._count.events > 0 || series.skinTests.length > 0);

  const results: ClinicalSeriesDuplicate[] = [];
  const usedAsSources = new Set<number>();

  const chooseCanonicalTarget = (group: SeriesRow[]): SeriesRow =>
    [...group].sort((a, b) => {
      const scoreDelta =
        scoreClinicalSeriesIdentityQuality({
          beneficiaryName: b.beneficiaryName,
          beneficiaryRut: b.beneficiaryRut,
          eventCount: b._count.events,
          patientName: b.patientName,
          patientRut: b.patientRut,
        }) -
        scoreClinicalSeriesIdentityQuality({
          beneficiaryName: a.beneficiaryName,
          beneficiaryRut: a.beneficiaryRut,
          eventCount: a._count.events,
          patientName: a.patientName,
          patientRut: a.patientRut,
        });
      if (scoreDelta !== 0) return scoreDelta;
      const eventDelta = b._count.events - a._count.events;
      if (eventDelta !== 0) return eventDelta;
      return a.id - b.id;
    })[0]!;

  const clinicalEvidenceDates = (series: SeriesRow): Set<string> => {
    const dates = new Set<string>();
    for (const event of series.events ?? []) {
      if (event.startDate) dates.add(toDateKey(event.startDate));
      else if (event.startDateTime) dates.add(toTimeZoneDateKey(event.startDateTime));
      else if (event.endDate) dates.add(toDateKey(event.endDate));
      else if (event.endDateTime) dates.add(toTimeZoneDateKey(event.endDateTime));
    }
    for (const test of series.skinTests ?? []) {
      dates.add(toDateKey(test.testDate));
    }
    return dates;
  };

  const hasSharedClinicalDate = (left: SeriesRow, right: SeriesRow): boolean => {
    const leftDates = clinicalEvidenceDates(left);
    if (leftDates.size === 0) return false;
    for (const date of clinicalEvidenceDates(right)) {
      if (leftDates.has(date)) return true;
    }
    return false;
  };

  const hasSamePrimaryPatientEvidence = (left: SeriesRow, right: SeriesRow): boolean => {
    if (left.patientId && right.patientId) return left.patientId === right.patientId;
    const leftRut = normalizeRut(left.patientRut);
    const rightRut = normalizeRut(right.patientRut);
    return Boolean(leftRut && rightRut && leftRut === rightRut);
  };

  const chooseClinicalEvidenceTarget = (left: SeriesRow, right: SeriesRow): SeriesRow => {
    if (left._count.events > 0 && right._count.events === 0) return left;
    if (right._count.events > 0 && left._count.events === 0) return right;
    return chooseCanonicalTarget([left, right]);
  };

  // ── Pass 0: event/test-date pairing ──────────────────────────────────────
  // Imported XLSX tests can create a new no-event series even when the calendar
  // event series already exists. If both point to the same patient, same kind,
  // and same clinical date, they are the same series.
  for (const left of allSeries) {
    if (usedAsSources.has(left.id)) continue;
    for (const right of allSeries) {
      if (right.id <= left.id || usedAsSources.has(right.id)) continue;
      if (left.kind !== right.kind) continue;
      if (!hasSamePrimaryPatientEvidence(left, right)) continue;
      if (hasHardPatientRutConflictForDuplicateDetection(left, right)) continue;
      if (hasConflictingPrimaryIdentity(left, right)) continue;
      if (!hasSharedClinicalDate(left, right)) continue;

      const target = chooseClinicalEvidenceTarget(left, right);
      const src = target.id === left.id ? right : left;
      results.push({
        confidence: "high",
        kind: target.kind,
        patientName: target.patientName,
        reason: "Mismo paciente y misma fecha clínica entre evento y examen",
        sourceEventCount: src._count.events,
        sourceId: src.id,
        sourcePatientName: src.patientName,
        sourcePatientRut: src.patientRut,
        targetEventCount: target._count.events,
        targetId: target.id,
      });
      usedAsSources.add(src.id);
    }
  }

  // ── Pass 1: RUT-based grouping — O(n) ────────────────────────────────────
  // Group by (normalizedRut, beneficiaryRut, kind). Series with different
  // beneficiaryRuts serve different patients (e.g. family members under one
  // account) and must NOT be treated as duplicates.
  const rutGroups = new Map<string, SeriesRow[]>();
  for (const s of allSeries) {
    if (!s.patientRut) continue;
    const key = `${normalizeRut(s.patientRut)}:${s.beneficiaryRut ?? ""}:${s.kind}`;
    const group = rutGroups.get(key);
    if (group) group.push(s);
    else rutGroups.set(key, [s]);
  }

  for (const group of rutGroups.values()) {
    if (group.length < 2) continue;
    const target = chooseCanonicalTarget(group);
    for (const src of group) {
      if (src.id === target.id) continue;
      if (usedAsSources.has(src.id)) continue;
      results.push({
        confidence: "high",
        kind: target.kind,
        patientName: target.patientName,
        reason: `Mismo RUT de paciente (${target.patientRut})`,
        sourceEventCount: src._count.events,
        sourceId: src.id,
        sourcePatientName: src.patientName,
        sourcePatientRut: src.patientRut,
        targetEventCount: target._count.events,
        targetId: target.id,
      });
      usedAsSources.add(src.id);
    }
  }

  // ── Pass 2: name-based grouping — O(n) ───────────────────────────────────
  // Group by (normalizedName, kind), ignoring series already used as sources.
  // Only groups of exactly 2 are merged — 3+ with the same name are likely
  // different patients sharing a common name, so we leave them alone.
  const nameGroups = new Map<string, SeriesRow[]>();
  for (const s of allSeries) {
    if (!s.patientName || usedAsSources.has(s.id)) continue;
    const normalized = normalizeName(s.patientName);
    if (!isLikelyPersonName(normalized)) continue;
    const key = `${normalized}:${s.kind}`;
    const group = nameGroups.get(key);
    if (group) group.push(s);
    else nameGroups.set(key, [s]);
  }

  for (const group of nameGroups.values()) {
    if (group.length !== 2) continue;
    const target = chooseCanonicalTarget(group);
    const src = group.find((series) => series.id !== target.id);
    if (!src) continue;
    if (hasHardPatientRutConflictForDuplicateDetection(target, src)) continue;
    if (hasConflictingPrimaryIdentity(target, src)) continue;
    results.push({
      confidence: "high",
      kind: target.kind,
      patientName: target.patientName,
      reason: `Mismo nombre de paciente (${target.patientName})`,
      sourceEventCount: src._count.events,
      sourceId: src.id,
      sourcePatientName: src.patientName,
      sourcePatientRut: src.patientRut,
      targetEventCount: target._count.events,
      targetId: target.id,
    });
    usedAsSources.add(src.id);
  }

  // ── Pass 3: phone + compatible-name grouping — O(n) over phone groups ────
  // This catches cases where one series is missing patient RUT and the name is
  // a subset/superset of the canonical name, but both series clearly share the
  // same patient phone and kind.
  const phoneGroups = new Map<string, SeriesRow[]>();
  for (const s of allSeries) {
    if (!s.patientName || usedAsSources.has(s.id)) continue;
    const phones = getSeriesPatientPhones(s);
    if (phones.length === 0) continue;
    for (const phone of phones) {
      const key = `${phone}:${s.kind}`;
      const group = phoneGroups.get(key);
      if (group) group.push(s);
      else phoneGroups.set(key, [s]);
    }
  }

  for (const group of phoneGroups.values()) {
    if (group.length !== 2) continue;
    const target = chooseCanonicalTarget(group);
    const src = group.find((series) => series.id !== target.id);
    if (!src) continue;
    if (usedAsSources.has(src.id)) continue;
    if (hasHardPatientRutConflictForDuplicateDetection(target, src)) continue;
    if (hasConflictingPrimaryIdentity(target, src)) continue;
    if (!haveCompatiblePatientNames(target.patientName, src.patientName)) continue;
    results.push({
      confidence: "medium",
      kind: target.kind,
      patientName: target.patientName,
      reason: `Mismo telefono de paciente y nombre compatible`,
      sourceEventCount: src._count.events,
      sourceId: src.id,
      sourcePatientName: src.patientName,
      sourcePatientRut: src.patientRut,
      targetEventCount: target._count.events,
      targetId: target.id,
    });
    usedAsSources.add(src.id);
  }

  return results;
}

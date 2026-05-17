import { db } from "@finanzas/db";

import { normalizeRut } from "../../../lib/rut.ts";

import { getSeriesPatientPhones } from "../extraction/phones.ts";
import {
  hasConflictingPrimaryIdentity,
  hasHardPatientRutConflictForDuplicateDetection,
  haveCompatiblePatientNames,
  scoreClinicalSeriesIdentityQuality,
} from "../matching/compare.ts";
import {
  isLikelyPersonName,
  normalizeName,
} from "../normalization/names.ts";
import type { ClinicalSeriesDuplicate, ClinicalSeriesKind } from "../types.ts";

export async function detectDuplicateSeries(): Promise<ClinicalSeriesDuplicate[]> {
  // Fetch all series that have at least one event, ordered by id ASC so the
  // lower (older) id becomes the target and the higher (newer) becomes source.
  type SeriesRow = {
    beneficiaryName: null | string;
    beneficiaryPhones: unknown;
    beneficiaryRut: null | string;
    events?: Array<{ description: null | string; summary: null | string }>;
    id: number;
    kind: ClinicalSeriesKind;
    patientName: string | null;
    patientPhones: unknown;
    patientRut: string | null;
    _count: { events: number };
  };
  const allSeries: SeriesRow[] = await db.clinicalSeries.findMany({
    select: {
      beneficiaryName: true,
      beneficiaryPhones: true,
      beneficiaryRut: true,
      events: {
        select: {
          description: true,
          summary: true,
        },
      },
      id: true,
      kind: true,
      patientName: true,
      patientPhones: true,
      patientRut: true,
      _count: { select: { events: true } },
    },
    where: { events: { some: {} } },
    orderBy: { id: "asc" },
  });

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

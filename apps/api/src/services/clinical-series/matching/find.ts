import { dbClinicalSeries as db } from "@finanzas/db/slices";
import dayjs from "dayjs";

import { getSeriesPatientPhones } from "../extraction/phones.ts";
import {
  getSignificantNameTokens,
} from "../normalization/names.ts";
import { isCloseNormalizedRut } from "../normalization/rut.ts";

import { TIMEZONE } from "../constants.ts";
import { SeriesAssignmentContext } from "../context.ts";
import { getSeriesWindowDays } from "../classification/kind.ts";
import {
  chooseBetterSeriesCandidate,
  chooseCanonicalPhoneDuplicateCandidate,
  compareSeriesCanonicalPriority,
  haveCompatiblePatientNames,
  scoreClinicalSeriesIdentityQuality,
  shouldPreferCandidateOverRutMatch,
} from "./compare.ts";

import type { ClinicalSeriesKind } from "../types.ts";

export async function findMatchingSeries(
  params: {
    beneficiaryRut?: null | string;
    eventDate: string;
    kind: ClinicalSeriesKind;
    patientName: null | string;
    patientPhones?: string[];
    patientRut: null | string;
  },
  ctx?: SeriesAssignmentContext
): Promise<null | number> {
  const eventDateDjs = dayjs.tz(params.eventDate, TIMEZONE);
  const thresholdDays = getSeriesWindowDays(params.kind);

  // ── Fast path: all lookups in memory (O(1) / O(k)) ───────────────────────
  if (ctx) {
    const rutMatchEntry =
      params.patientRut != null
        ? (() => {
            const id = ctx.findByRut(params.patientRut, params.kind);
            return id != null ? (ctx.seriesById.get(id) ?? null) : null;
          })()
        : null;

    if (params.patientName) {
      const duplicateCanonical = ctx.findDuplicateCanonicalByExactName(
        params.patientName,
        params.kind
      );
      if (duplicateCanonical != null) {
        const canonical = ctx.seriesById.get(duplicateCanonical);
        if (
          canonical &&
          (!params.patientRut ||
            canonical.patientRut === params.patientRut ||
            canonical.beneficiaryRut === params.patientRut ||
            canonical.patientRut === params.beneficiaryRut ||
            canonical.beneficiaryRut === params.beneficiaryRut ||
            isCloseNormalizedRut(canonical.patientRut, params.patientRut) ||
            isCloseNormalizedRut(canonical.beneficiaryRut, params.patientRut) ||
            isCloseNormalizedRut(canonical.patientRut, params.beneficiaryRut ?? null) ||
            isCloseNormalizedRut(canonical.beneficiaryRut, params.beneficiaryRut ?? null))
        ) {
          return duplicateCanonical;
        }
      }
    }

    if (params.patientName) {
      const exact = ctx.findByName(params.patientName, params.kind, eventDateDjs, thresholdDays);
      const uniqueExact = ctx.findUniqueByExactName(params.patientName, params.kind);
      const phoneMatch = params.patientPhones?.length
        ? ctx.findByPhoneAndCompatibleName(
            params.patientPhones,
            params.patientName,
            params.kind,
            eventDateDjs,
            thresholdDays
          )
        : undefined;
      const chosen = chooseBetterSeriesCandidate(
        rutMatchEntry,
        exact != null
          ? { ...ctx.seriesById.get(exact)!, eventCount: ctx.seriesById.get(exact)!.eventCount }
          : null,
        uniqueExact != null
          ? {
              ...ctx.seriesById.get(uniqueExact)!,
              eventCount: ctx.seriesById.get(uniqueExact)!.eventCount,
            }
          : null,
        phoneMatch != null
          ? {
              ...ctx.seriesById.get(phoneMatch)!,
              eventCount: ctx.seriesById.get(phoneMatch)!.eventCount,
            }
          : null
      );
      if (chosen) {
        const canonicalPhoneDuplicate = ctx.findCanonicalPhoneDuplicate(chosen.id);
        if (canonicalPhoneDuplicate != null) return canonicalPhoneDuplicate;
        if (shouldPreferCandidateOverRutMatch(rutMatchEntry, chosen)) return chosen.id;
        if (chosen.patientRut) {
          const canonical = ctx.findByRut(chosen.patientRut, params.kind);
          if (canonical != null) return canonical;
        }
        return chosen.id;
      }
      const fuzzy = ctx.findByTokenOverlap(
        params.patientName,
        params.kind,
        eventDateDjs,
        thresholdDays
      );
      if (fuzzy != null) return fuzzy;
    }
    if (rutMatchEntry) {
      const canonicalPhoneDuplicate = ctx.findCanonicalPhoneDuplicate(rutMatchEntry.id);
      if (canonicalPhoneDuplicate != null) return canonicalPhoneDuplicate;
      return rutMatchEntry.id;
    }
    return null;
  }

  // ── Slow path: DB queries (single-event incremental sync) ─────────────────
  const eventSelect = {
    select: {
      description: true,
      endDate: true,
      endDateTime: true,
      startDate: true,
      startDateTime: true,
      summary: true,
    },
  } as const;

  if (params.patientName) {
    const duplicateCandidates = await db.clinicalSeries.findMany({
      where: { kind: params.kind, patientName: params.patientName },
      select: {
        beneficiaryName: true,
        beneficiaryRut: true,
        id: true,
        patientName: true,
        patientRut: true,
        _count: { select: { events: true } },
      },
      orderBy: { id: "asc" },
    });
    if (duplicateCandidates.length === 2) {
      const canonical = [...duplicateCandidates].sort((a, b) =>
        compareSeriesCanonicalPriority(
          {
            beneficiaryName: a.beneficiaryName,
            beneficiaryRut: a.beneficiaryRut,
            eventCount: a._count.events,
            id: a.id,
            patientName: a.patientName,
            patientRut: a.patientRut,
          },
          {
            beneficiaryName: b.beneficiaryName,
            beneficiaryRut: b.beneficiaryRut,
            eventCount: b._count.events,
            id: b.id,
            patientName: b.patientName,
            patientRut: b.patientRut,
          }
        )
      )[0]!;
      if (
        !params.patientRut ||
        canonical.patientRut === params.patientRut ||
        canonical.beneficiaryRut === params.patientRut ||
        canonical.patientRut === params.beneficiaryRut ||
        canonical.beneficiaryRut === params.beneficiaryRut ||
        isCloseNormalizedRut(canonical.patientRut, params.patientRut) ||
        isCloseNormalizedRut(canonical.beneficiaryRut, params.patientRut) ||
        isCloseNormalizedRut(canonical.patientRut, params.beneficiaryRut ?? null) ||
        isCloseNormalizedRut(canonical.beneficiaryRut, params.beneficiaryRut ?? null)
      ) {
        return canonical.id;
      }
    }
  }

  let rutMatchCandidate: null | {
    beneficiaryName: null | string;
    beneficiaryRut: null | string;
    eventCount: number;
    id: number;
    patientName: null | string;
    patientRut: null | string;
  } = null;

  if (params.patientRut) {
    // RUT uniquely identifies the patient — return oldest series for this rut+kind.
    const rutMatch = await db.clinicalSeries.findFirst({
      where: { kind: params.kind, patientRut: params.patientRut },
      orderBy: { id: "asc" },
      include: { events: eventSelect },
    });
    if (rutMatch) {
      rutMatchCandidate = {
        beneficiaryName: rutMatch.beneficiaryName,
        beneficiaryRut: rutMatch.beneficiaryRut,
        eventCount: rutMatch.events.length,
        id: rutMatch.id,
        patientName: rutMatch.patientName,
        patientRut: rutMatch.patientRut,
      };
      if (!params.patientName) return rutMatch.id;
    }
  }

  if (params.patientName) {
    // Exact name match within date window.
    const nameCandidates = await db.clinicalSeries.findMany({
      where: { kind: params.kind, patientName: params.patientName },
      include: { events: eventSelect },
      orderBy: { id: "asc" },
    });
    let best: null | { distance: number; id: number; score: number } = null;
    for (const c of nameCandidates) {
      const dates = c.events
        .map((e: (typeof c.events)[number]) => e.startDate ?? e.startDateTime ?? e.endDate ?? e.endDateTime)
        .filter((v: Date | null): v is Date => v instanceof Date)
        .map((v: Date) => dayjs(v).tz(TIMEZONE))
        .sort((a: dayjs.Dayjs, b: dayjs.Dayjs) => a.valueOf() - b.valueOf());
      const distance =
        dates.length === 0
          ? Infinity
          : (() => {
              const s = dates[0]!;
              const e = dates[dates.length - 1]!;
              return eventDateDjs.isBefore(s)
                ? s.diff(eventDateDjs, "day")
                : eventDateDjs.isAfter(e)
                  ? eventDateDjs.diff(e, "day")
                  : 0;
            })();
      if (distance > thresholdDays) continue;
      const score = scoreClinicalSeriesIdentityQuality({
        beneficiaryName: c.beneficiaryName,
        beneficiaryRut: c.beneficiaryRut,
        eventCount: c.events.length,
        patientName: c.patientName,
        patientRut: c.patientRut,
      });
      if (
        !best ||
        distance < best.distance ||
        (distance === best.distance &&
          (score > best.score || (score === best.score && c.id < best.id)))
      ) {
        best = { distance, id: c.id, score };
      }
    }

    const exactCandidate =
      best == null
        ? null
        : (() => {
            const candidate = nameCandidates.find((item) => item.id === best.id);
            return candidate
              ? {
                  beneficiaryName: candidate.beneficiaryName,
                  beneficiaryRut: candidate.beneficiaryRut,
                  eventCount: candidate.events.length,
                  id: candidate.id,
                  patientName: candidate.patientName,
                  patientRut: candidate.patientRut,
                }
              : null;
          })();
    const uniqueExactCandidate =
      nameCandidates.length === 0
        ? null
        : [...nameCandidates]
            .sort((a, b) =>
              compareSeriesCanonicalPriority(
                {
                  beneficiaryName: a.beneficiaryName,
                  beneficiaryRut: a.beneficiaryRut,
                  eventCount: a.events.length,
                  id: a.id,
                  patientName: a.patientName,
                  patientRut: a.patientRut,
                },
                {
                  beneficiaryName: b.beneficiaryName,
                  beneficiaryRut: b.beneficiaryRut,
                  eventCount: b.events.length,
                  id: b.id,
                  patientName: b.patientName,
                  patientRut: b.patientRut,
                }
              )
            )
            .map((candidate) => ({
              beneficiaryName: candidate.beneficiaryName,
              beneficiaryRut: candidate.beneficiaryRut,
              eventCount: candidate.events.length,
              id: candidate.id,
              patientName: candidate.patientName,
              patientRut: candidate.patientRut,
            }))[0]!;

    let phoneCandidate: null | {
      beneficiaryName: null | string;
      beneficiaryRut: null | string;
      eventCount: number;
      id: number;
      patientName: null | string;
      patientRut: null | string;
    } = null;
    let phoneCandidates: Array<{
      beneficiaryName: null | string;
      beneficiaryRut: null | string;
      events: Array<{
        description: null | string;
        endDate: Date | null;
        endDateTime: Date | null;
        startDate: Date | null;
        startDateTime: Date | null;
        summary: null | string;
      }>;
      id: number;
      patientName: null | string;
      patientPhones: unknown;
      patientRut: null | string;
    }> = [];

    if (params.patientPhones?.length) {
      phoneCandidates = await db.clinicalSeries.findMany({
        where: { kind: params.kind },
        include: {
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
      const matchingPhoneCandidates = phoneCandidates
        .filter((candidate) => {
          const storedPhones = getSeriesPatientPhones(candidate);
          return (
            candidate.patientName &&
            storedPhones.some((phone) => params.patientPhones?.includes(phone)) &&
            haveCompatiblePatientNames(candidate.patientName, params.patientName)
          );
        })
        .map((candidate) => ({
          candidate,
          score: scoreClinicalSeriesIdentityQuality({
            beneficiaryName: candidate.beneficiaryName,
            beneficiaryRut: candidate.beneficiaryRut,
            eventCount: candidate.events.length,
            patientName: candidate.patientName,
            patientRut: candidate.patientRut,
          }),
        }))
        .sort((left, right) => {
          const scoreDelta = right.score - left.score;
          if (scoreDelta !== 0) return scoreDelta;
          return left.candidate.id - right.candidate.id;
        });
      if (matchingPhoneCandidates[0]) {
        phoneCandidate = {
          beneficiaryName: matchingPhoneCandidates[0].candidate.beneficiaryName,
          beneficiaryRut: matchingPhoneCandidates[0].candidate.beneficiaryRut,
          eventCount: matchingPhoneCandidates[0].candidate.events.length,
          id: matchingPhoneCandidates[0].candidate.id,
          patientName: matchingPhoneCandidates[0].candidate.patientName,
          patientRut: matchingPhoneCandidates[0].candidate.patientRut,
        };
      }
    }

    const chosenCandidate = chooseBetterSeriesCandidate(
      rutMatchCandidate,
      exactCandidate,
      uniqueExactCandidate,
      phoneCandidate
    );
    if (chosenCandidate) {
      const canonicalPhoneDuplicate =
        params.patientPhones?.length && params.patientName
          ? chooseCanonicalPhoneDuplicateCandidate(
              {
                ...chosenCandidate,
                kind: params.kind,
                patientPhones: params.patientPhones,
              },
              [
                ...(nameCandidates ?? []).map((candidate) => ({
                  beneficiaryName: candidate.beneficiaryName,
                  beneficiaryRut: candidate.beneficiaryRut,
                  eventCount: candidate.events.length,
                  id: candidate.id,
                  kind: params.kind,
                  patientName: candidate.patientName,
                  patientPhones: getSeriesPatientPhones(candidate),
                  patientRut: candidate.patientRut,
                })),
                ...((params.patientPhones?.length ? phoneCandidates : []) ?? []).map(
                  (candidate) => ({
                    beneficiaryName: candidate.beneficiaryName,
                    beneficiaryRut: candidate.beneficiaryRut,
                    eventCount: candidate.events.length,
                    id: candidate.id,
                    kind: params.kind,
                    patientName: candidate.patientName,
                    patientPhones: getSeriesPatientPhones(candidate),
                    patientRut: candidate.patientRut,
                  })
                ),
              ]
            )
          : null;
      if (canonicalPhoneDuplicate) return canonicalPhoneDuplicate.id;
      if (shouldPreferCandidateOverRutMatch(rutMatchCandidate, chosenCandidate)) {
        return chosenCandidate.id;
      }
      return chosenCandidate.id;
    }

    // Token-overlap fallback.
    const eventTokens = getSignificantNameTokens(params.patientName);
    if (eventTokens.length >= 2) {
      const allSameKind = await db.clinicalSeries.findMany({
        where: { kind: params.kind },
        include: { events: eventSelect },
        orderBy: { id: "asc" },
      });
      let bestFuzzy: null | { distance: number; id: number; overlap: number; score: number } = null;
      for (const c of allSameKind) {
        if (!c.patientName) continue;
        const cTokens = getSignificantNameTokens(c.patientName);
        const overlap = eventTokens.filter((t) => cTokens.includes(t)).length;
        if (overlap < 2 || overlap / Math.min(eventTokens.length, cTokens.length) < 2 / 3) continue;
        const dates = c.events
          .map((e: (typeof c.events)[number]) => e.startDate ?? e.startDateTime ?? e.endDate ?? e.endDateTime)
          .filter((v: Date | null): v is Date => v instanceof Date)
          .map((v: Date) => dayjs(v).tz(TIMEZONE))
          .sort((a: dayjs.Dayjs, b: dayjs.Dayjs) => a.valueOf() - b.valueOf());
        const distance =
          dates.length === 0
            ? Infinity
            : (() => {
                const s = dates[0]!;
                const e = dates[dates.length - 1]!;
                return eventDateDjs.isBefore(s)
                  ? s.diff(eventDateDjs, "day")
                  : eventDateDjs.isAfter(e)
                    ? eventDateDjs.diff(e, "day")
                    : 0;
              })();
        if (distance > thresholdDays) continue;
        const score = scoreClinicalSeriesIdentityQuality({
          beneficiaryName: c.beneficiaryName,
          beneficiaryRut: c.beneficiaryRut,
          eventCount: c.events.length,
          patientName: c.patientName,
          patientRut: c.patientRut,
        });
        if (
          !bestFuzzy ||
          overlap > bestFuzzy.overlap ||
          (overlap === bestFuzzy.overlap &&
            (distance < bestFuzzy.distance ||
              (distance === bestFuzzy.distance &&
                (score > bestFuzzy.score || (score === bestFuzzy.score && c.id < bestFuzzy.id)))))
        ) {
          bestFuzzy = { distance, id: c.id, overlap, score };
        }
      }
      if (bestFuzzy) return bestFuzzy.id;
    }
  }

  if (rutMatchCandidate) return rutMatchCandidate.id;

  return null;
}

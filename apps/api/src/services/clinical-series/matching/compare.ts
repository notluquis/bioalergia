import { isLikelyPersonName, getSignificantNameTokens } from "../normalization/names.ts";
import { isCloseNormalizedRut } from "../normalization/rut.ts";
import type { ClinicalIdentity, ClinicalSeriesKind } from "../types.ts";

export function haveCompatiblePatientNames(a: null | string, b: null | string): boolean {
  if (!a || !b) return false;
  const leftTokens = getSignificantNameTokens(a);
  const rightTokens = getSignificantNameTokens(b);
  if (leftTokens.length < 2 || rightTokens.length < 2) return false;

  const overlap = leftTokens.filter((token) => rightTokens.includes(token)).length;
  if (overlap < 2) return false;

  return overlap / Math.min(leftTokens.length, rightTokens.length) >= 2 / 3;
}

export function scoreClinicalSeriesIdentityQuality(series: {
  beneficiaryName?: null | string;
  beneficiaryRut?: null | string;
  eventCount?: number;
  patientName?: null | string;
  patientRut?: null | string;
}): number {
  let score = 0;
  if (series.patientRut) score += 1_000;
  if (series.beneficiaryRut) score += 200;
  if (series.patientName && isLikelyPersonName(series.patientName)) score += 150;
  if (series.beneficiaryName && isLikelyPersonName(series.beneficiaryName)) score += 75;
  if (series.beneficiaryName && !isLikelyPersonName(series.beneficiaryName)) score -= 50;
  score += Math.min(series.eventCount ?? 0, 500);
  return score;
}

export function scoreRepresentativeIdentity(
  identity: ClinicalIdentity & { eventCount?: number }
): number {
  return scoreClinicalSeriesIdentityQuality(identity);
}

export function compareRepresentativeIdentity(
  a: ClinicalIdentity & { eventCount?: number },
  b: ClinicalIdentity & { eventCount?: number }
): number {
  const scoreDelta = scoreRepresentativeIdentity(b) - scoreRepresentativeIdentity(a);
  if (scoreDelta !== 0) return scoreDelta;
  const eventDelta = (b.eventCount ?? 0) - (a.eventCount ?? 0);
  if (eventDelta !== 0) return eventDelta;
  return (b.patientName ?? "").length - (a.patientName ?? "").length;
}

export function compareSeriesCanonicalPriority<
  T extends {
    beneficiaryName?: null | string;
    beneficiaryRut?: null | string;
    eventCount?: number;
    id: number;
    patientName?: null | string;
    patientRut?: null | string;
  },
>(a: T, b: T): number {
  const scoreDelta = scoreClinicalSeriesIdentityQuality(b) - scoreClinicalSeriesIdentityQuality(a);
  if (scoreDelta !== 0) return scoreDelta;
  const eventDelta = (b.eventCount ?? 0) - (a.eventCount ?? 0);
  if (eventDelta !== 0) return eventDelta;
  return a.id - b.id;
}

export function chooseBetterSeriesCandidate<
  T extends {
    beneficiaryName?: null | string;
    beneficiaryRut?: null | string;
    eventCount?: number;
    id: number;
    patientName?: null | string;
    patientRut?: null | string;
  },
>(...candidates: Array<null | T | undefined>): null | T {
  return (
    candidates
      .filter((candidate): candidate is T => candidate != null)
      .sort(compareSeriesCanonicalPriority)[0] ?? null
  );
}

export function chooseCanonicalPhoneDuplicateCandidate<
  T extends {
    beneficiaryName?: null | string;
    beneficiaryRut?: null | string;
    eventCount?: number;
    id: number;
    kind: ClinicalSeriesKind;
    patientName?: null | string;
    patientPhones?: string[];
    patientRut?: null | string;
  },
>(base: null | T | undefined, peers: Array<T>): null | T {
  if (!base?.patientName || !base.patientPhones?.length) return base ?? null;
  const basePatientName = base.patientName;

  return chooseBetterSeriesCandidate(
    base,
    ...peers.filter(
      (candidate) =>
        candidate.id !== base.id &&
        candidate.kind === base.kind &&
        !!candidate.patientName &&
        !!candidate.patientPhones?.some((phone) => base.patientPhones?.includes(phone)) &&
        haveCompatiblePatientNames(candidate.patientName, basePatientName)
    )
  );
}

export function shouldPreferCandidateOverRutMatch<
  T extends {
    beneficiaryName?: null | string;
    beneficiaryRut?: null | string;
    eventCount?: number;
    id: number;
    patientName?: null | string;
    patientRut?: null | string;
  },
>(rutMatch: null | T | undefined, preferred: null | T | undefined): boolean {
  if (!rutMatch || !preferred) return false;
  if (rutMatch === preferred) return false;
  if (compareSeriesCanonicalPriority(preferred, rutMatch) >= 0) return false;

  const preferredCrossMatchesRut =
    !!preferred.beneficiaryRut &&
    !!rutMatch.patientRut &&
    (preferred.beneficiaryRut === rutMatch.patientRut ||
      isCloseNormalizedRut(preferred.beneficiaryRut, rutMatch.patientRut));

  const rutMatchLooksWeaker =
    !!rutMatch.patientName &&
    !!preferred.patientName &&
    haveCompatiblePatientNames(rutMatch.patientName, preferred.patientName);

  return preferredCrossMatchesRut && rutMatchLooksWeaker;
}

export function hasConflictingPrimaryIdentity<
  T extends {
    beneficiaryRut?: null | string;
    patientRut?: null | string;
  },
>(a: T, b: T): boolean {
  if (!a.patientRut || !b.patientRut) return false;
  if (a.patientRut === b.patientRut) return false;
  if (isCloseNormalizedRut(a.patientRut, b.patientRut)) return false;
  if (
    a.beneficiaryRut &&
    (a.beneficiaryRut === b.patientRut || isCloseNormalizedRut(a.beneficiaryRut, b.patientRut))
  ) {
    return false;
  }
  if (
    b.beneficiaryRut &&
    (b.beneficiaryRut === a.patientRut || isCloseNormalizedRut(b.beneficiaryRut, a.patientRut))
  ) {
    return false;
  }
  return true;
}

export function hasHardPatientRutConflictForDuplicateDetection<
  T extends {
    beneficiaryRut?: null | string;
    patientRut?: null | string;
  },
>(a: T, b: T): boolean {
  if (!a.patientRut || !b.patientRut) return false;
  if (a.patientRut === b.patientRut) return false;
  if (isCloseNormalizedRut(a.patientRut, b.patientRut)) return false;

  const swappedPair =
    !!a.beneficiaryRut &&
    !!b.beneficiaryRut &&
    (a.patientRut === b.beneficiaryRut || isCloseNormalizedRut(a.patientRut, b.beneficiaryRut)) &&
    (b.patientRut === a.beneficiaryRut || isCloseNormalizedRut(b.patientRut, a.beneficiaryRut));

  return !swappedPair;
}

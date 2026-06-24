import {
  getSignificantNameTokens,
  isLikelyPersonName,
  normalizeName,
} from "../normalization/names.ts";
import type { IdentityNameCounts } from "../types.ts";

import { choosePreferredIdentityName } from "./group-key.ts";

export function incrementIdentityNameCount(counts: IdentityNameCounts, name: null | string): void {
  if (!name || !isLikelyPersonName(name)) return;
  const key = normalizeName(name);
  const current = counts.get(key);
  counts.set(key, {
    count: (current?.count ?? 0) + 1,
    name: choosePreferredIdentityName(current?.name ?? null, name) ?? name,
  });
}

export function isSingleLetterPrefixedVariant(contaminated: string, canonical: string): boolean {
  const contaminatedTokens = normalizeName(contaminated).split(" ").filter(Boolean);
  const canonicalTokens = normalizeName(canonical).split(" ").filter(Boolean);
  if (contaminatedTokens.length !== canonicalTokens.length) return false;

  let changedTokens = 0;
  for (let i = 0; i < contaminatedTokens.length; i += 1) {
    const contaminatedToken = contaminatedTokens[i];
    const canonicalToken = canonicalTokens[i];
    if (contaminatedToken === canonicalToken) continue;
    if (contaminatedToken.length !== canonicalToken.length + 1) return false;
    if (!contaminatedToken.endsWith(canonicalToken)) return false;
    changedTokens += 1;
  }

  return changedTokens === 1;
}

export function chooseDominantIdentityName(
  fallback: null | string,
  counts: IdentityNameCounts
): null | string {
  const candidates = [...counts.values()].sort((a, b) => {
    const countDelta = b.count - a.count;
    if (countDelta !== 0) return countDelta;
    const tokenDelta =
      getSignificantNameTokens(b.name).length - getSignificantNameTokens(a.name).length;
    if (tokenDelta !== 0) return tokenDelta;
    if (isSingleLetterPrefixedVariant(a.name, b.name)) return 1;
    if (isSingleLetterPrefixedVariant(b.name, a.name)) return -1;
    return b.name.length - a.name.length;
  });

  const dominant = candidates[0];
  if (!dominant) return fallback;

  return choosePreferredIdentityName(null, dominant.name);
}

export function isAllLowercase(name: string): boolean {
  return name === name.toLowerCase() && name !== name.toUpperCase();
}

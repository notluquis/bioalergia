import { normalizeRut } from "../../../lib/rut.ts";

/**
 * Range-filtered RUT sanitizer. Returns the original raw RUT string
 * (NOT the canonical form) if it parses and the body falls in the
 * plausible-person range (1M ≤ body < 50M). This intentionally
 * differs from `lib/rut.ts:normalizeRut` which returns the canonical
 * form — call sites here compare the returned string with the
 * untouched input for downstream display + matching, so changing the
 * shape would silently break them.
 */
export function sanitizeRut(rut: null | string): null | string {
  if (!rut) return null;
  const body = Number(normalizeRut(rut)?.split("-")[0]);
  return body >= 1_000_000 && body < 50_000_000 ? rut : null;
}

/**
 * True if two RUTs differ by at most 1 character after canonicalization
 * (typo tolerance for matching). Returns false when either side
 * doesn't normalize at all.
 */
export function isCloseNormalizedRut(a: null | string, b: null | string): boolean {
  if (!a || !b) return false;
  const left = normalizeRut(a);
  const right = normalizeRut(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length !== right.length) return false;

  let differences = 0;
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) differences++;
    if (differences > 1) return false;
  }
  return differences === 1;
}

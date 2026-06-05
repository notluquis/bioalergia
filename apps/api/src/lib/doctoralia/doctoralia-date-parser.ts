import { buildChileDate } from "../time.ts";

// Doctoralia's calendar API emits naive ISO strings like "2026-05-23T15:15:00"
// that represent Chile local time. Parsing these with `new Date()` on a Node
// process whose timezone is not Chile (e.g. Railway, which runs UTC) shifts the
// stored value by the UTC offset, which is exactly the bug this helper fixes.
// Strings that already carry a zone designator (Z, +HH:MM, -HHMM) are trusted
// and parsed normally.
const HAS_TIMEZONE = /(Z|[+-]\d{2}:?\d{2})$/;
const NAIVE_DATETIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/;

export function parseDoctoraliaDateTime(input: string): Date;
export function parseDoctoraliaDateTime(input: null | undefined): null;
export function parseDoctoraliaDateTime(input: null | string | undefined): Date | null;
export function parseDoctoraliaDateTime(input: null | string | undefined): Date | null {
  if (!input) return null;
  if (HAS_TIMEZONE.test(input)) {
    const parsed = new Date(input);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const m = input.match(NAIVE_DATETIME);
  if (!m) return null;
  try {
    // buildChileDate: month is 0-indexed (JS Date convention).
    const d = buildChileDate(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], m[6] ? +m[6] : 0);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);

const DOCTORALIA_TZ = "America/Santiago";

// Doctoralia's calendar API emits naive ISO strings like "2026-05-23T15:15:00"
// that represent Chile local time. Parsing these with `new Date()` on a Node
// process whose timezone is not Chile (e.g. Railway, which runs UTC) shifts the
// stored value by the UTC offset, which is exactly the bug this helper fixes.
// Strings that already carry a zone designator (Z, +HH:MM, -HHMM) are trusted
// and parsed normally.
const HAS_TIMEZONE = /(Z|[+-]\d{2}:?\d{2})$/;

export function parseDoctoraliaDateTime(input: string): Date;
export function parseDoctoraliaDateTime(input: null | undefined): null;
export function parseDoctoraliaDateTime(input: null | string | undefined): Date | null;
export function parseDoctoraliaDateTime(input: null | string | undefined): Date | null {
  if (!input) return null;
  if (HAS_TIMEZONE.test(input)) {
    const parsed = new Date(input);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  try {
    const parsed = dayjs.tz(input, DOCTORALIA_TZ);
    if (!parsed.isValid()) return null;
    return parsed.toDate();
  } catch {
    return null;
  }
}

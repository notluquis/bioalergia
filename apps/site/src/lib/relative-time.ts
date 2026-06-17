// Relative-time formatting ladder, extracted from
// features/shop/components/Reviews.tsx so it is unit-testable without a React
// renderer. Behavior is byte-identical to the original inline `formatRelative`,
// except the reference instant is injectable (`now`, default `Date.now()`) so
// tests are deterministic; the component call stays `formatRelative(date)`.

const RELATIVE = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

/**
 * Formats `date` relative to `now` using a fixed second/minute/hour/day/month/
 * year ladder. Past dates yield negative units ("hace …"), future dates yield
 * positive units ("dentro de …"), via `Intl.RelativeTimeFormat`.
 *
 * @param date  The instant to describe (Date or ISO string).
 * @param now   Reference instant in epoch ms; defaults to `Date.now()`.
 */
export function formatRelative(date: Date | string, now: number = Date.now()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffSec = Math.round((d.getTime() - now) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return RELATIVE.format(Math.round(diffSec), "second");
  if (abs < 3600) return RELATIVE.format(Math.round(diffSec / 60), "minute");
  if (abs < 86_400) return RELATIVE.format(Math.round(diffSec / 3600), "hour");
  if (abs < 2_592_000) return RELATIVE.format(Math.round(diffSec / 86_400), "day");
  if (abs < 31_536_000) return RELATIVE.format(Math.round(diffSec / 2_592_000), "month");
  return RELATIVE.format(Math.round(diffSec / 31_536_000), "year");
}

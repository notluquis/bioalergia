import { describe, expect, it } from "vitest";

import { parseDoctoraliaDateTime } from "../doctoralia-date-parser";

describe("parseDoctoraliaDateTime", () => {
  it("treats naive ISO strings as Chile local time", () => {
    // Chile is UTC-4 in April 2026 (standard time, post-abolition of DST).
    // 15:15 in Chile === 19:15 UTC.
    const parsed = parseDoctoraliaDateTime("2026-05-23T15:15:00");
    expect(parsed).not.toBeNull();
    expect(parsed?.toISOString()).toBe("2026-05-23T19:15:00.000Z");
  });

  it("respects explicit Z suffix", () => {
    const parsed = parseDoctoraliaDateTime("2026-05-23T15:15:00Z");
    expect(parsed?.toISOString()).toBe("2026-05-23T15:15:00.000Z");
  });

  it("respects explicit positive offset", () => {
    const parsed = parseDoctoraliaDateTime("2026-05-23T15:15:00+02:00");
    expect(parsed?.toISOString()).toBe("2026-05-23T13:15:00.000Z");
  });

  it("respects explicit negative offset", () => {
    const parsed = parseDoctoraliaDateTime("2026-05-23T15:15:00-03:00");
    expect(parsed?.toISOString()).toBe("2026-05-23T18:15:00.000Z");
  });

  it("returns null for null/undefined/empty input", () => {
    expect(parseDoctoraliaDateTime(null)).toBeNull();
    expect(parseDoctoraliaDateTime(undefined)).toBeNull();
    expect(parseDoctoraliaDateTime("")).toBeNull();
  });

  it("returns null for invalid input", () => {
    expect(parseDoctoraliaDateTime("not a date")).toBeNull();
  });
});

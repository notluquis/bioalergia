import { afterEach, describe, expect, it, vi } from "vitest";

import { formatRelative } from "./relative-time";

// Build an expected string the same way the implementation does, so tests
// assert the ladder/branch selection rather than locale string spelling.
const RTF = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Reference instant: 2026-01-01T00:00:00.000Z.
const NOW = Date.UTC(2026, 0, 1);

afterEach(() => {
  vi.useRealTimers();
});

describe("formatRelative", () => {
  it("formats seconds in the past", () => {
    const d = new Date(NOW - 10 * SECOND);
    expect(formatRelative(d, NOW)).toBe(RTF.format(-10, "second"));
  });

  it("formats seconds in the future", () => {
    const d = new Date(NOW + 30 * SECOND);
    expect(formatRelative(d, NOW)).toBe(RTF.format(30, "second"));
  });

  it("formats minutes", () => {
    const d = new Date(NOW - 5 * MINUTE);
    expect(formatRelative(d, NOW)).toBe(RTF.format(-5, "minute"));
  });

  it("formats hours", () => {
    const d = new Date(NOW - 3 * HOUR);
    expect(formatRelative(d, NOW)).toBe(RTF.format(-3, "hour"));
  });

  it("formats days", () => {
    const d = new Date(NOW - 2 * DAY);
    expect(formatRelative(d, NOW)).toBe(RTF.format(-2, "day"));
  });

  it("formats months (using the 30-day month constant)", () => {
    const d = new Date(NOW - 60 * DAY);
    expect(formatRelative(d, NOW)).toBe(RTF.format(-2, "month"));
  });

  it("formats years (using the 365-day year constant)", () => {
    const d = new Date(NOW - 2 * 365 * DAY);
    expect(formatRelative(d, NOW)).toBe(RTF.format(-2, "year"));
  });

  it("formats years in the future", () => {
    const d = new Date(NOW + 365 * DAY);
    expect(formatRelative(d, NOW)).toBe(RTF.format(1, "year"));
  });

  it("accepts an ISO string and parses it", () => {
    const iso = new Date(NOW - 1 * HOUR).toISOString();
    expect(formatRelative(iso, NOW)).toBe(RTF.format(-1, "hour"));
  });

  it("defaults `now` to Date.now() when omitted", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const d = new Date(NOW - 1 * MINUTE);
    expect(formatRelative(d)).toBe(RTF.format(-1, "minute"));
  });
});

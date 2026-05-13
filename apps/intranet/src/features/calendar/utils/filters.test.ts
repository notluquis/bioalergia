import dayjs from "dayjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CalendarFilters } from "../types";
import {
  arraysEqual,
  computeDefaultFilters,
  filtersEqual,
  getScheduleDefaultRange,
  normalizeFilters,
  unique,
} from "./filters";

function makeFilters(overrides: Partial<CalendarFilters> = {}): CalendarFilters {
  return {
    calendarIds: [],
    categories: [],
    from: "2026-01-01",
    maxDays: 28,
    search: "",
    to: "2026-01-31",
    ...overrides,
  };
}

// ─── unique ────────────────────────────────────────────────────────────────────

describe("unique", () => {
  it("removes duplicate values", () => {
    expect(unique(["a", "b", "a"])).toStrictEqual(["a", "b"]);
  });

  it("returns sorted results", () => {
    expect(unique(["c", "a", "b"])).toStrictEqual(["a", "b", "c"]);
  });

  it("returns empty array for empty input", () => {
    expect(unique([])).toStrictEqual([]);
  });

  it("handles single element", () => {
    expect(unique(["x"])).toStrictEqual(["x"]);
  });
});

// ─── arraysEqual ──────────────────────────────────────────────────────────────

describe("arraysEqual", () => {
  it("returns true for identical arrays", () => {
    expect(arraysEqual(["a", "b"], ["a", "b"])).toBe(true);
  });

  it("returns false for different lengths", () => {
    expect(arraysEqual(["a"], ["a", "b"])).toBe(false);
  });

  it("returns false for same length different values", () => {
    expect(arraysEqual(["a", "b"], ["a", "c"])).toBe(false);
  });

  it("returns true for empty arrays", () => {
    expect(arraysEqual([], [])).toBe(true);
  });

  it("is order-sensitive", () => {
    expect(arraysEqual(["b", "a"], ["a", "b"])).toBe(false);
  });
});

// ─── filtersEqual ─────────────────────────────────────────────────────────────

describe("filtersEqual", () => {
  it("returns true for identical filters", () => {
    const f = makeFilters({ categories: ["A"], calendarIds: ["cal1"] });
    expect(filtersEqual(f, { ...f })).toBe(true);
  });

  it("returns false when from differs", () => {
    const a = makeFilters({ from: "2026-01-01" });
    const b = makeFilters({ from: "2026-01-02" });
    expect(filtersEqual(a, b)).toBe(false);
  });

  it("returns false when to differs", () => {
    const a = makeFilters({ to: "2026-01-31" });
    const b = makeFilters({ to: "2026-02-28" });
    expect(filtersEqual(a, b)).toBe(false);
  });

  it("treats null and undefined beneficiaryRut as equal", () => {
    const a = makeFilters({ beneficiaryRut: undefined });
    const b = makeFilters({ beneficiaryRut: undefined });
    expect(filtersEqual(a, b)).toBe(true);
  });

  it("is insensitive to category order (both get sorted)", () => {
    const a = makeFilters({ categories: ["Z", "A"] });
    const b = makeFilters({ categories: ["A", "Z"] });
    expect(filtersEqual(a, b)).toBe(true);
  });

  it("returns false when maxDays differs", () => {
    const a = makeFilters({ maxDays: 14 });
    const b = makeFilters({ maxDays: 28 });
    expect(filtersEqual(a, b)).toBe(false);
  });

  it("trims search before comparing", () => {
    const a = makeFilters({ search: "  foo  " });
    const b = makeFilters({ search: "foo" });
    expect(filtersEqual(a, b)).toBe(true);
  });

  it("treats undefined clinicalSeriesId as null for comparison", () => {
    const a = makeFilters({ clinicalSeriesId: undefined });
    const b = makeFilters({ clinicalSeriesId: undefined });
    expect(filtersEqual(a, b)).toBe(true);
  });
});

// ─── normalizeFilters ─────────────────────────────────────────────────────────

describe("normalizeFilters", () => {
  it("deduplicates and sorts calendarIds", () => {
    const result = normalizeFilters(makeFilters({ calendarIds: ["b", "a", "b"] }));
    expect(result.calendarIds).toStrictEqual(["a", "b"]);
  });

  it("deduplicates and sorts categories", () => {
    const result = normalizeFilters(makeFilters({ categories: ["Z", "A", "Z"] }));
    expect(result.categories).toStrictEqual(["A", "Z"]);
  });

  it("trims patientName", () => {
    const result = normalizeFilters(makeFilters({ patientName: "  Juan  " }));
    expect(result.patientName).toBe("Juan");
  });

  it("trims beneficiaryRut", () => {
    const result = normalizeFilters(makeFilters({ beneficiaryRut: " 12345678-9 " }));
    expect(result.beneficiaryRut).toBe("12345678-9");
  });

  it("trims search", () => {
    const result = normalizeFilters(makeFilters({ search: "  test  " }));
    expect(result.search).toBe("test");
  });

  it("sets empty calendarIds from undefined", () => {
    const result = normalizeFilters(makeFilters({ calendarIds: undefined }));
    expect(result.calendarIds).toStrictEqual([]);
  });

  it("uses '' fallback when search is undefined (line 48 ?? branch)", () => {
    const result = normalizeFilters(makeFilters({ search: undefined as unknown as string }));
    expect(result.search).toBe("");
  });
});

// ─── computeDefaultFilters ────────────────────────────────────────────────────

describe("computeDefaultFilters", () => {
  it("returns CalendarFilters with required shape", () => {
    const result = computeDefaultFilters({});
    expect(result).toHaveProperty("from");
    expect(result).toHaveProperty("to");
    expect(result).toHaveProperty("maxDays");
    expect(result).toHaveProperty("categories");
    expect(result).toHaveProperty("calendarIds");
    expect(result).toHaveProperty("search");
  });

  it("caps lookahead at 1095 days", () => {
    const result = computeDefaultFilters({ calendarSyncLookaheadDays: "99999" });
    const to = dayjs(result.to);
    const from = dayjs(result.from);
    const span = to.diff(from, "day");
    expect(span).toBeLessThanOrEqual(1095 + 1);
  });

  it("defaults lookahead to 365 when invalid", () => {
    const result = computeDefaultFilters({ calendarSyncLookaheadDays: "abc" });
    expect(result.maxDays).toBeGreaterThan(0);
  });

  it("caps maxDays at 365", () => {
    const result = computeDefaultFilters({ calendarDailyMaxDays: "99999" });
    expect(result.maxDays).toBeLessThanOrEqual(365);
  });

  it("defaults maxDays to 28 when invalid", () => {
    const result = computeDefaultFilters({ calendarDailyMaxDays: "bad" });
    expect(result.maxDays).toBeGreaterThan(0);
  });

  it("uses syncStart date when it's after default from", () => {
    const farFuture = dayjs().add(10, "year").format("YYYY-MM-DD");
    // syncStart in far future means from moves forward
    const result = computeDefaultFilters({ calendarSyncStart: farFuture });
    expect(result.from).toBe(farFuture);
  });

  it("ignores syncStart when it predates default from", () => {
    const longAgo = "1990-01-01";
    const result = computeDefaultFilters({ calendarSyncStart: longAgo });
    // default from is ±2 weeks from today, so 1990 won't override it
    expect(result.from).not.toBe(longAgo);
  });

  it("clamps `to` to maxForward when lookahead is shorter than default 2 weeks (line 72/325 branch)", () => {
    // lookahead=7 days → maxForward = today+7 days; defaultTo = today+14 days
    // defaultTo.isAfter(maxForward) → toCandidate = maxForward
    const result = computeDefaultFilters({ calendarSyncLookaheadDays: "7" });
    const to = dayjs(result.to);
    const expected = dayjs().add(7, "day");
    // Within 1 day tolerance to absorb timezone/midnight rollover
    expect(Math.abs(to.diff(expected, "day"))).toBeLessThanOrEqual(1);
  });
});

// ─── getScheduleDefaultRange ──────────────────────────────────────────────────

describe("getScheduleDefaultRange", () => {
  it("returns from and to strings in YYYY-MM-DD format", () => {
    const { from, to } = getScheduleDefaultRange();
    expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("to is 5 days after from", () => {
    const { from, to } = getScheduleDefaultRange();
    const diff = dayjs(to).diff(dayjs(from), "day");
    expect(diff).toBe(5);
  });

  describe("Sunday handling (line 88 branch)", () => {
    afterEach(() => {
      vi.useRealTimers();
    });
    it("jumps to next Monday when today is Sunday", () => {
      // 2026-05-17 is a Sunday
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-05-17T12:00:00Z"));
      const { from, to } = getScheduleDefaultRange();
      // Monday after Sunday 2026-05-17 is 2026-05-18
      expect(from).toBe("2026-05-18");
      expect(to).toBe("2026-05-23");
    });
  });
});

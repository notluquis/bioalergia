import { describe, expect, it } from "vitest";
import type { TimesheetEntryWithEmployee } from "../types";
import {
  calculateDurationHours,
  detectAllOverlaps,
  detectOverlapsForDate,
  formatDuration,
  getOverlappingEmployeesForDate,
  isTimeRangeOverlapping,
} from "./overlap-detection";

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeEntry(
  overrides: Partial<TimesheetEntryWithEmployee> & {
    employee_id: number;
    start_time: string;
    end_time: string;
  }
): TimesheetEntryWithEmployee {
  return {
    comment: null,
    employee_name: `Employee ${overrides.employee_id}`,
    employee_role: null,
    id: overrides.employee_id,
    overtime_minutes: 0,
    work_date: "2026-01-10",
    worked_minutes: 480,
    ...overrides,
  };
}

// ─── calculateDurationHours ───────────────────────────────────────────────────

describe("calculateDurationHours", () => {
  it("calculates a full 8-hour shift", () => {
    expect(calculateDurationHours("08:00", "16:00")).toBe(8);
  });

  it("calculates a 30-minute duration", () => {
    expect(calculateDurationHours("09:00", "09:30")).toBeCloseTo(0.5);
  });

  it("calculates zero duration for same start and end", () => {
    expect(calculateDurationHours("10:00", "10:00")).toBe(0);
  });

  it("calculates a 4.5-hour shift", () => {
    expect(calculateDurationHours("08:00", "12:30")).toBe(4.5);
  });

  it("handles 1-minute duration", () => {
    expect(calculateDurationHours("09:00", "09:01")).toBeCloseTo(1 / 60);
  });
});

// ─── formatDuration ───────────────────────────────────────────────────────────

describe("formatDuration", () => {
  it("formats whole hours without minutes", () => {
    expect(formatDuration(8)).toBe("8h");
  });

  it("formats hours and minutes", () => {
    expect(formatDuration(8.5)).toBe("8h 30m");
  });

  it("formats zero hours", () => {
    expect(formatDuration(0)).toBe("0h");
  });

  it("formats fractional hours with rounding", () => {
    expect(formatDuration(1.25)).toBe("1h 15m");
  });

  it("formats sub-hour durations", () => {
    expect(formatDuration(0.5)).toBe("0h 30m");
  });
});

// ─── isTimeRangeOverlapping ───────────────────────────────────────────────────

describe("isTimeRangeOverlapping", () => {
  it("returns true for clearly overlapping ranges", () => {
    expect(isTimeRangeOverlapping("08:00", "12:00", "10:00", "14:00")).toBe(true);
  });

  it("returns false for non-overlapping ranges (A then B)", () => {
    expect(isTimeRangeOverlapping("08:00", "10:00", "10:00", "12:00")).toBe(false);
  });

  it("returns false for non-overlapping ranges (B then A)", () => {
    expect(isTimeRangeOverlapping("10:00", "12:00", "08:00", "10:00")).toBe(false);
  });

  it("returns false for completely separate ranges", () => {
    expect(isTimeRangeOverlapping("08:00", "09:00", "10:00", "11:00")).toBe(false);
  });

  it("returns true when range A completely contains range B", () => {
    expect(isTimeRangeOverlapping("08:00", "18:00", "10:00", "12:00")).toBe(true);
  });

  it("returns true when ranges share same start time", () => {
    expect(isTimeRangeOverlapping("08:00", "16:00", "08:00", "12:00")).toBe(true);
  });

  it("returns true when ranges share same end time", () => {
    expect(isTimeRangeOverlapping("08:00", "16:00", "12:00", "16:00")).toBe(true);
  });

  it("returns true for identical ranges", () => {
    expect(isTimeRangeOverlapping("09:00", "17:00", "09:00", "17:00")).toBe(true);
  });
});

// ─── detectOverlapsForDate ────────────────────────────────────────────────────

describe("detectOverlapsForDate", () => {
  it("returns empty array when no entries match the date", () => {
    const entries = [makeEntry({ employee_id: 1, start_time: "08:00", end_time: "16:00" })];
    expect(detectOverlapsForDate(entries, "2026-12-31")).toStrictEqual([]);
  });

  it("returns empty array when entries do not overlap", () => {
    const entries = [
      makeEntry({ employee_id: 1, start_time: "08:00", end_time: "12:00" }),
      makeEntry({ employee_id: 2, start_time: "12:00", end_time: "16:00" }),
    ];
    expect(detectOverlapsForDate(entries, "2026-01-10")).toStrictEqual([]);
  });

  it("detects a pair of overlapping entries", () => {
    const entries = [
      makeEntry({ employee_id: 1, start_time: "08:00", end_time: "14:00" }),
      makeEntry({ employee_id: 2, start_time: "10:00", end_time: "16:00" }),
    ];
    const overlaps = detectOverlapsForDate(entries, "2026-01-10");
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0]?.pair).toStrictEqual([1, 2]);
  });

  it("does NOT flag nurse + TENS overlap as conflicting (compatible roles)", () => {
    const entries = [
      makeEntry({
        employee_id: 1,
        start_time: "08:00",
        end_time: "16:00",
        employee_role: "Enfermera Universitaria",
      }),
      makeEntry({
        employee_id: 2,
        start_time: "08:00",
        end_time: "16:00",
        employee_role: "TENS",
      }),
    ];
    const overlaps = detectOverlapsForDate(entries, "2026-01-10");
    expect(overlaps).toHaveLength(0);
  });

  it("flags two TENS as conflicting when overlapping", () => {
    const entries = [
      makeEntry({
        employee_id: 1,
        start_time: "08:00",
        end_time: "16:00",
        employee_role: "TENS",
      }),
      makeEntry({
        employee_id: 2,
        start_time: "08:00",
        end_time: "16:00",
        employee_role: "TENS",
      }),
    ];
    const overlaps = detectOverlapsForDate(entries, "2026-01-10");
    expect(overlaps).toHaveLength(1);
  });

  it("includes employee names in overlap result", () => {
    const entries = [
      makeEntry({ employee_id: 1, start_time: "08:00", end_time: "14:00", employee_name: "Ana" }),
      makeEntry({ employee_id: 2, start_time: "10:00", end_time: "16:00", employee_name: "Luis" }),
    ];
    const overlaps = detectOverlapsForDate(entries, "2026-01-10");
    expect(overlaps[0]?.names).toStrictEqual(["Ana", "Luis"]);
  });
});

// ─── getOverlappingEmployeesForDate ───────────────────────────────────────────

describe("getOverlappingEmployeesForDate", () => {
  it("returns empty array when no overlaps", () => {
    const entries = [
      makeEntry({ employee_id: 1, start_time: "08:00", end_time: "12:00" }),
      makeEntry({ employee_id: 2, start_time: "12:00", end_time: "16:00" }),
    ];
    expect(getOverlappingEmployeesForDate(entries, "2026-01-10")).toStrictEqual([]);
  });

  it("returns both employee IDs when they overlap", () => {
    const entries = [
      makeEntry({ employee_id: 1, start_time: "08:00", end_time: "14:00" }),
      makeEntry({ employee_id: 2, start_time: "10:00", end_time: "16:00" }),
    ];
    const ids = getOverlappingEmployeesForDate(entries, "2026-01-10");
    expect(ids).toContain(1);
    expect(ids).toContain(2);
  });

  it("does not double-count an employee involved in multiple overlaps", () => {
    const entries = [
      makeEntry({ employee_id: 1, start_time: "08:00", end_time: "16:00" }),
      makeEntry({ employee_id: 2, start_time: "09:00", end_time: "12:00" }),
      makeEntry({ employee_id: 3, start_time: "11:00", end_time: "15:00" }),
    ];
    const ids = getOverlappingEmployeesForDate(entries, "2026-01-10");
    // Should not repeat employee 1
    expect(ids.filter((id) => id === 1)).toHaveLength(1);
  });
});

// ─── detectAllOverlaps ────────────────────────────────────────────────────────

describe("detectAllOverlaps", () => {
  it("returns empty map when no overlaps exist", () => {
    const entries = [
      makeEntry({ employee_id: 1, start_time: "08:00", end_time: "12:00" }),
      makeEntry({ employee_id: 2, start_time: "12:00", end_time: "16:00" }),
    ];
    expect(detectAllOverlaps(entries).size).toBe(0);
  });

  it("creates a map entry for a date with overlaps", () => {
    const entries = [
      makeEntry({ employee_id: 1, start_time: "08:00", end_time: "14:00" }),
      makeEntry({ employee_id: 2, start_time: "10:00", end_time: "16:00" }),
    ];
    const result = detectAllOverlaps(entries);
    expect(result.has("2026-01-10")).toBe(true);
  });

  it("OverlapInfo has correct work_date", () => {
    const entries = [
      makeEntry({ employee_id: 1, start_time: "08:00", end_time: "14:00" }),
      makeEntry({ employee_id: 2, start_time: "10:00", end_time: "16:00" }),
    ];
    const info = detectAllOverlaps(entries).get("2026-01-10");
    expect(info?.work_date).toBe("2026-01-10");
  });

  it("groups overlaps by date correctly", () => {
    const entries = [
      makeEntry({
        employee_id: 1,
        start_time: "08:00",
        end_time: "14:00",
        work_date: "2026-01-10",
      }),
      makeEntry({
        employee_id: 2,
        start_time: "10:00",
        end_time: "16:00",
        work_date: "2026-01-10",
      }),
      makeEntry({
        employee_id: 3,
        start_time: "08:00",
        end_time: "16:00",
        work_date: "2026-01-11",
      }),
      makeEntry({
        employee_id: 4,
        start_time: "09:00",
        end_time: "17:00",
        work_date: "2026-01-11",
      }),
    ];
    const result = detectAllOverlaps(entries);
    expect(result.has("2026-01-10")).toBe(true);
    expect(result.has("2026-01-11")).toBe(true);
  });

  it("counts overlapping pairs correctly", () => {
    const entries = [
      makeEntry({ employee_id: 1, start_time: "08:00", end_time: "14:00" }),
      makeEntry({ employee_id: 2, start_time: "10:00", end_time: "16:00" }),
    ];
    const info = detectAllOverlaps(entries).get("2026-01-10");
    expect(info?.total_overlapping_pairs).toBe(1);
  });
});

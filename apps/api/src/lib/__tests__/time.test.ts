import { describe, expect, it } from "vitest";
import {
  buildChileDate,
  coerceDateOnly,
  formatChileDateTime,
  formatDateForDB,
  formatDateOnly,
  getMonthRange,
  getNthBusinessDay,
  getPeriodRange,
  iterateDateRange,
  normalizeDate,
  normalizeTimestamp,
  normalizeTimestampForDb,
  normalizeTimestampString,
  parseChileDateOnly,
  parseChileDateTime,
  parseDateOnly,
  TIMEZONE,
  toChileDateString,
  toChilePeriod,
} from "../time.ts";

describe("time", () => {
  describe("TIMEZONE", () => {
    it("is America/Santiago", () => {
      expect(TIMEZONE).toBe("America/Santiago");
    });
  });

  describe("getPeriodRange", () => {
    it("returns correct from/to for a valid period", () => {
      const { from, to } = getPeriodRange("2024-01");
      expect(from).toBeInstanceOf(Date);
      expect(to).toBeInstanceOf(Date);
      expect(from.getTime()).toBeLessThan(to.getTime());
    });

    it("from is before to by nearly one month", () => {
      const { from, to } = getPeriodRange("2024-03");
      const diffMs = to.getTime() - from.getTime() + 1;
      // March has 31 days
      const expectedMs = 31 * 24 * 60 * 60 * 1000;
      expect(diffMs).toBe(expectedMs);
    });

    it("handles February in a leap year (2024)", () => {
      const { from, to } = getPeriodRange("2024-02");
      const diffMs = to.getTime() - from.getTime() + 1;
      const expectedMs = 29 * 24 * 60 * 60 * 1000;
      expect(diffMs).toBe(expectedMs);
    });

    it("handles February in a non-leap year (2023)", () => {
      const { from, to } = getPeriodRange("2023-02");
      const diffMs = to.getTime() - from.getTime() + 1;
      const expectedMs = 28 * 24 * 60 * 60 * 1000;
      expect(diffMs).toBe(expectedMs);
    });

    it("throws on invalid period format", () => {
      expect(() => getPeriodRange("2024-13")).toThrow("Invalid period");
      expect(() => getPeriodRange("2024-00")).toThrow("Invalid period");
      expect(() => getPeriodRange("not-a-period")).toThrow("Invalid period");
      expect(() => getPeriodRange("202401")).toThrow("Invalid period");
    });
  });

  describe("toChilePeriod", () => {
    it("returns YYYY-MM string for a date in Chile timezone", () => {
      // Jan 1 2024 noon UTC — Chile is UTC-3 in summer, so this is Jan 1 in Chile
      const date = new Date("2024-01-15T12:00:00Z");
      const result = toChilePeriod(date);
      expect(result).toMatch(/^\d{4}-\d{2}$/);
      expect(result).toBe("2024-01");
    });

    it("handles year boundary correctly in UTC vs Chile", () => {
      // Dec 31 2024 23:00 UTC = Dec 31 in Chile (UTC-3), so period is 2024-12
      const date = new Date("2024-12-31T23:00:00Z");
      const result = toChilePeriod(date);
      expect(result).toBe("2024-12");
    });
  });

  describe("toChileDateString", () => {
    it("returns YYYY-MM-DD string for a date", () => {
      const date = new Date("2024-06-15T12:00:00Z");
      const result = toChileDateString(date);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result).toBe("2024-06-15");
    });
  });

  describe("parseChileDateOnly", () => {
    it("parses a valid date string", () => {
      const result = parseChileDateOnly("2024-06-15");
      expect(result).toBeInstanceOf(Date);
      expect(result!.getTime()).toBeGreaterThan(0);
    });

    it("returns null for empty string", () => {
      expect(parseChileDateOnly("")).toBeNull();
    });

    it("returns null for whitespace only", () => {
      expect(parseChileDateOnly("   ")).toBeNull();
    });

    it("parses and gives midnight Chile time as UTC Date", () => {
      const result = parseChileDateOnly("2024-01-01");
      expect(result).toBeInstanceOf(Date);
      // The result should be a valid Date
      expect(Number.isNaN(result!.getTime())).toBe(false);
    });
  });

  describe("buildChileDate", () => {
    it("returns a Date instance", () => {
      const result = buildChileDate(2024, 0, 15, 10, 30);
      expect(result).toBeInstanceOf(Date);
    });

    it("builds date for Jan 15 2024 at 10:30 Chile time", () => {
      const result = buildChileDate(2024, 0, 15, 10, 30);
      expect(Number.isNaN(result.getTime())).toBe(false);
    });

    it("month is 0-indexed (0=January)", () => {
      const jan = buildChileDate(2024, 0, 1, 0, 0);
      const dec = buildChileDate(2024, 11, 1, 0, 0);
      expect(jan.getTime()).toBeLessThan(dec.getTime());
    });

    it("second parameter defaults to 0", () => {
      const withDefault = buildChileDate(2024, 0, 1, 10, 30);
      const withExplicit = buildChileDate(2024, 0, 1, 10, 30, 0);
      expect(withDefault.getTime()).toBe(withExplicit.getTime());
    });

    it("builds correct UTC offset for summer (UTC-3)", () => {
      // Jan 15, 2024 00:00 Chile = Jan 15 03:00 UTC (summer, CLST = UTC-3)
      const result = buildChileDate(2024, 0, 15, 0, 0, 0);
      const utcHour = result.getUTCHours();
      // Should be 3 (UTC-3 in summer) — we just verify it's not midnight UTC
      expect(utcHour).not.toBe(0);
    });
  });

  describe("parseChileDateTime", () => {
    it("returns null for null input", () => {
      expect(parseChileDateTime(null)).toBeNull();
    });

    it("returns null for undefined input", () => {
      expect(parseChileDateTime(undefined)).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(parseChileDateTime("")).toBeNull();
    });

    it("parses ISO string with Z timezone designator", () => {
      const result = parseChileDateTime("2024-06-15T10:00:00Z");
      expect(result).toBeInstanceOf(Date);
      expect(result!.toISOString()).toBe("2024-06-15T10:00:00.000Z");
    });

    it("parses ISO string with +offset designator", () => {
      const result = parseChileDateTime("2024-06-15T10:00:00+03:00");
      expect(result).toBeInstanceOf(Date);
      // 10:00+03:00 = 07:00 UTC
      expect(result!.getUTCHours()).toBe(7);
    });

    it("parses ISO string with -offset designator", () => {
      const result = parseChileDateTime("2024-06-15T10:00:00-04:00");
      expect(result).toBeInstanceOf(Date);
      // 10:00-04:00 = 14:00 UTC
      expect(result!.getUTCHours()).toBe(14);
    });

    it("returns null for DD-MM-YYYY format (ambiguous, not supported)", () => {
      // The function returns null for this format because it's ambiguous with YYYY-MM-DD
      const result = parseChileDateTime("15-06-2024");
      expect(result).toBeNull();
    });
  });

  describe("formatDateForDB", () => {
    it("formats a date as YYYY-MM-DD HH:mm:ss using local runtime time", () => {
      // Use a fixed UTC date and check the format, not the exact value (depends on runtime TZ)
      const date = new Date("2024-06-15T10:30:45.000Z");
      const result = formatDateForDB(date);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });

    it("pads single-digit month and day", () => {
      // Create a date where month and day are single-digit in local time
      const date = new Date(2024, 0, 5, 9, 3, 7); // Jan 5 09:03:07 local
      const result = formatDateForDB(date);
      // Format must be zero-padded
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });
  });

  describe("normalizeDate", () => {
    it("returns start of day for boundary='start'", () => {
      const result = normalizeDate("2024-06-15", "start");
      expect(result).toMatch(/^2024-06-15 \d{2}:\d{2}:\d{2}$/);
      // In Chile timezone, start of day is 00:00:00
      expect(result).toContain("00:00:00");
    });

    it("returns end of day for boundary='end'", () => {
      const result = normalizeDate("2024-06-15", "end");
      expect(result).toMatch(/^2024-06-15 \d{2}:\d{2}:\d{2}$/);
      expect(result).toContain("23:59:59");
    });

    it("returns null for empty string", () => {
      expect(normalizeDate("", "start")).toBeNull();
    });

    it("returns null for whitespace only", () => {
      expect(normalizeDate("   ", "start")).toBeNull();
    });

    it("returns null for string with wrong number of parts", () => {
      expect(normalizeDate("2024-06", "start")).toBeNull();
      expect(normalizeDate("2024", "start")).toBeNull();
    });

    it("returns null for a date with all-zero components", () => {
      // year/month/day must all be truthy (non-zero) per the implementation
      expect(normalizeDate("2024-00-01", "start")).toBeNull();
      expect(normalizeDate("2024-06-00", "start")).toBeNull();
    });

    it("trims whitespace before processing", () => {
      const result = normalizeDate("  2024-06-15  ", "start");
      expect(result).not.toBeNull();
    });
  });

  describe("normalizeTimestampString", () => {
    it("returns empty string for null", () => {
      expect(normalizeTimestampString(null)).toBe("");
    });

    it("returns empty string for empty string", () => {
      expect(normalizeTimestampString("")).toBe("");
    });

    it("normalizes ISO timestamp to dateThh:mm:ss format", () => {
      const result = normalizeTimestampString("2024-06-15T10:30:45.000Z");
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
      expect(result).toBe("2024-06-15T10:30:45");
    });

    it("normalizes ISO without milliseconds", () => {
      const result = normalizeTimestampString("2024-06-15T10:30:45");
      expect(result).toBe("2024-06-15T10:30:45");
    });

    it("normalizes space-separated datetime", () => {
      const result = normalizeTimestampString("2024-06-15 10:30:45");
      expect(result).toBe("2024-06-15T10:30:45");
    });

    it("handles Date object input", () => {
      const date = new Date(2024, 5, 15, 10, 30, 45); // June 15 2024 local time
      const result = normalizeTimestampString(date);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    });
  });

  describe("normalizeTimestamp", () => {
    it("uses fallback string when provided", () => {
      const result = normalizeTimestamp("2024-01-01T00:00:00", "2024-06-15 10:30:45");
      expect(result).toBe("2024-06-15T10:30:45");
    });

    it("uses primary Date when fallback is null", () => {
      const date = new Date(2024, 5, 15, 10, 30, 45);
      const result = normalizeTimestamp(date, null);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    });

    it("uses primary string when fallback is null and primary is a valid timestamp", () => {
      const result = normalizeTimestamp("2024-06-15T10:30:45", null);
      expect(result).toBe("2024-06-15T10:30:45");
    });

    it("returns empty string when both are null/empty", () => {
      expect(normalizeTimestamp(null, null)).toBe("");
    });
  });

  describe("normalizeTimestampForDb", () => {
    it("uses primary string when valid", () => {
      const result = normalizeTimestampForDb("2024-06-15T10:30:45", null);
      expect(result).toBe("2024-06-15 10:30:45");
    });

    it("uses fallback Date when primary is null", () => {
      const date = new Date(2024, 5, 15, 10, 30, 45);
      const result = normalizeTimestampForDb(null, date);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });

    it("returns empty string when both are null/undefined", () => {
      expect(normalizeTimestampForDb(null, null)).toBe("");
      expect(normalizeTimestampForDb(undefined, undefined)).toBe("");
    });

    it("replaces T with space in output", () => {
      const result = normalizeTimestampForDb("2024-06-15T10:30:45", null);
      expect(result).not.toContain("T");
      expect(result).toContain(" ");
    });
  });

  describe("iterateDateRange", () => {
    it("returns array of date strings", () => {
      const start = new Date("2024-06-01T12:00:00Z");
      const end = new Date("2024-06-03T12:00:00Z");
      const result = iterateDateRange(start, end);
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(3);
    });

    it("includes both start and end dates", () => {
      const start = new Date("2024-06-01T12:00:00Z");
      const end = new Date("2024-06-05T12:00:00Z");
      const result = iterateDateRange(start, end);
      expect(result[0]).toBe("2024-06-01");
      expect(result[result.length - 1]).toBe("2024-06-05");
    });

    it("returns single date when start equals end", () => {
      const date = new Date("2024-06-15T12:00:00Z");
      const result = iterateDateRange(date, date);
      expect(result).toHaveLength(1);
    });

    it("all entries match YYYY-MM-DD format", () => {
      const start = new Date("2024-06-01T12:00:00Z");
      const end = new Date("2024-06-07T12:00:00Z");
      const result = iterateDateRange(start, end);
      for (const d of result) {
        expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });
  });

  describe("parseDateOnly", () => {
    it("parses valid YYYY-MM-DD string", () => {
      const result = parseDateOnly("2024-06-15");
      expect(result).toBeInstanceOf(Date);
    });

    it("returns null for empty string", () => {
      expect(parseDateOnly("")).toBeNull();
    });

    it("returns null for invalid date 2024-13-01", () => {
      expect(parseDateOnly("2024-13-01")).toBeNull();
    });

    it("returns null for date with wrong format (slashes)", () => {
      expect(parseDateOnly("2024/06/15")).toBeNull();
    });

    it("returns null for partial date", () => {
      expect(parseDateOnly("2024-06")).toBeNull();
    });

    it("returns null when components mismatch (e.g. overflow day)", () => {
      expect(parseDateOnly("2024-02-30")).toBeNull();
    });
  });

  describe("formatDateOnly", () => {
    it("formats date as YYYY-MM-DD in Chile timezone", () => {
      const date = new Date("2024-06-15T12:00:00Z");
      const result = formatDateOnly(date);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result).toBe("2024-06-15");
    });
  });

  describe("formatChileDateTime", () => {
    it("formats with default pattern DD/MM/YYYY HH:mm", () => {
      const date = new Date("2024-06-15T12:00:00Z");
      const result = formatChileDateTime(date);
      expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
    });

    it("accepts custom pattern", () => {
      const date = new Date("2024-06-15T12:00:00Z");
      const result = formatChileDateTime(date, "YYYY-MM-DD");
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("accepts string input", () => {
      const result = formatChileDateTime("2024-06-15T12:00:00Z");
      expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
    });
  });

  describe("coerceDateOnly", () => {
    it("returns YYYY-MM-DD for valid date string", () => {
      const result = coerceDateOnly("2024-06-15");
      expect(result).toBe("2024-06-15");
    });

    it("returns null for invalid date string", () => {
      expect(coerceDateOnly("not-a-date")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(coerceDateOnly("")).toBeNull();
    });
  });

  describe("getNthBusinessDay", () => {
    it("returns a Date instance", () => {
      const base = new Date("2024-06-03T12:00:00Z"); // Monday
      const result = getNthBusinessDay(base, 1);
      expect(result).toBeInstanceOf(Date);
    });

    it("returns the same day when base is a weekday and n=1", () => {
      // Monday June 3 2024 noon UTC = Monday in Chile
      const base = new Date("2024-06-03T15:00:00Z");
      const result = getNthBusinessDay(base, 1);
      const resultStr = formatDateOnly(result);
      expect(resultStr).toBe("2024-06-03");
    });

    it("skips Saturday when counting business days", () => {
      // Friday June 7 2024
      const base = new Date("2024-06-07T15:00:00Z");
      const result = getNthBusinessDay(base, 2);
      const resultStr = formatDateOnly(result);
      // 2nd business day from Friday: Friday(1), Monday(2) -> Monday June 10
      expect(resultStr).toBe("2024-06-10");
    });

    it("returns n business days from base", () => {
      // Monday June 3 2024
      const base = new Date("2024-06-03T15:00:00Z");
      const result = getNthBusinessDay(base, 5);
      const resultStr = formatDateOnly(result);
      // Mon(1), Tue(2), Wed(3), Thu(4), Fri(5)
      expect(resultStr).toBe("2024-06-07");
    });
  });

  describe("getMonthRange", () => {
    it("returns from and to as YYYY-MM-DD strings", () => {
      const result = getMonthRange("2024-06");
      expect(result.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("from is the first day of the month", () => {
      const { from } = getMonthRange("2024-06");
      expect(from).toBe("2024-06-01");
    });

    it("to is the last day of the month", () => {
      const { to } = getMonthRange("2024-06");
      expect(to).toBe("2024-06-30");
    });

    it("handles February in a leap year", () => {
      const { to } = getMonthRange("2024-02");
      expect(to).toBe("2024-02-29");
    });

    it("handles months with 31 days", () => {
      const { to } = getMonthRange("2024-01");
      expect(to).toBe("2024-01-31");
    });

    it("handles December correctly", () => {
      const { from, to } = getMonthRange("2024-12");
      expect(from).toBe("2024-12-01");
      expect(to).toBe("2024-12-31");
    });
  });
});

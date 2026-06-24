import { Decimal } from "decimal.js";
import { describe, expect, it } from "vitest";

import {
  coerceAmount,
  fmtCLP,
  formatCurrency,
  formatDateTime,
  formatNumber,
  formatPercentage,
  formatRelativeDate,
} from "./format";

describe("format extra", () => {
  describe("fmtCLP / formatCurrency Decimal input", () => {
    it("handles Decimal", () => {
      expect(fmtCLP(new Decimal(2500))).toContain("2.500");
      expect(formatCurrency(new Decimal(2500))).toContain("2.500");
    });
    it("handles string input in formatCurrency", () => {
      expect(formatCurrency("1234")).toContain("1.234");
    });
  });

  describe("coerceAmount edge cases", () => {
    it("returns 0 for object with no Decimal", () => {
      expect(coerceAmount({})).toBe(0);
    });
    it("handles bigint", () => {
      expect(coerceAmount(BigInt(1000))).toBe(1000);
    });
    it("handles boolean (no digits sanitizes to 0)", () => {
      expect(coerceAmount(true)).toBe(0);
      expect(coerceAmount(false)).toBe(0);
    });
    it("returns 0 for empty sanitized", () => {
      expect(coerceAmount("$")).toBe(0);
    });
    it("handles thousand separators (dot grouping)", () => {
      expect(coerceAmount("1.234.567")).toBe(1234567);
    });
    it("handles ambiguous comma as thousands when fractional length is 3", () => {
      expect(coerceAmount("1,234")).toBe(1234);
    });
    it("treats Decimal instance", () => {
      expect(coerceAmount(new Decimal(99))).toBe(99);
    });
  });

  describe("formatRelativeDate", () => {
    it("returns dash for invalid date", () => {
      expect(formatRelativeDate("not-a-date")).toBe("-");
    });
    it("returns weeks ago", () => {
      const d = new Date();
      d.setDate(d.getDate() - 14);
      expect(formatRelativeDate(d)).toBe("Hace 2 semanas");
    });
    it("returns months ago", () => {
      const d = new Date();
      d.setDate(d.getDate() - 60);
      expect(formatRelativeDate(d)).toBe("Hace 2 meses");
    });
    it("returns years ago", () => {
      const d = new Date();
      d.setDate(d.getDate() - 365 * 2);
      expect(formatRelativeDate(d)).toBe("Hace 2 años");
    });
  });

  describe("formatDateTime", () => {
    it("includes hour/minute fields", () => {
      const out = formatDateTime("2023-01-01T12:30:00");
      expect(out).toMatch(/12/);
      expect(out).toMatch(/30/);
    });
  });

  describe("formatNumber", () => {
    it("formats with es-CL locale", () => {
      expect(formatNumber(1000)).toBe("1.000");
    });
    it("returns dash for non-finite", () => {
      expect(formatNumber(Number.NaN)).toBe("-");
    });
  });

  describe("formatPercentage", () => {
    it("formats with default 1 decimal", () => {
      expect(formatPercentage(33.333)).toBe("33.3%");
    });
    it("custom decimals", () => {
      expect(formatPercentage(50, 0)).toBe("50%");
    });
    it("returns dash for non-finite", () => {
      expect(formatPercentage(Number.POSITIVE_INFINITY)).toBe("-");
    });
  });
});

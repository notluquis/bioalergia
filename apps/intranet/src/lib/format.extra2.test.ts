import { describe, expect, it } from "vitest";

import {
  coerceAmount,
  fmtCLP,
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercentage,
  formatRelativeDate,
} from "./format";

describe("format.ts uncovered branches", () => {
  describe("coerceAmount — comma+dot ambiguity (lines 74-80)", () => {
    it("comma is decimal when comma comes after dot (es-CL: 1.234,56)", () => {
      expect(coerceAmount("1.234,56")).toBeCloseTo(1234.56, 2);
    });

    it("dot is decimal when dot comes after comma (en-US: 1,234.56)", () => {
      expect(coerceAmount("1,234.56")).toBeCloseTo(1234.56, 2);
    });

    it("multiple thousand separators with decimal comma", () => {
      expect(coerceAmount("1.234.567,89")).toBeCloseTo(1234567.89, 2);
    });

    it("multiple thousand commas with decimal dot", () => {
      expect(coerceAmount("1,234,567.89")).toBeCloseTo(1234567.89, 2);
    });

    it("comma with >2 fractional digits treated as thousands", () => {
      expect(coerceAmount("1,2345")).toBe(12345);
    });

    it("dot with non-3 fractional length kept as decimal", () => {
      expect(coerceAmount("1.5")).toBe(1.5);
      expect(coerceAmount("123.45")).toBeCloseTo(123.45, 2);
    });

    it("returns 0 when sanitized parses to non-finite", () => {
      // "-" alone after sanitization -> Number("-") is NaN
      expect(coerceAmount("-")).toBe(0);
    });

    it("handles negative numbers", () => {
      expect(coerceAmount("-1.234,56")).toBeCloseTo(-1234.56, 2);
    });
  });

  describe("fmtCLP — additional non-finite cases", () => {
    it("returns $0 for Infinity", () => {
      expect(fmtCLP(Number.POSITIVE_INFINITY)).toBe("$0");
      expect(fmtCLP(Number.NEGATIVE_INFINITY)).toBe("$0");
    });

    it("returns $0 for non-numeric string", () => {
      expect(fmtCLP("not a number")).toBe("$0");
    });
  });

  describe("formatCurrency — additional non-finite cases", () => {
    it("returns $0 for Infinity", () => {
      expect(formatCurrency(Number.POSITIVE_INFINITY)).toBe("$0");
    });
    it("returns $0 for non-numeric string", () => {
      expect(formatCurrency("xyz")).toBe("$0");
    });
  });

  describe("formatDate", () => {
    it("returns dash for invalid Date object", () => {
      expect(formatDate(new Date("invalid"))).toBe("-");
    });
    it("respects custom options override", () => {
      const out = formatDate("2023-06-15T12:00:00", { month: "long" });
      expect(out.toLowerCase()).toContain("junio");
    });
  });

  describe("formatRelativeDate boundaries", () => {
    it("Hace 7 días → switches to weeks", () => {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      expect(formatRelativeDate(d)).toBe("Hace 1 semanas");
    });
    it("Hace 30 días → switches to months", () => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      expect(formatRelativeDate(d)).toBe("Hace 1 meses");
    });
    it("Hace 365 días → switches to years", () => {
      const d = new Date();
      d.setDate(d.getDate() - 365);
      expect(formatRelativeDate(d)).toBe("Hace 1 años");
    });
  });

  describe("formatNumber / formatPercentage extras", () => {
    it("formatNumber returns dash for -Infinity", () => {
      expect(formatNumber(Number.NEGATIVE_INFINITY)).toBe("-");
    });
    it("formatNumber accepts options for fraction digits", () => {
      expect(formatNumber(1.5, { minimumFractionDigits: 2 })).toBe("1,50");
    });
    it("formatPercentage returns dash for NaN", () => {
      expect(formatPercentage(Number.NaN)).toBe("-");
    });
    it("formatPercentage handles negative values", () => {
      expect(formatPercentage(-12.345, 2)).toBe("-12.35%");
    });
  });
});

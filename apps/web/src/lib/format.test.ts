import { describe, expect, it } from "vitest";

import { coerceAmount, fmtCLP, formatCurrency, formatDate, formatFileSize, formatRelativeDate } from "./format";

describe("Format Utilities", () => {
  describe("fmtCLP", () => {
    it("should format number as CLP currency", () => {
      // Note: exact output depends on locale, but usually includes $ and dots
      const result = fmtCLP(1000);
      expect(result).toContain("1.000");
      expect(result).toContain("$");
    });

    it("should handle string input", () => {
      expect(fmtCLP("1000")).toContain("1.000");
    });

    it("should return $0 for NaN", () => {
      expect(fmtCLP(NaN)).toBe("$0");
    });

    it("should return $0 for null/undefined", () => {
      expect(fmtCLP(null)).toBe("$0");
      expect(fmtCLP(undefined)).toBe("$0");
    });

    it("should handle zero", () => {
      expect(fmtCLP(0)).toContain("$");
      expect(fmtCLP(0)).toContain("0");
    });
  });

  describe("formatCurrency", () => {
    it("should format number as CLP currency", () => {
      const result = formatCurrency(1000);
      expect(result).toContain("1.000");
      expect(result).toContain("$");
    });

    it("should return $0 for null/undefined", () => {
      expect(formatCurrency(null)).toBe("$0");
      expect(formatCurrency(undefined)).toBe("$0");
    });

    it("should return $0 for NaN", () => {
      expect(formatCurrency(NaN)).toBe("$0");
    });
  });

  describe("coerceAmount", () => {
    it("should return number as is", () => {
      expect(coerceAmount(100)).toBe(100);
    });

    it("should parse string with currency symbols", () => {
      expect(coerceAmount("$1.000")).toBe(1000);
      expect(coerceAmount("CLP 1.000")).toBe(1000);
    });

    it("should handle comma as decimal separator if present (though CLP usually doesn't use it)", () => {
      expect(coerceAmount("1,5")).toBe(1.5);
    });

    it("should return 0 for null/undefined", () => {
      expect(coerceAmount(null)).toBe(0);
      expect(coerceAmount(undefined)).toBe(0);
    });
  });

  describe("formatDate", () => {
    it("should format date object", () => {
      const date = new Date("2023-01-01T12:00:00");
      expect(formatDate(date)).toMatch(/01[-/]01[-/]2023/);
    });

    it("should format date string", () => {
      // Use T12:00:00 to avoid timezone issues shifting the date
      // Note: Node environment might use hyphens for es-CL
      const result = formatDate("2023-01-01T12:00:00");
      expect(result).toMatch(/01[-/]01[-/]2023/);
    });

    it("should return - for invalid date", () => {
      expect(formatDate("invalid")).toBe("-");
    });
  });

  describe("formatRelativeDate", () => {
    it("should return 'Hoy' for today", () => {
      expect(formatRelativeDate(new Date())).toBe("Hoy");
    });

    it("should return 'Ayer' for yesterday", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(formatRelativeDate(yesterday)).toBe("Ayer");
    });

    it("should return days ago", () => {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - 5);
      expect(formatRelativeDate(daysAgo)).toBe("Hace 5 días");
    });
  });

  describe("formatFileSize", () => {
    it("should format bytes", () => {
      expect(formatFileSize(500)).toBe("500 B");
    });

    it("should format KB", () => {
      expect(formatFileSize(1024)).toBe("1.0 KB");
    });

    it("should format MB", () => {
      expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
    });

    it("should return 0 B for negative or invalid input", () => {
      expect(formatFileSize(-1)).toBe("0 B");
      expect(formatFileSize(NaN)).toBe("0 B");
    });
  });
});

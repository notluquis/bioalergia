import { describe, it, expect } from "vitest";
import { fmtCLP, coerceAmount, formatDate, formatFileSize, formatRelativeDate } from "./format";

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

    it("should return - for invalid input", () => {
      expect(fmtCLP(NaN)).toBe("-");
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
      expect(formatDate(date)).toBe("01/01/2023");
    });

    it("should format date string", () => {
      expect(formatDate("2023-01-01")).toBe("01/01/2023");
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

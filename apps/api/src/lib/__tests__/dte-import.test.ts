/**
 * DTE Import Tests
 * Validates date parsing for multiple formats (Haulmer CSV, standard CSV, etc.)
 */

import { describe, expect, it } from "vitest";
import { parseAmount, parseDate } from "../dte-import";

describe("parseDate", () => {
  describe("Haulmer CSV format (YYYY-MM-DD)", () => {
    it("should parse YYYY-MM-DD format", () => {
      const result = parseDate("2026-02-02");
      expect(result).toBeTruthy();
      expect(result?.toISOString()).toBe("2026-02-02T00:00:00.000Z");
    });

    it("should parse YYYY-MM-DD with timestamp HH:MM:SS", () => {
      const result = parseDate("2026-02-02 13:25:08");
      expect(result).toBeTruthy();
      expect(result?.toISOString()).toBe("2026-02-02T00:00:00.000Z");
    });

    it("should parse YYYY-MM-DD with different timestamp", () => {
      const result = parseDate("2026-02-06 11:19:56");
      expect(result).toBeTruthy();
      expect(result?.toISOString()).toBe("2026-02-06T00:00:00.000Z");
    });

    it("should handle Haulmer null marker -/-/-", () => {
      const result = parseDate("-/-/-");
      expect(result).toBeNull();
    });

    it("should handle single dash null marker", () => {
      const result = parseDate("-");
      expect(result).toBeNull();
    });

    it("should handle empty string", () => {
      const result = parseDate("");
      expect(result).toBeNull();
    });

    it("should handle null/undefined", () => {
      expect(parseDate(null)).toBeNull();
      expect(parseDate(undefined)).toBeNull();
    });
  });

  describe("Standard CSV format (DD/MM/YYYY)", () => {
    it("should parse DD/MM/YYYY format", () => {
      const result = parseDate("08/02/2026");
      expect(result).toBeTruthy();
      expect(result?.toISOString()).toBe("2026-02-08T00:00:00.000Z");
    });

    it("should parse single digit day/month DD/MM/YYYY", () => {
      const result = parseDate("2/2/2026");
      expect(result).toBeTruthy();
      expect(result?.toISOString()).toBe("2026-02-02T00:00:00.000Z");
    });

    it("should parse single digit month DD/MM/YYYY", () => {
      const result = parseDate("08/2/2026");
      expect(result).toBeTruthy();
      expect(result?.toISOString()).toBe("2026-02-08T00:00:00.000Z");
    });
  });

  describe("Alternative date formats (DD-MM-YYYY, DD.MM.YYYY)", () => {
    it("should parse DD-MM-YYYY format", () => {
      const result = parseDate("08-02-2026");
      expect(result).toBeTruthy();
      expect(result?.toISOString()).toBe("2026-02-08T00:00:00.000Z");
    });

    it("should parse DD.MM.YYYY format", () => {
      const result = parseDate("08.02.2026");
      expect(result).toBeTruthy();
      expect(result?.toISOString()).toBe("2026-02-08T00:00:00.000Z");
    });
  });

  describe("Invalid formats", () => {
    it("should return null for invalid format", () => {
      const result = parseDate("not-a-date");
      expect(result).toBeNull();
    });

    it("should return null for invalid date values", () => {
      const result = parseDate("2026-13-45"); // Invalid month and day
      expect(result).toBeNull();
    });
  });

  describe("Real Haulmer test data from CSV", () => {
    // Test data extracted from actual Haulmer CSV
    const testCases = [
      { input: "2026-02-02", folio: "19713", expected: "2026-02-02T00:00:00.000Z" },
      {
        input: "2026-02-02 13:25:08",
        folio: "19713",
        expected: "2026-02-02T00:00:00.000Z",
      },
      {
        input: "2026-02-06 11:19:56",
        folio: "19757",
        expected: "2026-02-06T00:00:00.000Z",
      },
      {
        input: "2026-02-02 12:15:18",
        folio: "19708",
        expected: "2026-02-02T00:00:00.000Z",
      },
      { input: "-/-/-", folio: "19713", expected: null }, // Fecha Acuse Recibo
      { input: "-/-/-", folio: "19757", expected: null }, // Fecha Reclamo
    ];

    testCases.forEach(({ input, folio, expected }) => {
      it(`should parse folio ${folio}: "${input}" → ${expected}`, () => {
        const result = parseDate(input);
        if (expected === null) {
          expect(result).toBeNull();
        } else {
          expect(result?.toISOString()).toBe(expected);
        }
      });
    });
  });

  describe("Edge cases with whitespace", () => {
    it("should trim whitespace before parsing", () => {
      const result = parseDate("  2026-02-02  ");
      expect(result).toBeTruthy();
      expect(result?.toISOString()).toBe("2026-02-02T00:00:00.000Z");
    });

    it("should handle whitespace around null marker", () => {
      const result = parseDate("  -/-/-  ");
      expect(result).toBeNull();
    });
  });
});

describe("parseAmount", () => {
  describe("Currency parsing (Chilean format)", () => {
    it("should parse simple integer amounts with thousands separator (30.000 CLP)", () => {
      const result = parseAmount("30.000");
      expect(result?.toString()).toBe("30000"); // 30.000 = 30 thousand = 30000
    });

    it("should parse zero amounts", () => {
      const result = parseAmount("0");
      expect(result?.toString()).toBe("0");
    });

    it("should parse decimal amounts with comma separator", () => {
      const result = parseAmount("100.000,50"); // 100 thousand and 50 cents
      expect(result?.toString()).toBe("100000.5"); // Converted to 100000.5
    });

    it("should handle null/undefined amounts", () => {
      expect(parseAmount(null)).toBeNull();
      expect(parseAmount(undefined)).toBeNull();
      expect(parseAmount("")).toBeNull();
    });
  });
});

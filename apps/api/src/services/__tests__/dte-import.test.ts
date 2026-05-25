/**
 * DTE Import Tests
 * Validates date parsing for multiple formats (Haulmer CSV, standard CSV, etc.)
 */

import { describe, expect, it } from "vitest";
import {
  buildDtePurchaseDetail,
  buildDteSaleDetail,
  parseAmount,
  parseDate,
  resolveOtherTaxes,
} from "../dte-import.ts";

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

    it("should parse ISO timestamp with timezone", () => {
      const result = parseDate("2022-06-01T11:49:01.000Z");
      expect(result).toBeTruthy();
      expect(result?.toISOString()).toBe("2022-06-01T00:00:00.000Z");
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
        expect(result?.toISOString() ?? null).toBe(expected);
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

    it("should preserve single-dot decimal values from Haulmer exports", () => {
      const result = parseAmount("8500000.000");
      expect(result?.toString()).toBe("8500000");
    });

    it("should handle null/undefined amounts", () => {
      expect(parseAmount(null)).toBeNull();
      expect(parseAmount(undefined)).toBeNull();
      expect(parseAmount("")).toBeNull();
    });
  });
});

describe("buildDtePurchaseDetail", () => {
  it("should fallback providerName from clientName for Haulmer purchases", () => {
    const detail = buildDtePurchaseDetail({
      period: "202602",
      providerRUT: "77398220-1",
      folio: "12092213",
      clientName: "MercadoLibre Chile Ltda.",
    });

    expect(detail.providerName).toBe("MercadoLibre Chile Ltda.");
  });

  it("decodes Haulmer's doubly-encoded multi-tax JSON blob from the Valor column", () => {
    const detail = buildDtePurchaseDetail({
      period: "202605",
      providerRUT: "76844939-2",
      folio: "118531",
      // exactly what PapaParse extracts from """[{\"codigo\":...}]"""
      otherTaxAmount: '"[{\\"codigo\\":\\"27\\",\\"tasa\\":\\"10\\",\\"monto\\":\\"161\\"}]"',
    });

    expect(detail.otherTaxes).toEqual([{ code: "27", rate: 10, amount: 161 }]);
    // scalar columns mirror the first entry for backward compat
    expect(detail.otherTaxCode).toBe("27");
    expect(String(detail.otherTaxAmount)).toBe("161");
    expect(String(detail.otherTaxRate)).toBe("10");
  });

  it("keeps scalar other-tax columns when CSV sends separate Codigo/Valor/Tasa", () => {
    const taxes = resolveOtherTaxes({
      otherTaxCode: "27",
      otherTaxAmount: "161",
      otherTaxRate: "10",
    });
    expect(taxes).toEqual([{ code: "27", rate: 10, amount: 161 }]);
  });

  it("returns null other-taxes when columns are empty", () => {
    const detail = buildDtePurchaseDetail({
      period: "202605",
      providerRUT: "76012288-2",
      folio: "1274",
    });
    expect(detail.otherTaxes).toBeUndefined();
    expect(resolveOtherTaxes({ otherTaxAmount: "" })).toBeNull();
  });
});

describe("buildDteSaleDetail", () => {
  it("should support compact sales CSV aliases and defaults", () => {
    const detail = buildDteSaleDetail({
      folio: "4477",
      neto: "0",
      iva: "0",
      total: "40000",
      dte: "41",
      fecha: "2022-06-01T11:49:01.000Z",
    });

    expect(detail.documentType).toBe(41);
    expect(detail.documentDate).toBeInstanceOf(Date);
    expect((detail.documentDate as Date).toISOString()).toBe("2022-06-01T00:00:00.000Z");
    expect((detail.receiptDate as Date).toISOString()).toBe("2022-06-01T00:00:00.000Z");
    expect(detail.clientRUT).toBe("66666666-6");
    expect(detail.clientName).toBe("Cliente sin identificar");
    expect(String(detail.netAmount)).toBe("0");
    expect(String(detail.ivaAmount)).toBe("0");
    expect(String(detail.totalAmount)).toBe("40000");
  });
});

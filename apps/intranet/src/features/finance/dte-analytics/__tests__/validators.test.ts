import { describe, expect, it } from "vitest";
import {
  extractYearFromPeriod,
  isParsedPeriodValid,
  isValidDTESummary,
  safeParsePeriod,
  validateDTESummary,
  validateDTESummaryArray,
} from "../validators";

describe("safeParsePeriod", () => {
  it("parses valid YYYY-MM period", () => {
    const result = safeParsePeriod("2025-06");
    expect(result.year).toBe("2025");
    expect(result.month).toBe("06");
    expect(result.period).toBe("2025-06");
  });

  it("rejects period without separator", () => {
    expect(() => safeParsePeriod("202506")).toThrow();
  });

  it("rejects invalid month (00, 13)", () => {
    expect(() => safeParsePeriod("2025-00")).toThrow();
    expect(() => safeParsePeriod("2025-13")).toThrow();
  });

  it("rejects non-4-digit year", () => {
    expect(() => safeParsePeriod("25-06")).toThrow();
  });
});

describe("extractYearFromPeriod", () => {
  it("extracts year from valid period", () => {
    expect(extractYearFromPeriod("2024-12")).toBe("2024");
  });
});

describe("isParsedPeriodValid", () => {
  it("returns true for valid period", () => {
    expect(isParsedPeriodValid("2025-01")).toBe(true);
    expect(isParsedPeriodValid("2024-12")).toBe(true);
  });

  it("returns false for invalid periods", () => {
    // PeriodValidator checks \d{4}-\d{2} format only — not month range
    expect(isParsedPeriodValid("2025")).toBe(false);
    expect(isParsedPeriodValid("")).toBe(false);
    expect(isParsedPeriodValid("25-06")).toBe(false);
  });
});

const VALID_SUMMARY = {
  period: "2025-01",
  count: 10,
  totalAmount: 100000,
  exemptAmount: 0,
  netAmount: 84034,
  taxAmount: 15966,
  averageAmount: 10000,
};

describe("validateDTESummary", () => {
  it("accepts valid summary", () => {
    const result = validateDTESummary(VALID_SUMMARY);
    expect(result.period).toBe("2025-01");
    expect(result.totalAmount).toBe(100000);
  });

  it("throws for invalid period format", () => {
    expect(() => validateDTESummary({ ...VALID_SUMMARY, period: "25-01" })).toThrow(TypeError);
  });

  it("throws for negative amounts", () => {
    expect(() => validateDTESummary({ ...VALID_SUMMARY, totalAmount: -1 })).toThrow(TypeError);
  });

  it("throws for missing required fields", () => {
    const { period: _period, ...rest } = VALID_SUMMARY;
    expect(() => validateDTESummary(rest)).toThrow(TypeError);
  });
});

describe("validateDTESummaryArray", () => {
  it("accepts valid array", () => {
    const result = validateDTESummaryArray([VALID_SUMMARY]);
    expect(result).toHaveLength(1);
  });

  it("accepts empty array", () => {
    expect(validateDTESummaryArray([])).toEqual([]);
  });

  it("throws for invalid item in array", () => {
    expect(() => validateDTESummaryArray([{ ...VALID_SUMMARY, count: -1 }])).toThrow(TypeError);
  });
});

describe("isValidDTESummary", () => {
  it("returns true for valid data", () => {
    expect(isValidDTESummary(VALID_SUMMARY)).toBe(true);
  });

  it("returns false for invalid data", () => {
    expect(isValidDTESummary(null)).toBe(false);
    expect(isValidDTESummary({ ...VALID_SUMMARY, totalAmount: "not a number" })).toBe(false);
  });
});

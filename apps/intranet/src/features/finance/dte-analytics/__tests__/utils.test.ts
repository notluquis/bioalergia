import { describe, expect, it, vi } from "vitest";
import type { DTESummaryRaw } from "../types";
import {
  MONTH_NAMES,
  buildComparisonChartData,
  buildMonthlyChartData,
  calculateYearlyTotals,
  extractYearsFromSummary,
  formatCurrency,
  formatCurrencyCompact,
  formatNumber,
  getMonthName,
  isValidYearOption,
  parsePeriodSafely,
  safeYearSelection,
} from "../utils";

describe("getMonthName", () => {
  it("returns correct month names for valid indices", () => {
    expect(getMonthName(0)).toBe("Ene");
    expect(getMonthName(6)).toBe("Jul");
    expect(getMonthName(11)).toBe("Dic");
  });

  it("throws RangeError for out-of-bounds indices", () => {
    expect(() => getMonthName(-1)).toThrow(RangeError);
    expect(() => getMonthName(12)).toThrow(RangeError);
  });
});

describe("MONTH_NAMES", () => {
  it("has exactly 12 entries", () => {
    expect(MONTH_NAMES).toHaveLength(12);
  });
});

describe("formatCurrencyCompact", () => {
  it("formats billions", () => {
    expect(formatCurrencyCompact(8_500_000_000)).toBe("$8,5B");
  });

  it("formats millions", () => {
    expect(formatCurrencyCompact(13_495_000)).toBe("$13,5M");
  });

  it("formats thousands", () => {
    expect(formatCurrencyCompact(45_000)).toBe("$45K");
  });

  it("formats small values without suffix", () => {
    expect(formatCurrencyCompact(500)).toBe("$500");
  });

  it("returns N/A for undefined", () => {
    expect(formatCurrencyCompact(undefined)).toBe("N/A");
  });

  it("returns N/A for Infinity", () => {
    expect(formatCurrencyCompact(Infinity)).toBe("N/A");
  });
});

const SAMPLE_SUMMARY: DTESummaryRaw[] = [
  {
    period: "2025-01",
    count: 10,
    totalAmount: 100000,
    exemptAmount: 0,
    netAmount: 84034,
    taxAmount: 15966,
    averageAmount: 10000,
  },
  {
    period: "2025-06",
    count: 5,
    totalAmount: 50000,
    exemptAmount: 0,
    netAmount: 42017,
    taxAmount: 7983,
    averageAmount: 10000,
  },
];

describe("buildMonthlyChartData", () => {
  it("returns 12 months always", () => {
    const result = buildMonthlyChartData(SAMPLE_SUMMARY, "2025");
    expect(result).toHaveLength(12);
  });

  it("fills in data for months in the summary", () => {
    const result = buildMonthlyChartData(SAMPLE_SUMMARY, "2025");
    expect(result[0]?.totalAmount).toBe(100000);
    expect(result[5]?.totalAmount).toBe(50000);
  });

  it("fills zeros for missing months", () => {
    const result = buildMonthlyChartData(SAMPLE_SUMMARY, "2025");
    expect(result[1]?.totalAmount).toBe(0);
    expect(result[11]?.totalAmount).toBe(0);
  });

  it("month names align with MONTH_NAMES", () => {
    const result = buildMonthlyChartData(SAMPLE_SUMMARY, "2025");
    expect(result[0]?.month).toBe("Ene");
    expect(result[11]?.month).toBe("Dic");
  });
});

describe("calculateYearlyTotals", () => {
  it("sums totals across all months", () => {
    const data = buildMonthlyChartData(SAMPLE_SUMMARY, "2025");
    const totals = calculateYearlyTotals(data);
    expect(totals.totalAmount).toBe(150000);
    expect(totals.count).toBe(15);
  });

  it("averages the averageAmount across 12 months", () => {
    const data = buildMonthlyChartData(SAMPLE_SUMMARY, "2025");
    const totals = calculateYearlyTotals(data);
    // (10000 + 10000 + 0*10) / 12 ≈ 1666.67
    expect(totals.averageAmount).toBeCloseTo((10000 + 10000) / 12, 1);
  });
});

describe("extractYearsFromSummary", () => {
  it("returns unique years sorted descending", () => {
    const summary: DTESummaryRaw[] = [
      {
        period: "2023-01",
        count: 1,
        totalAmount: 0,
        exemptAmount: 0,
        netAmount: 0,
        taxAmount: 0,
        averageAmount: 0,
      },
      {
        period: "2025-06",
        count: 1,
        totalAmount: 0,
        exemptAmount: 0,
        netAmount: 0,
        taxAmount: 0,
        averageAmount: 0,
      },
      {
        period: "2024-03",
        count: 1,
        totalAmount: 0,
        exemptAmount: 0,
        netAmount: 0,
        taxAmount: 0,
        averageAmount: 0,
      },
    ];
    expect(extractYearsFromSummary(summary)).toEqual(["2025", "2024", "2023"]);
  });

  it("deduplicates years", () => {
    const summary: DTESummaryRaw[] = [
      {
        period: "2025-01",
        count: 0,
        totalAmount: 0,
        exemptAmount: 0,
        netAmount: 0,
        taxAmount: 0,
        averageAmount: 0,
      },
      {
        period: "2025-06",
        count: 0,
        totalAmount: 0,
        exemptAmount: 0,
        netAmount: 0,
        taxAmount: 0,
        averageAmount: 0,
      },
    ];
    expect(extractYearsFromSummary(summary)).toEqual(["2025"]);
  });
});

describe("isValidYearOption", () => {
  it("returns true for valid option", () => {
    expect(isValidYearOption("2025", ["2025", "2024"])).toBe(true);
  });

  it("returns false for invalid option", () => {
    expect(isValidYearOption("2020", ["2025", "2024"])).toBe(false);
  });
});

describe("formatCurrency (line 47)", () => {
  it("formats CLP currency with es-CL locale", () => {
    const out = formatCurrency(1000);
    expect(out).toContain("1.000");
    expect(out).toContain("$");
  });
});

describe("formatNumber (line 81)", () => {
  it("formats numbers with es-CL locale", () => {
    expect(formatNumber(1000)).toBe("1.000");
  });
});

describe("parsePeriodSafely (re-export)", () => {
  it("parses valid period and returns year/month/period", () => {
    expect(parsePeriodSafely("2025-03")).toMatchObject({
      year: "2025",
      month: "03",
      period: "2025-03",
    });
  });
});

describe("extractYearsFromSummary catch branch (line 190)", () => {
  it("warns and skips entries with malformed period", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const summary: DTESummaryRaw[] = [
      {
        period: "not-a-period", // safeParsePeriod will throw → catch branch
        count: 1,
        totalAmount: 0,
        exemptAmount: 0,
        netAmount: 0,
        taxAmount: 0,
        averageAmount: 0,
      },
      {
        period: "2025-01",
        count: 1,
        totalAmount: 0,
        exemptAmount: 0,
        netAmount: 0,
        taxAmount: 0,
        averageAmount: 0,
      },
    ];
    const out = extractYearsFromSummary(summary);
    expect(out).toEqual(["2025"]);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe("safeYearSelection", () => {
  it("returns selected year if valid", () => {
    expect(safeYearSelection("2024", ["2025", "2024"])).toBe("2024");
  });

  it("falls back to first option if invalid", () => {
    expect(safeYearSelection("2020", ["2025", "2024"])).toBe("2025");
  });

  it("falls back to current year if options empty", () => {
    const result = safeYearSelection("2020", []);
    expect(result).toBe(new Date().getFullYear().toString());
  });
});

describe("buildComparisonChartData", () => {
  it("returns 12 month entries", () => {
    const summary: DTESummaryRaw[] = [
      {
        period: "2024-03",
        count: 5,
        totalAmount: 50000,
        exemptAmount: 0,
        netAmount: 42017,
        taxAmount: 7983,
        averageAmount: 10000,
      },
      {
        period: "2025-03",
        count: 8,
        totalAmount: 80000,
        exemptAmount: 0,
        netAmount: 67227,
        taxAmount: 12773,
        averageAmount: 10000,
      },
    ];
    const result = buildComparisonChartData(summary);
    expect(result).toHaveLength(12);
    expect(result[2]?.["2024"]).toBe(50000);
    expect(result[2]?.["2025"]).toBe(80000);
  });
});

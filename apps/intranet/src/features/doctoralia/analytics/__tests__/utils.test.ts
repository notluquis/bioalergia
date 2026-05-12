import { describe, expect, it } from "vitest";
import type { DoctoraliaCalendarMonthlySummaryPeriod } from "@/features/doctoralia/types";
import {
  DOCTORALIA_MONTH_NAMES,
  buildDoctoraliaComparisonChartData,
  buildDoctoraliaMonthlyChartData,
  calculateDoctoraliaYearlyTotals,
  extractDoctoraliaYearsFromSummary,
  formatDoctoraliaNumber,
  formatDoctoraliaPercent,
  getDoctoraliaMonthName,
  safeDoctoraliaYearSelection,
} from "../utils";

function makePeriod(
  period: string,
  overrides: Partial<DoctoraliaCalendarMonthlySummaryPeriod> = {}
): DoctoraliaCalendarMonthlySummaryPeriod {
  return {
    period,
    programmed: 10,
    cancelled: 2,
    attended: 8,
    total: 20,
    cancellationRate: 0.1,
    ...overrides,
  };
}

describe("DOCTORALIA_MONTH_NAMES", () => {
  it("has 12 entries", () => {
    expect(DOCTORALIA_MONTH_NAMES).toHaveLength(12);
  });
});

describe("getDoctoraliaMonthName", () => {
  it("returns month names for valid indices", () => {
    expect(getDoctoraliaMonthName(0)).toBe("Ene");
    expect(getDoctoraliaMonthName(11)).toBe("Dic");
  });

  it("throws for out-of-range", () => {
    expect(() => getDoctoraliaMonthName(-1)).toThrow(RangeError);
    expect(() => getDoctoraliaMonthName(12)).toThrow(RangeError);
  });
});

describe("formatDoctoraliaNumber", () => {
  it("formats numbers in es-CL locale", () => {
    const result = formatDoctoraliaNumber(1000);
    expect(result).toContain("1");
  });
});

describe("formatDoctoraliaPercent", () => {
  it("formats fractions as percent", () => {
    const result = formatDoctoraliaPercent(0.5);
    expect(result).toContain("50");
    expect(result).toContain("%");
  });

  it("formats with one decimal", () => {
    const result = formatDoctoraliaPercent(0.125);
    expect(result).toContain("12");
  });
});

describe("buildDoctoraliaMonthlyChartData", () => {
  it("returns 12 months", () => {
    const summary = [makePeriod("2025-03")];
    const result = buildDoctoraliaMonthlyChartData(summary, "2025");
    expect(result).toHaveLength(12);
  });

  it("fills data for matching periods", () => {
    const summary = [
      makePeriod("2025-03", { programmed: 15, attended: 12, cancelled: 3, total: 30 }),
    ];
    const result = buildDoctoraliaMonthlyChartData(summary, "2025");
    expect(result[2]?.programmed).toBe(15);
    expect(result[2]?.attended).toBe(12);
  });

  it("fills zeros for missing months", () => {
    const summary = [makePeriod("2025-01")];
    const result = buildDoctoraliaMonthlyChartData(summary, "2025");
    expect(result[1]?.programmed).toBe(0);
  });
});

describe("calculateDoctoraliaYearlyTotals", () => {
  it("sums programmed, cancelled, attended", () => {
    const summary = [makePeriod("2025-01"), makePeriod("2025-02")];
    const data = buildDoctoraliaMonthlyChartData(summary, "2025");
    const totals = calculateDoctoraliaYearlyTotals(data);
    expect(totals.programmed).toBe(20);
    expect(totals.cancelled).toBe(4);
    expect(totals.attended).toBe(16);
  });

  it("computes cancellationRate as cancelled/total", () => {
    const summary = [
      makePeriod("2025-01", { programmed: 0, cancelled: 1, attended: 0, total: 10 }),
    ];
    const data = buildDoctoraliaMonthlyChartData(summary, "2025");
    const totals = calculateDoctoraliaYearlyTotals(data);
    expect(totals.cancellationRate).toBeGreaterThan(0);
  });
});

describe("extractDoctoraliaYearsFromSummary", () => {
  it("extracts and sorts years descending", () => {
    const summary = [makePeriod("2023-06"), makePeriod("2025-01"), makePeriod("2024-12")];
    expect(extractDoctoraliaYearsFromSummary(summary)).toEqual(["2025", "2024", "2023"]);
  });

  it("deduplicates years", () => {
    const summary = [makePeriod("2025-01"), makePeriod("2025-06")];
    expect(extractDoctoraliaYearsFromSummary(summary)).toEqual(["2025"]);
  });
});

describe("safeDoctoraliaYearSelection", () => {
  it("returns selected year if valid", () => {
    expect(safeDoctoraliaYearSelection("2024", ["2025", "2024"])).toBe("2024");
  });

  it("falls back to first option if invalid", () => {
    expect(safeDoctoraliaYearSelection("2020", ["2025", "2024"])).toBe("2025");
  });
});

describe("buildDoctoraliaComparisonChartData", () => {
  it("returns 12 entries", () => {
    const summary = [makePeriod("2024-03"), makePeriod("2025-03")];
    const result = buildDoctoraliaComparisonChartData(summary, "programmed");
    expect(result).toHaveLength(12);
  });

  it("populates year columns for the right month", () => {
    const summary = [
      makePeriod("2024-06", { programmed: 20 }),
      makePeriod("2025-06", { programmed: 30 }),
    ];
    const result = buildDoctoraliaComparisonChartData(summary, "programmed");
    expect(result[5]?.["2024"]).toBe(20);
    expect(result[5]?.["2025"]).toBe(30);
  });
});

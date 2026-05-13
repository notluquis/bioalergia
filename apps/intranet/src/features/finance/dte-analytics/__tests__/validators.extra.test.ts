import { describe, expect, it } from "vitest";
import { safeParsePeriod, validateDTESummaryArray } from "../validators";

describe("validators — extra branch coverage", () => {
  it("validateDTESummaryArray appends '...' suffix when more than 3 errors", () => {
    const bad = [
      { count: -1, period: "bad" },
      { count: -2, period: "bad" },
      { count: -3, period: "bad" },
      { count: -4, period: "bad" },
    ];
    expect(() => validateDTESummaryArray(bad)).toThrow(/\.\.\./);
  });

  it("validateDTESummaryArray throws Invalid DTESummary array prefix", () => {
    const bad = [{ count: -1, period: "bad" }];
    expect(() => validateDTESummaryArray(bad)).toThrow(/Invalid DTESummary array/);
  });

  it("safeParsePeriod handles missing year/month parts (empty fallback via ??)", () => {
    // "-" splits into ["", ""] → year and month parts are empty strings
    expect(() => safeParsePeriod("-")).toThrow(/Invalid period/);
  });

  it("safeParsePeriod handles trailing dash (year present, no month)", () => {
    expect(() => safeParsePeriod("2025-")).toThrow(/Invalid period/);
  });

  it("safeParsePeriod handles leading dash (no year, month present)", () => {
    expect(() => safeParsePeriod("-06")).toThrow(/Invalid period/);
  });
});

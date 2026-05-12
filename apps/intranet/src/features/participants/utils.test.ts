import dayjs from "dayjs";
import { describe, expect, it } from "vitest";
import { resolveRange } from "./utils";

describe("resolveRange", () => {
  it("returns custom range when quickValue is 'custom' and both dates provided", () => {
    const result = resolveRange("custom", "2026-01-01", "2026-01-31");
    expect(result).toStrictEqual({ from: "2026-01-01", to: "2026-01-31" });
  });

  it("returns only 'from' when quickValue is 'custom' and only from is provided", () => {
    const result = resolveRange("custom", "2026-01-01", "");
    expect(result).toStrictEqual({ from: "2026-01-01" });
  });

  it("returns only 'to' when quickValue is 'custom' and only to is provided", () => {
    const result = resolveRange("custom", "", "2026-01-31");
    expect(result).toStrictEqual({ to: "2026-01-31" });
  });

  it("returns empty object when quickValue is 'custom' and both dates are empty", () => {
    const result = resolveRange("custom", "", "");
    expect(result).toStrictEqual({});
  });

  it("returns the first day of the month for a YYYY-MM value", () => {
    const result = resolveRange("2026-01", "", "");
    expect(result.from).toBe("2026-01-01");
  });

  it("returns the last day of the month for a YYYY-MM value", () => {
    const result = resolveRange("2026-01", "", "");
    expect(result.to).toBe("2026-01-31");
  });

  it("handles February correctly (2024 is a leap year)", () => {
    const result = resolveRange("2024-02", "", "");
    expect(result.from).toBe("2024-02-01");
    expect(result.to).toBe("2024-02-29");
  });

  it("handles a month with 30 days", () => {
    const result = resolveRange("2026-04", "", "");
    expect(result.to).toBe("2026-04-30");
  });

  it("uses current month when quickValue is 'current'", () => {
    const now = dayjs();
    const expectedFrom = now.startOf("month").format("YYYY-MM-DD");
    const expectedTo = now.endOf("month").format("YYYY-MM-DD");
    const result = resolveRange("current", "", "");
    expect(result.from).toBe(expectedFrom);
    expect(result.to).toBe(expectedTo);
  });

  it("returns empty object for invalid year-month", () => {
    const result = resolveRange("bad-value", "", "");
    // 'bad-value'.split('-') → ['bad', 'value'] → Number('bad') = NaN
    expect(result).toStrictEqual({});
  });

  it("custom from/to is not used when quickValue is not 'custom'", () => {
    const result = resolveRange("2026-03", "2025-01-01", "2025-12-31");
    expect(result.from).toBe("2026-03-01");
    expect(result.to).toBe("2026-03-31");
  });
});

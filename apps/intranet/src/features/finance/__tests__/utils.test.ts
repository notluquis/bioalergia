import { describe, expect, it } from "vitest";
import { formatAmount } from "../utils";

describe("formatAmount", () => {
  it("formats CLP amounts in es-CL locale", () => {
    const result = formatAmount(45000);
    expect(result).toContain("45");
    expect(result).toMatch(/\$|CLP/);
  });

  it("returns dash for null", () => {
    expect(formatAmount(null)).toBe("-");
  });

  it("returns dash for undefined", () => {
    expect(formatAmount(undefined)).toBe("-");
  });

  it("parses string amounts", () => {
    const result = formatAmount("12345");
    expect(result).not.toBe("-");
    expect(result).toContain("12");
  });

  it("returns dash for NaN string", () => {
    expect(formatAmount("not-a-number")).toBe("-");
  });

  it("formats zero", () => {
    const result = formatAmount(0);
    expect(result).not.toBe("-");
  });

  it("uses provided currency", () => {
    const clp = formatAmount(1000, "CLP");
    const usd = formatAmount(1000, "USD");
    expect(clp).not.toBe(usd);
  });

  it("defaults to CLP when currency is null", () => {
    const withNull = formatAmount(1000, null);
    const withDefault = formatAmount(1000, "CLP");
    expect(withNull).toBe(withDefault);
  });
});

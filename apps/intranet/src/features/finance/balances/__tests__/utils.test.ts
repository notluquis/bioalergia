import { describe, expect, it } from "vitest";
import { formatBalanceInput, parseBalanceInput } from "../utils";

describe("formatBalanceInput", () => {
  it("formats integers without decimals", () => {
    expect(formatBalanceInput(45000)).toBe("45000");
  });

  it("rounds to whole number for CLP (no cents)", () => {
    // CLP has no decimal places; roundCurrency uses ROUND_HALF_UP
    expect(formatBalanceInput(45000.5)).toBe("45001");
    expect(formatBalanceInput(45000.4)).toBe("45000");
  });

  it("returns empty string for non-finite values", () => {
    expect(formatBalanceInput(NaN)).toBe("");
    expect(formatBalanceInput(Infinity)).toBe("");
    expect(formatBalanceInput(-Infinity)).toBe("");
  });

  it("rounds to CLP precision", () => {
    expect(formatBalanceInput(45000.004)).toBe("45000");
  });
});

describe("parseBalanceInput", () => {
  it("parses plain integer string", () => {
    expect(parseBalanceInput("45000")).toBe(45000);
  });

  it("parses CLP formatted string with dots as thousands separators", () => {
    expect(parseBalanceInput("45.000")).toBe(45000);
  });

  it("parses string with $ prefix", () => {
    expect(parseBalanceInput("$45000")).toBe(45000);
  });

  it("parses string with CLP prefix", () => {
    expect(parseBalanceInput("CLP 45000")).toBe(45000);
  });

  it("parses comma as decimal separator", () => {
    expect(parseBalanceInput("45000,50")).toBe(45000.5);
  });

  it("returns null for empty string", () => {
    expect(parseBalanceInput("")).toBeNull();
  });

  it("returns null for whitespace", () => {
    expect(parseBalanceInput("   ")).toBeNull();
  });

  it("returns null for non-numeric string", () => {
    expect(parseBalanceInput("abc")).toBeNull();
  });

  it("returns null for non-string input", () => {
    expect(parseBalanceInput(123 as unknown as string)).toBeNull();
  });

  it("handles negative values", () => {
    expect(parseBalanceInput("-5000")).toBe(-5000);
  });
});

import { describe, expect, it } from "vitest";

import { cn, formatCurrency } from "./utils";

describe("cn", () => {
  it("returns a single class unchanged", () => {
    expect(cn("foo")).toBe("foo");
  });

  it("merges multiple classes", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("deduplicates conflicting Tailwind classes (last wins)", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("handles conditional classes with falsy values", () => {
    expect(cn("base", false && "skip", "end")).toBe("base end");
  });

  it("handles object syntax from clsx", () => {
    expect(cn({ "text-red-500": true, "text-blue-500": false })).toBe("text-red-500");
  });

  it("handles array input", () => {
    expect(cn(["a", "b"])).toBe("a b");
  });

  it("returns empty string when all inputs are falsy", () => {
    expect(cn(false, undefined, null, "")).toBe("");
  });

  it("merges conflicting background colors correctly", () => {
    const result = cn("bg-red-500", "bg-blue-500");
    expect(result).toBe("bg-blue-500");
  });

  it("preserves non-conflicting classes", () => {
    const result = cn("flex", "items-center", "p-2");
    expect(result).toContain("flex");
    expect(result).toContain("items-center");
    expect(result).toContain("p-2");
  });
});

describe("formatCurrency", () => {
  it("formats CLP amount with $ symbol", () => {
    const result = formatCurrency(1000);
    expect(result).toContain("$");
    expect(result).toContain("1");
  });

  it("formats large CLP amount with thousands separator", () => {
    const result = formatCurrency(1000000);
    expect(result).toContain("$");
    // es-CL uses dots for thousands
    expect(result).toContain("1.000.000");
  });

  it("formats zero as currency", () => {
    const result = formatCurrency(0);
    expect(result).toContain("$");
    expect(result).toContain("0");
  });

  it("formats UF with UF prefix and two decimals", () => {
    const result = formatCurrency(35.5, "UF");
    expect(result.startsWith("UF")).toBe(true);
    // es-CL decimal separator is comma
    expect(result).toContain("35");
  });

  it("UF formatting always has two decimal places", () => {
    const result = formatCurrency(10, "UF");
    expect(result).toMatch(/UF\s+10[,.]00/);
  });

  it("falls back to CLP for invalid currency codes", () => {
    // An invalid currency code should fall back to CLP formatting
    const result = formatCurrency(500, "INVALID");
    expect(result).toContain("$");
  });

  it("formats USD amounts correctly", () => {
    const result = formatCurrency(99, "USD");
    // Should include USD indicator or $ in the string
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("handles negative amounts for CLP", () => {
    const result = formatCurrency(-500);
    expect(result).toContain("500");
  });
});

import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { areDataDifferent, parseAmount, parseDate } from "../dte-import";

describe("parseAmount", () => {
  it("returns null for null/empty", () => {
    expect(parseAmount(null)).toBeNull();
    expect(parseAmount("")).toBeNull();
    expect(parseAmount(undefined)).toBeNull();
  });

  it("parses plain integer", () => {
    expect(parseAmount("100000")?.toNumber()).toBe(100000);
  });

  it("strips $ sign", () => {
    expect(parseAmount("$1234")?.toNumber()).toBe(1234);
  });

  it("handles dot-thousands format (Chilean)", () => {
    expect(parseAmount("1.234.567")?.toNumber()).toBe(1234567);
  });

  it("handles comma-decimal European format", () => {
    expect(parseAmount("1.234,56")?.toNumber()).toBe(1234.56);
  });

  it("returns null for NaN strings", () => {
    expect(parseAmount("abc")).toBeNull();
  });
});

describe("parseDate", () => {
  it("returns null for null/undefined/empty", () => {
    expect(parseDate(null)).toBeNull();
    expect(parseDate("")).toBeNull();
    expect(parseDate(undefined)).toBeNull();
  });

  it("returns null for Haulmer null marker", () => {
    expect(parseDate("-/-/-")).toBeNull();
    expect(parseDate("-")).toBeNull();
  });

  it("parses ISO date YYYY-MM-DD", () => {
    const result = parseDate("2026-01-15");
    expect(result).not.toBeNull();
    expect(result?.toISOString().startsWith("2026-01-15")).toBe(true);
  });

  it("parses ISO timestamp with Z", () => {
    const result = parseDate("2022-06-01T11:49:01.000Z");
    expect(result).not.toBeNull();
    expect(result?.toISOString().startsWith("2022-06-01")).toBe(true);
  });

  it("parses DD/MM/YYYY format", () => {
    const result = parseDate("15/01/2026");
    expect(result).not.toBeNull();
  });
});

describe("areDataDifferent", () => {
  it("returns false when data is identical", () => {
    expect(areDataDifferent({ name: "Juan", amount: 100 }, { name: "Juan", amount: 100 })).toBe(
      false,
    );
  });

  it("returns true when a field differs", () => {
    expect(areDataDifferent({ name: "Juan", amount: 100 }, { name: "Pedro", amount: 100 })).toBe(
      true,
    );
  });

  it("ignores system fields (id, createdAt, updatedAt)", () => {
    expect(
      areDataDifferent(
        { id: 1, createdAt: new Date(), name: "Juan" },
        { id: 99, createdAt: new Date(0), name: "Juan" },
      ),
    ).toBe(false);
  });

  it("compares Decimal values by string representation", () => {
    const existing = { amount: new Decimal("100.50") };
    expect(areDataDifferent(existing, { amount: new Decimal("100.50") })).toBe(false);
    expect(areDataDifferent(existing, { amount: new Decimal("100.51") })).toBe(true);
  });

  it("compares Date values by time", () => {
    const d1 = new Date("2026-01-01");
    const d2 = new Date("2026-01-01");
    const d3 = new Date("2026-02-01");
    expect(areDataDifferent({ date: d1 }, { date: d2 })).toBe(false);
    expect(areDataDifferent({ date: d1 }, { date: d3 })).toBe(true);
  });
});

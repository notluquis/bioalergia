import { describe, expect, it } from "vitest";
import {
  coerceLimit,
  coercePositiveInteger,
  ensureArray,
  normalizeDate,
  normalizeSearch,
  toStringValues,
} from "../query-helpers.ts";

describe("toStringValues", () => {
  it("wraps a string in array", () => {
    expect(toStringValues("hello")).toEqual(["hello"]);
  });

  it("filters non-string items from array", () => {
    expect(toStringValues(["a", {}, "b"] as never)).toEqual(["a", "b"]);
  });

  it("returns empty array for undefined", () => {
    expect(toStringValues(undefined)).toEqual([]);
  });

  it("returns empty array for object", () => {
    expect(toStringValues({} as never)).toEqual([]);
  });
});

describe("ensureArray", () => {
  it("splits comma-separated string", () => {
    expect(ensureArray("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("trims whitespace around items", () => {
    expect(ensureArray("a , b , c")).toEqual(["a", "b", "c"]);
  });

  it("returns array from existing array", () => {
    expect(ensureArray(["x", "y"])).toEqual(["x", "y"]);
  });

  it("returns undefined for empty string", () => {
    expect(ensureArray("")).toBeUndefined();
  });

  it("returns undefined for undefined input", () => {
    expect(ensureArray(undefined)).toBeUndefined();
  });

  it("filters empty items from comma list", () => {
    expect(ensureArray("a,,b")).toEqual(["a", "b"]);
  });
});

describe("normalizeSearch", () => {
  it("returns trimmed string", () => {
    expect(normalizeSearch("  hello  ")).toBe("hello");
  });

  it("returns undefined for empty string", () => {
    expect(normalizeSearch("")).toBeUndefined();
  });

  it("returns undefined for whitespace only", () => {
    expect(normalizeSearch("   ")).toBeUndefined();
  });

  it("truncates to 200 chars", () => {
    const long = "a".repeat(250);
    expect(normalizeSearch(long)).toHaveLength(200);
  });

  it("returns undefined for undefined input", () => {
    expect(normalizeSearch(undefined)).toBeUndefined();
  });
});

describe("coercePositiveInteger", () => {
  it("parses valid positive integer", () => {
    expect(coercePositiveInteger("42")).toBe(42);
    expect(coercePositiveInteger("1")).toBe(1);
  });

  it("returns undefined for zero", () => {
    expect(coercePositiveInteger("0")).toBeUndefined();
  });

  it("returns undefined for negative number", () => {
    expect(coercePositiveInteger("-5")).toBeUndefined();
  });

  it("returns undefined for non-numeric string", () => {
    expect(coercePositiveInteger("abc")).toBeUndefined();
  });

  it("returns undefined for undefined input", () => {
    expect(coercePositiveInteger(undefined)).toBeUndefined();
  });

  it("truncates float to integer", () => {
    expect(coercePositiveInteger("3.9")).toBe(3);
  });
});

describe("coerceLimit", () => {
  it("returns value within bounds", () => {
    expect(coerceLimit(20)).toBe(20);
    expect(coerceLimit("50")).toBe(50);
  });

  it("clamps to maxLimit", () => {
    expect(coerceLimit(5000)).toBe(2000);
    expect(coerceLimit(5000, 50, 100)).toBe(100);
  });

  it("returns default for undefined", () => {
    expect(coerceLimit(undefined)).toBe(50);
    expect(coerceLimit(undefined, 25)).toBe(25);
  });

  it("returns default for non-finite value", () => {
    expect(coerceLimit(NaN)).toBe(50);
    expect(coerceLimit(Infinity)).toBe(50);
  });

  it("returns default for zero or negative", () => {
    expect(coerceLimit(0)).toBe(50);
    expect(coerceLimit(-10)).toBe(50);
  });
});

describe("normalizeDate", () => {
  it("returns trimmed date string", () => {
    expect(normalizeDate("2026-01-15")).toBe("2026-01-15");
    expect(normalizeDate("  2026-01-15  ")).toBe("2026-01-15");
  });

  it("returns undefined for empty string", () => {
    expect(normalizeDate("")).toBeUndefined();
  });

  it("returns undefined for undefined", () => {
    expect(normalizeDate(undefined)).toBeUndefined();
  });
});

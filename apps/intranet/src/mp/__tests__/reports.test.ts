import { describe, expect, it } from "vitest";
import { firstNumber, parseDelimited, toNumber } from "../reports";

describe("firstNumber", () => {
  it("returns first finite number from array", () => {
    expect(firstNumber([undefined, 42, 99])).toBe(42);
  });

  it("returns undefined when all undefined", () => {
    expect(firstNumber([undefined, undefined])).toBeUndefined();
  });

  it("skips Infinity and NaN", () => {
    expect(firstNumber([Infinity, NaN, 5])).toBe(5);
  });

  it("returns 0 as valid value", () => {
    expect(firstNumber([0, 1])).toBe(0);
  });
});

describe("parseDelimited", () => {
  it("splits CSV by comma", () => {
    const result = parseDelimited("a,b,c\n1,2,3");
    expect(result).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("splits by tab", () => {
    const result = parseDelimited("a\tb\tc");
    expect(result).toEqual([["a", "b", "c"]]);
  });

  it("trims cell values", () => {
    const result = parseDelimited(" foo , bar ");
    expect(result[0]).toEqual(["foo", "bar"]);
  });
});

describe("toNumber", () => {
  it("returns undefined for null/undefined", () => {
    expect(toNumber(undefined)).toBeUndefined();
    expect(toNumber("")).toBeUndefined();
  });

  it("parses plain integer", () => {
    expect(toNumber("1234")).toBe(1234);
  });

  it("strips CLP currency prefix", () => {
    expect(toNumber("CLP 1234")).toBe(1234);
    expect(toNumber("$1234")).toBe(1234);
  });

  it("handles comma-decimal with dot-thousands (European mixed)", () => {
    expect(toNumber("1.234,56")).toBe(1234.56);
  });

  it("handles plain decimal with dot", () => {
    expect(toNumber("1234.56")).toBe(1234.56);
  });

  it("returns undefined for non-numeric strings", () => {
    expect(toNumber("abc")).toBeUndefined();
  });

  it("handles negative numbers", () => {
    expect(toNumber("-500")).toBe(-500);
  });
});

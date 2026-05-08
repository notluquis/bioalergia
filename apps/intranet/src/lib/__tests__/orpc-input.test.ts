import { describe, expect, it } from "vitest";
import { compactORPCInput } from "../orpc-input";

describe("compactORPCInput", () => {
  it("returns undefined for undefined input", () => {
    expect(compactORPCInput(undefined)).toBeUndefined();
  });

  it("removes undefined values from object", () => {
    const result = compactORPCInput({ a: 1, b: undefined, c: "hello" });
    expect(result).toEqual({ a: 1, c: "hello" });
  });

  it("returns undefined when all values are undefined", () => {
    const result = compactORPCInput({ a: undefined, b: undefined });
    expect(result).toBeUndefined();
  });

  it("keeps null and false values (only strips undefined)", () => {
    const result = compactORPCInput({ a: null, b: false, c: 0 });
    expect(result).toEqual({ a: null, b: false, c: 0 });
  });

  it("returns non-empty subset when some keys have values", () => {
    const result = compactORPCInput({ page: 1, search: undefined });
    expect(result).toEqual({ page: 1 });
  });
});

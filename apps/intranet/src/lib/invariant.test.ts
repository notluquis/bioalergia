/**
 * Tests for `invariant` — runtime assertion + TS narrowing helper.
 */
import { describe, expect, it } from "vitest";

import { invariant } from "./invariant";

describe("invariant", () => {
  it("does not throw when the condition is truthy", () => {
    expect(() => invariant(true)).not.toThrow();
    expect(() => invariant(1)).not.toThrow();
    expect(() => invariant("non-empty")).not.toThrow();
    expect(() => invariant({})).not.toThrow();
  });

  it("throws when the condition is falsy", () => {
    expect(() => invariant(false)).toThrow(/Invariant failed/);
    expect(() => invariant(0)).toThrow(/Invariant failed/);
    expect(() => invariant("")).toThrow(/Invariant failed/);
    expect(() => invariant(null)).toThrow(/Invariant failed/);
    expect(() => invariant(undefined)).toThrow(/Invariant failed/);
  });

  it("uses the default message when none is provided", () => {
    expect(() => invariant(false)).toThrow("Invariant failed: Invariant failed");
  });

  it("uses a string message when provided", () => {
    expect(() => invariant(false, "user not found")).toThrow("Invariant failed: user not found");
  });

  it("calls a thunk message lazily — never invoked on truthy paths", () => {
    let called = 0;
    invariant(true, () => {
      called += 1;
      return "should not be evaluated";
    });
    expect(called).toBe(0);
  });

  it("calls a thunk message on failure and embeds its return value", () => {
    expect(() => invariant(false, () => "lazy reason")).toThrow("Invariant failed: lazy reason");
  });

  it("narrows the value to non-null after the assertion", () => {
    const value: string | undefined = "hello";
    invariant(value, "should be defined");
    // After invariant, TS treats `value` as `string`. We exercise that branch.
    expect(value.length).toBe(5);
  });
});

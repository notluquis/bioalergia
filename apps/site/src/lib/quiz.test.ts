import { describe, expect, it } from "vitest";

import { answeredCount, nextIndex, prevIndex } from "./quiz";

describe("answeredCount", () => {
  it("returns 0 for an empty array", () => {
    expect(answeredCount([])).toBe(0);
  });

  it("returns 0 when every entry is undefined", () => {
    expect(answeredCount([undefined, undefined])).toBe(0);
  });

  it("counts only defined entries (including 0)", () => {
    expect(answeredCount([0, undefined, 2, undefined, 1])).toBe(3);
  });

  it("counts every entry when all are answered", () => {
    expect(answeredCount([1, 2, 0])).toBe(3);
  });
});

describe("nextIndex", () => {
  it("increments within bounds", () => {
    expect(nextIndex(0, 5)).toBe(1);
  });

  it("clamps to the last index", () => {
    expect(nextIndex(4, 5)).toBe(4);
  });

  it("does not exceed the last index when already past it", () => {
    expect(nextIndex(10, 5)).toBe(4);
  });
});

describe("prevIndex", () => {
  it("decrements within bounds", () => {
    expect(prevIndex(3)).toBe(2);
  });

  it("clamps to 0 at the start", () => {
    expect(prevIndex(0)).toBe(0);
  });

  it("does not go negative", () => {
    expect(prevIndex(-5)).toBe(0);
  });
});

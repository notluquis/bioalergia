import { describe, expect, it } from "vitest";
import { priorityFromScore } from "../scoring";

describe("priorityFromScore", () => {
  it("returns ALTA for scores >= 70", () => {
    expect(priorityFromScore(70)).toBe("ALTA");
    expect(priorityFromScore(85)).toBe("ALTA");
    expect(priorityFromScore(100)).toBe("ALTA");
  });

  it("returns MEDIA for scores 40-69", () => {
    expect(priorityFromScore(40)).toBe("MEDIA");
    expect(priorityFromScore(55)).toBe("MEDIA");
    expect(priorityFromScore(69)).toBe("MEDIA");
  });

  it("returns BAJA for scores below 40", () => {
    expect(priorityFromScore(0)).toBe("BAJA");
    expect(priorityFromScore(20)).toBe("BAJA");
    expect(priorityFromScore(39)).toBe("BAJA");
  });
});

import { describe, expect, it } from "vitest";
import { formatAmount, renderDirection } from "./utils";

describe("renderDirection", () => {
  it("returns 'Ingreso' for IN", () => {
    expect(renderDirection("IN")).toBe("Ingreso");
  });

  it("returns 'Egreso' for OUT", () => {
    expect(renderDirection("OUT")).toBe("Egreso");
  });

  it("returns 'Neutro' for NEUTRO", () => {
    expect(renderDirection("NEUTRO")).toBe("Neutro");
  });
});

describe("formatAmount", () => {
  it("returns a CLP-formatted string for IN direction", () => {
    const result = formatAmount("IN", 50000);
    // Should not start with '-'
    expect(result).not.toMatch(/^-/);
    // Should contain the number
    expect(result).toContain("50");
  });

  it("prefixes '-' for OUT direction", () => {
    const result = formatAmount("OUT", 30000);
    expect(result).toMatch(/^-/);
  });

  it("does not prefix '-' for IN direction", () => {
    const result = formatAmount("IN", 10000);
    expect(result).not.toMatch(/^-/);
  });

  it("formats zero amount for OUT", () => {
    const result = formatAmount("OUT", 0);
    expect(result).toMatch(/^-/);
  });

  it("formats zero amount for IN", () => {
    const result = formatAmount("IN", 0);
    expect(result).not.toMatch(/^-/);
  });

  it("formats NEUTRO direction without prefix", () => {
    const result = formatAmount("NEUTRO", 1000);
    expect(result).not.toMatch(/^-/);
  });
});

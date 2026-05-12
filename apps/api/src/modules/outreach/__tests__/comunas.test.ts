import { describe, expect, it } from "vitest";
import { GRAN_CONCEPCION_COMUNAS, isGranConcepcion, normalizeComuna } from "../comunas.ts";

describe("normalizeComuna", () => {
  it("uppercases and trims", () => {
    expect(normalizeComuna("  concepción  ")).toBe("CONCEPCION");
  });

  it("strips accents", () => {
    expect(normalizeComuna("San Pedró dé lá Paz")).toBe("SAN PEDRO DE LA PAZ");
  });

  it("replaces ñ with N", () => {
    expect(normalizeComuna("Hualpén")).toBe("HUALPEN");
  });

  it("returns empty string for null/undefined", () => {
    expect(normalizeComuna(null)).toBe("");
    expect(normalizeComuna(undefined)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(normalizeComuna("")).toBe("");
  });
});

describe("isGranConcepcion", () => {
  it("returns true for known communes", () => {
    for (const c of GRAN_CONCEPCION_COMUNAS) {
      expect(isGranConcepcion(c)).toBe(true);
    }
  });

  it("is case-insensitive and accent-insensitive", () => {
    expect(isGranConcepcion("concepción")).toBe(true);
    expect(isGranConcepcion("talcahuano")).toBe(true);
    expect(isGranConcepcion("Hualpén")).toBe(true);
  });

  it("returns false for unknown commune", () => {
    expect(isGranConcepcion("Santiago")).toBe(false);
    expect(isGranConcepcion("Viña del Mar")).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isGranConcepcion(null)).toBe(false);
    expect(isGranConcepcion(undefined)).toBe(false);
  });
});

import jaroWinkler from "talisman/metrics/jaro-winkler.js";
import { symmetric as mongeElkanSymmetric } from "talisman/metrics/monge-elkan.js";
import { describe, expect, it } from "vitest";

// Mirrors match.ts::fuzzyNameScore so we can assert the near-miss recovery
// without exporting internals.
function score(a: string, b: string): number {
  const at = a.toLowerCase().split(/\s+/).filter(Boolean).sort();
  const bt = b.toLowerCase().split(/\s+/).filter(Boolean).sort();
  return mongeElkanSymmetric(jaroWinkler, at, bt);
}

describe("fuzzy name score (Monge-Elkan + Jaro-Winkler)", () => {
  it("typo en apellido → ≥0.9 (Villegas~Vellegas)", () => {
    expect(score("militina burgoa villegas", "militina burgoa vellegas")).toBeGreaterThanOrEqual(0.9);
  });
  it("typo en nombre → ≥0.9 (Virgina~Virginia)", () => {
    expect(score("maria virgina pino seguel", "maria virginia pino seguel")).toBeGreaterThanOrEqual(0.9);
  });
  it("2º nombre extra no penaliza → ≥0.9", () => {
    expect(score("mateo alonso ruiz chamorro", "mateo ruiz chamorro")).toBeGreaterThanOrEqual(0.9);
  });
  it("orden de tokens no importa", () => {
    expect(score("ruminot jose", "jose ruminot")).toBeGreaterThanOrEqual(0.95);
  });
  it("personas distintas NO llegan a 0.9", () => {
    expect(score("juan perez gonzalez", "pedro soto ramirez")).toBeLessThan(0.9);
  });
});

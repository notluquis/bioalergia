import { describe, expect, it } from "vitest";
import { toStoredDiagnoses, toStoredMedications } from "./certificate.schema.ts";

describe("toStoredMedications", () => {
  it("omits undefined posology keys (ZenStack Json rejects undefined)", () => {
    const out = toStoredMedications([
      { name: "Loratadina", dosage: undefined, frequency: undefined, duration: undefined },
    ]);
    expect(out).toEqual([{ name: "Loratadina" }]);
    // la clave NO debe existir (no `{ dosage: undefined }`).
    expect(Object.keys(out[0])).toEqual(["name"]);
    expect(JSON.stringify(out[0])).toBe('{"name":"Loratadina"}');
  });

  it("keeps present fields", () => {
    const out = toStoredMedications([
      {
        name: "Salbutamol",
        dosage: "2 inhalaciones",
        frequency: "cada 8 horas",
        duration: "7 días",
        instructions: "Enjuagar boca",
      },
    ]);
    expect(out[0]).toEqual({
      name: "Salbutamol",
      dosage: "2 inhalaciones",
      frequency: "cada 8 horas",
      duration: "7 días",
      instructions: "Enjuagar boca",
    });
  });

  it("drops empty-string posology (falsy) too", () => {
    const out = toStoredMedications([{ name: "X", dosage: "", instructions: "" }]);
    expect(Object.keys(out[0])).toEqual(["name"]);
  });
});

describe("toStoredDiagnoses", () => {
  it("keeps required keys, omits absent optionals", () => {
    const out = toStoredDiagnoses([
      { id: "abc", label: "Rinitis", source: "CIE-11", code: "CA08.0" },
    ]);
    expect(out[0]).toEqual({ id: "abc", label: "Rinitis", source: "CIE-11", code: "CA08.0" });
    expect(JSON.stringify(out[0])).not.toContain("undefined");
  });

  it("preserves custom=false explicitly", () => {
    const out = toStoredDiagnoses([
      { id: "x", label: "Y", source: "CUSTOM", custom: false },
    ]);
    expect(out[0].custom).toBe(false);
  });
});

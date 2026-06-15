import { describe, expect, it } from "vitest";
import type { DoctorSelection } from "../data/types";
import { calculate } from "./useScitCalculator";

function sel(
  overrides: Partial<DoctorSelection> & Pick<DoctorSelection, "selectedAllergenIds">
): DoctorSelection {
  return { provider: "inmunotek", ...overrides };
}

describe("calculate — empty / guards", () => {
  it("returns empty result for no selection", () => {
    const r = calculate(sel({ selectedAllergenIds: [] }));
    expect(r.vials).toHaveLength(0);
    expect(r.alerts).toHaveLength(0);
    expect(r.summary).toBe("");
  });

  it("ignores unknown allergen ids", () => {
    const r = calculate(sel({ selectedAllergenIds: ["does_not_exist"] }));
    expect(r.vials).toHaveLength(0);
  });
});

describe("Regla 1 — Monosensibilización", () => {
  it("single non-fungal allergen → 1 ESTANDAR vial", () => {
    const r = calculate(sel({ selectedAllergenIds: ["acaro_dpt"] }));
    expect(r.vials).toHaveLength(1);
    expect(r.vials[0]?.formulation).toBe("ESTANDAR");
    expect(r.rulesApplied).toContain("Regla 1: Monosensibilización");
  });
});

describe("Regla 2 — Polisensibilización simétrica", () => {
  it("N=2 equal → single MAX vial with both allergens", () => {
    const r = calculate(
      sel({ selectedAllergenIds: ["acaro_dpt", "gramineas_mix"], relevanceMode: "equal" })
    );
    expect(r.vials).toHaveLength(1);
    expect(r.vials[0]?.formulation).toBe("MAX");
    expect(r.vials[0]?.allergens).toHaveLength(2);
    expect(r.rulesApplied).toContain("Regla 2: Polisensibilización Simétrica");
  });

  it("N=3 equal → single MAX vial with three allergens", () => {
    const r = calculate(sel({ selectedAllergenIds: ["acaro_dpt", "gramineas_mix", "olivo"] }));
    expect(r.vials).toHaveLength(1);
    expect(r.vials[0]?.allergens).toHaveLength(3);
    expect(r.vials[0]?.formulation).toBe("MAX");
  });
});

describe("Regla 3 — Polisensibilización asimétrica", () => {
  it("dominant_split N=2 → two individual ESTANDAR vials, dominant flagged", () => {
    const r = calculate(
      sel({
        selectedAllergenIds: ["acaro_dpt", "gato"],
        relevanceMode: "dominant_split",
        dominantAllergenId: "acaro_dpt",
      })
    );
    expect(r.vials).toHaveLength(2);
    expect(r.vials.every((v) => v.formulation === "ESTANDAR")).toBe(true);
    const dominantEntry = r.vials.flatMap((v) => v.allergens).find((e) => e.isDominant);
    expect(dominantEntry?.allergen.id).toBe("acaro_dpt");
  });

  it("dominant_split N=3 → dominant alone + secondaries in MAX vial", () => {
    const r = calculate(
      sel({
        selectedAllergenIds: ["acaro_dpt", "gramineas_mix", "olivo"],
        relevanceMode: "dominant_split",
        dominantAllergenId: "acaro_dpt",
      })
    );
    expect(r.vials).toHaveLength(2);
    const secondaries = r.vials.find((v) => v.label === "Secundarios");
    expect(secondaries?.formulation).toBe("MAX");
    expect(secondaries?.allergens).toHaveLength(2);
  });

  it("dominant_max → single MAX vial, dominant flagged", () => {
    const r = calculate(
      sel({
        selectedAllergenIds: ["acaro_dpt", "gato"],
        relevanceMode: "dominant_max",
        dominantAllergenId: "acaro_dpt",
      })
    );
    expect(r.vials).toHaveLength(1);
    expect(r.vials[0]?.formulation).toBe("MAX");
    expect(r.vials[0]?.allergens.find((e) => e.isDominant)?.allergen.id).toBe("acaro_dpt");
  });
});

describe("Regla 4 — Saturación molecular (N>3) — máx 3 por frasco", () => {
  it("5 perennials → split into vials of ≤3 (3 + 2)", () => {
    const r = calculate(
      sel({ selectedAllergenIds: ["acaro_dpt", "acaro_df", "acaro_bt", "gato", "perro"] })
    );
    expect(r.rulesApplied).toContain("Regla 4: Saturación Molecular");
    // Never more than 3 allergens in any vial
    expect(r.vials.every((v) => v.allergens.length <= 3)).toBe(true);
    expect(r.vials).toHaveLength(2);
    expect(r.vials.map((v) => v.label)).toEqual(["Perennes 1", "Perennes 2"]);
  });

  it("perennials + seasonals split into separate labelled vials", () => {
    const r = calculate(
      sel({ selectedAllergenIds: ["acaro_dpt", "gato", "gramineas_mix", "olivo", "abedul"] })
    );
    const labels = r.vials.map((v) => v.label);
    expect(labels).toContain("Perennes");
    expect(labels).toContain("Estacionales");
    expect(r.vials.every((v) => v.allergens.length <= 3)).toBe(true);
  });

  it("8 seasonals → 3 vials (3+3+2), none over the cap", () => {
    const r = calculate(
      sel({
        selectedAllergenIds: [
          "gramineas_mix",
          "olivo",
          "abedul",
          "platano_oriental",
          "cipres",
          "ambrosia",
          "parietaria",
        ],
      })
    );
    expect(r.vials.every((v) => v.allergens.length <= 3)).toBe(true);
  });
});

describe("Regla 5 — Excepción proteolítica", () => {
  it("Alternaria isolated in a MODIGOID vial + warning", () => {
    const r = calculate(sel({ selectedAllergenIds: ["alternaria"] }));
    expect(r.vials).toHaveLength(1);
    expect(r.vials[0]?.formulation).toBe("MODIGOID");
    expect(r.alerts.some((a) => a.ruleTriggered === "Regla 5" && a.severity === "warning")).toBe(
      true
    );
  });

  it("Cladosporium (no molecular standard) → DEPOT vial + danger alert, no Modigoid", () => {
    const r = calculate(sel({ selectedAllergenIds: ["cladosporium"] }));
    expect(r.vials).toHaveLength(1);
    expect(r.vials[0]?.formulation).toBe("DEPOT");
    expect(r.vials[0]?.formulation).not.toBe("MODIGOID");
    expect(r.vials[0]?.allergens[0]?.displayDose).toBe("Sin estandarizar");
    expect(r.alerts.some((a) => a.ruleTriggered === "Regla 5" && a.severity === "danger")).toBe(
      true
    );
  });

  it("alert names the actual isolated fungus, not a hardcoded 'Alternaria'", () => {
    const r = calculate(sel({ selectedAllergenIds: ["cladosporium"] }));
    const warn = r.alerts.find((a) => a.ruleTriggered === "Regla 5" && a.severity === "warning");
    expect(warn?.message).toContain("Cladosporium");
    expect(warn?.message).not.toContain("Alternaria");
  });

  it("Alternaria + non-fungal → Modigoid vial separate from the rest", () => {
    const r = calculate(sel({ selectedAllergenIds: ["alternaria", "gato"] }));
    expect(r.vials).toHaveLength(2);
    const modigoid = r.vials.find((v) => v.formulation === "MODIGOID");
    expect(modigoid?.allergens).toHaveLength(1);
    expect(modigoid?.allergens[0]?.allergen.id).toBe("alternaria");
  });
});

describe("Ventana terapéutica EAACI (5–20 µg)", () => {
  it("flags a sub-therapeutic dose (Perro = 4 µg < 5)", () => {
    const r = calculate(sel({ selectedAllergenIds: ["perro"] }));
    expect(r.alerts.some((a) => a.ruleTriggered === "Ventana terapéutica")).toBe(true);
  });

  it("does NOT flag a dose inside the window (Gato = 5 µg)", () => {
    const r = calculate(sel({ selectedAllergenIds: ["gato"] }));
    expect(r.alerts.some((a) => a.ruleTriggered === "Ventana terapéutica")).toBe(false);
  });

  it("does NOT flag Modigoid (Alternaria 2 µg is outside the UT matrix)", () => {
    const r = calculate(sel({ selectedAllergenIds: ["alternaria"] }));
    expect(r.alerts.some((a) => a.ruleTriggered === "Ventana terapéutica")).toBe(false);
  });
});

describe("Diater — unidades", () => {
  it("never reports UT and always uses displayDose; emits ficha-técnica notice", () => {
    const r = calculate(
      sel({ provider: "diater", selectedAllergenIds: ["acaro_dpt", "acaro_df"] })
    );
    const entries = r.vials.flatMap((v) => v.allergens);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((e) => e.concentrationUtMl === 0)).toBe(true);
    expect(entries.every((e) => Boolean(e.displayDose))).toBe(true);
    expect(r.alerts.some((a) => a.ruleTriggered === "Diater")).toBe(true);
  });
});

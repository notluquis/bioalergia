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

describe("Regla 1 — Monosensibilización (Inmunotek/Roxall = UT, no µg)", () => {
  it("single non-fungal allergen → 1 ESTANDAR vial dosed in UT", () => {
    const r = calculate(sel({ selectedAllergenIds: ["acaro_dpt"] }));
    expect(r.vials).toHaveLength(1);
    expect(r.vials[0]?.formulation).toBe("ESTANDAR");
    const entry = r.vials[0]?.allergens[0];
    expect(entry?.doseDisplay).toContain("UT");
    expect(entry?.doseDisplay).not.toContain("µg");
    expect(entry?.injectedUg).toBeUndefined();
    expect(r.rulesApplied).toContain("Regla 1: Monosensibilización");
  });

  it("standard maintenance shows 5.000 UT (10.000 UT/mL × 0.5 mL)", () => {
    const r = calculate(sel({ selectedAllergenIds: ["gato"] }));
    expect(r.vials[0]?.allergens[0]?.doseDisplay).toBe("5.000 UT");
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

  it("7 seasonals → 3 vials (3+3+1), none over the cap", () => {
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

describe("Regla 5 — Hongos aislados (provider-specific)", () => {
  it("Roxall + Alternaria → MODIGOID vial with verified 2 µg dose + source", () => {
    const r = calculate(sel({ provider: "roxall", selectedAllergenIds: ["alternaria"] }));
    expect(r.vials).toHaveLength(1);
    expect(r.vials[0]?.formulation).toBe("MODIGOID");
    const entry = r.vials[0]?.allergens[0];
    expect(entry?.injectedUg).toBeCloseTo(2.0);
    expect(entry?.doseDisplay).toContain("µg");
    expect(entry?.doseSource).toContain("Modigoid");
    expect(r.alerts.some((a) => a.ruleTriggered === "Regla 5" && a.severity === "warning")).toBe(
      true
    );
  });

  it("Inmunotek + Alternaria → isolated ESTANDAR (Alternaria polimerizada, UT), not Modigoid", () => {
    const r = calculate(sel({ provider: "inmunotek", selectedAllergenIds: ["alternaria"] }));
    expect(r.vials).toHaveLength(1);
    expect(r.vials[0]?.formulation).toBe("ESTANDAR");
    expect(r.vials[0]?.allergens[0]?.doseDisplay).toContain("UT");
  });

  it("Cladosporium (no molecular standard) → DEPOT vial + danger alert", () => {
    const r = calculate(sel({ selectedAllergenIds: ["cladosporium"] }));
    expect(r.vials).toHaveLength(1);
    expect(r.vials[0]?.formulation).toBe("DEPOT");
    expect(r.vials[0]?.allergens[0]?.doseDisplay).toBe("Según ficha (no estandarizado)");
    expect(r.vials[0]?.allergens[0]?.injectedUg).toBeUndefined();
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

  it("Roxall: Alternaria + non-fungal → Modigoid vial separate from the rest", () => {
    const r = calculate(sel({ provider: "roxall", selectedAllergenIds: ["alternaria", "gato"] }));
    expect(r.vials).toHaveLength(2);
    const modigoid = r.vials.find((v) => v.formulation === "MODIGOID");
    expect(modigoid?.allergens).toHaveLength(1);
    expect(modigoid?.allergens[0]?.allergen.id).toBe("alternaria");
  });
});

describe("Ventana terapéutica — solo aplica a µg convencional", () => {
  it("UT-path allergens carry no µg → no window alert (Perro)", () => {
    const r = calculate(sel({ selectedAllergenIds: ["perro"] }));
    expect(r.alerts.some((a) => a.ruleTriggered === "Ventana terapéutica")).toBe(false);
  });

  it("Modigoid molecular allergoid is exempt (2 µg does not flag)", () => {
    const r = calculate(sel({ provider: "roxall", selectedAllergenIds: ["alternaria"] }));
    expect(r.alerts.some((a) => a.ruleTriggered === "Ventana terapéutica")).toBe(false);
  });
});

describe("Diater — unidades reales del SmPC", () => {
  it("molecular mites: µg/mL real, never UT, with SmPC source + Diater notice", () => {
    const r = calculate(
      sel({ provider: "diater", selectedAllergenIds: ["acaro_dpt", "acaro_df"] })
    );
    const entries = r.vials.flatMap((v) => v.allergens);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((e) => !e.doseDisplay.includes("UT"))).toBe(true);
    expect(entries.every((e) => Boolean(e.doseSource))).toBe(true);
    // Der p 1 has a verified molecular µg/mL; Der f has none → qualitative
    const dpt = entries.find((e) => e.allergen.id === "acaro_dpt");
    expect(dpt?.doseDisplay).toContain("µg/mL molecular");
    expect(r.alerts.some((a) => a.ruleTriggered === "Diater")).toBe(true);
  });

  it("polymerized fallback (no molecular base) → relative-dilution display", () => {
    const r = calculate(sel({ provider: "diater", selectedAllergenIds: ["gramineas_mix"] }));
    expect(r.vials[0]?.allergens[0]?.doseDisplay).toBe("Dilución relativa (ficha)");
  });
});

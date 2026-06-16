import { useMemo } from "react";
import {
  getAllergenById,
  INJECTION_VOLUME_ML,
  PERENNIAL_FAMILIES,
  STANDARD_CONCENTRATION_UT_ML,
  THERAPEUTIC_WINDOW_MAX_UG,
  THERAPEUTIC_WINDOW_MIN_UG,
} from "../data/allergens_db";
import type {
  Allergen,
  ClinicalAlert,
  DoctorSelection,
  FormulationType,
  InjectionSite,
  InjectionEquivalence,
  Provider,
  ScitCalculationResult,
  Vial,
  VialAllergenEntry,
} from "../data/types";

/** Máximo de alérgenos por frasco (estabilidad proteica / competición antigénica). */
const MAX_ALLERGENS_PER_VIAL = 3;

const MODIGOID_SOURCE = "Roxall Modigoid ficha §2 + Brindisi 2025 (PMID 40095008)";
const DIATER_SOURCE = "Diater SmPC (ficha técnica)";

function ug(value: number): string {
  return `${value.toLocaleString("es-CL", { maximumFractionDigits: 2 })} µg`;
}

// ─── Entry builders (unidad correcta por producto) ───────────────────────────

/**
 * Inmunotek / Roxall polimerizado: unidad UT, sin µg. Para alérgenos-mezcla
 * (Dpt+Df) el UT del slot se REPARTE entre las especies (10.000 → 5.000 c/u).
 */
function utEntry(
  allergen: Allergen,
  opts: { utPerMl: number; volumeMl: number; isDominant?: boolean }
): VialAllergenEntry {
  const ut = Math.round(opts.utPerMl * opts.volumeMl);
  const comps = allergen.componentLabels;
  const doseDisplay =
    comps && comps.length > 1
      ? `${ut.toLocaleString("es-CL")} UT (${Math.round(ut / comps.length).toLocaleString(
          "es-CL"
        )} UT c/u: ${comps.join(" · ")})`
      : `${ut.toLocaleString("es-CL")} UT`;
  return {
    allergen,
    doseDisplay,
    isDominant: opts.isDominant ?? false,
  };
}

/** Roxall Modigoid (alergoide molecular Alt a 1): µg reales. */
function modigoidEntry(allergen: Allergen, volumeMl: number): VialAllergenEntry {
  const injectedUg = (allergen.modigoidUgPerMl ?? 0) * volumeMl;
  return {
    allergen,
    doseDisplay: ug(injectedUg),
    injectedUg,
    doseSource: MODIGOID_SOURCE,
    isDominant: false,
  };
}

/** Hongo sin estandarización molecular (Cladosporium): dosis no calculable. */
function unstandardizedEntry(allergen: Allergen): VialAllergenEntry {
  return {
    allergen,
    doseDisplay: "Según ficha (no estandarizado)",
    isDominant: false,
  };
}

/** Diater molecular: µg/mL reales del SmPC (exento de la ventana convencional). */
function diaterMolecularEntry(allergen: Allergen): VialAllergenEntry {
  const ugMl = allergen.diaterMolecularUgPerMl;
  return {
    allergen,
    doseDisplay:
      ugMl != null
        ? `${ugMl.toLocaleString("es-CL", { maximumFractionDigits: 2 })} µg/mL molecular`
        : "Molecular (ficha)",
    doseSource: DIATER_SOURCE,
    isDominant: false,
  };
}

/** Diater extracto polimerizado: potencia biológica HEPD (sin µg). */
function diaterHepdEntry(allergen: Allergen): VialAllergenEntry {
  return {
    allergen,
    doseDisplay: "HEPD (potencia biológica)",
    doseSource: DIATER_SOURCE,
    isDominant: false,
  };
}

/** Diater Depot / Polymerized: diluciones relativas, sin µg en ficha. */
function diaterDilutionEntry(allergen: Allergen): VialAllergenEntry {
  return {
    allergen,
    doseDisplay: "Dilución relativa (ficha)",
    doseSource: DIATER_SOURCE,
    isDominant: false,
  };
}

// ─── Generic helpers ─────────────────────────────────────────────────────────

function buildVial(opts: {
  vialNumber: number;
  label: string;
  formulation: FormulationType;
  allergens: VialAllergenEntry[];
  injectionSite: InjectionSite;
  rationale: string;
  equivalences?: InjectionEquivalence[];
  injectionVolumeMl?: number;
}): Vial {
  return {
    ...opts,
    injectionVolumeMl: opts.injectionVolumeMl ?? INJECTION_VOLUME_ML,
  };
}

function nextSite(existingVials: Vial[]): InjectionSite {
  return existingVials.length % 2 === 0 ? "brazo_derecho" : "brazo_izquierdo";
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Valida cada dosis µg de extracto CONVENCIONAL contra la ventana EAACI (5–20 µg).
 * Se omiten: viales MODIGOID y entradas sin injectedUg (UT, HEPD, molecular Diater
 * = paradigmas exentos). Con los datos actuales (UT, no µg) normalmente no dispara;
 * queda como red de seguridad si se incorpora una cifra µg convencional verificada.
 */
function appendTherapeuticWindowAlerts(vials: Vial[], alerts: ClinicalAlert[]): void {
  const below: string[] = [];
  const above: string[] = [];

  for (const vial of vials) {
    if (vial.formulation === "MODIGOID") continue;
    for (const entry of vial.allergens) {
      const dose = entry.injectedUg;
      if (dose == null || dose <= 0) continue;
      if (dose < THERAPEUTIC_WINDOW_MIN_UG) below.push(`${entry.allergen.name} (${ug(dose)})`);
      else if (dose > THERAPEUTIC_WINDOW_MAX_UG) above.push(`${entry.allergen.name} (${ug(dose)})`);
    }
  }

  if (below.length > 0) {
    alerts.push({
      severity: "warning",
      ruleTriggered: "Ventana terapéutica",
      message: `Dosis por debajo del mínimo EAACI (${THERAPEUTIC_WINDOW_MIN_UG} µg): ${below.join(
        ", "
      )}. Riesgo de subdosificación; verifique la concentración en ficha técnica.`,
    });
  }
  if (above.length > 0) {
    alerts.push({
      severity: "warning",
      ruleTriggered: "Ventana terapéutica",
      message: `Dosis por encima del máximo EAACI (${THERAPEUTIC_WINDOW_MAX_UG} µg): ${above.join(
        ", "
      )}. Riesgo de reacción sistémica; considere ajustar el volumen inyectado.`,
    });
  }
}

function getEquivalences(
  provider: Provider,
  formulation: FormulationType
): InjectionEquivalence[] | undefined {
  const eqs: InjectionEquivalence[] = [];
  const VIAL_ML = 2.5; // volumen estándar a granel asumido para "dosis por vial"

  if (provider === "diater") {
    if (formulation === "MOL") {
      eqs.push({
        formulationName: "Molecular Nativo (MOL)",
        concentrationString: "µg/mL según alérgeno (SmPC)",
        requiredVolumeMl: 0.8,
        dosesPerVial: Math.floor(VIAL_ML / 0.8),
      });
    } else {
      eqs.push({
        formulationName: formulation === "MOL_MIX" ? "MOL Mix" : "Polimerizado",
        concentrationString: "HEPD según extracto (SmPC)",
        requiredVolumeMl: 0.5,
        dosesPerVial: Math.floor(VIAL_ML / 0.5),
      });
    }
    return eqs;
  }

  // Inmunotek / Roxall (homólogos: Clustek↔Cluxin estándar; Clustek MAX↔Poliplus)
  if (formulation === "ESTANDAR") {
    const baseName = provider === "inmunotek" ? "Clustek/Clustoid (Inmunotek)" : "Cluxin (Roxall)";
    eqs.push({
      formulationName: baseName,
      concentrationString: "10.000 UT/mL",
      requiredVolumeMl: 0.5,
      dosesPerVial: Math.floor(VIAL_ML / 0.5),
    });

    if (provider === "inmunotek") {
      // FORTE monosensibilización (30.000 UT/mL) — SÍ se importa a Chile.
      // Roxall NO tiene homólogo de FORTE. MAX FORTE no se trae a Chile.
      const forteVolume = 0.17; // 5000 UT a 30.000 UT/mL ≈ 0.17 mL
      eqs.push({
        formulationName: "Clustek FORTE",
        concentrationString: "30.000 UT/mL (1 extracto)",
        requiredVolumeMl: forteVolume,
        dosesPerVial: Math.floor(VIAL_ML / forteVolume),
      });
    }
  } else if (formulation === "MAX") {
    // Poliplus (Roxall) = homólogo de Clustek MAX: 10.000 UT/mL por alérgeno, máx 3.
    const baseName = provider === "inmunotek" ? "Clustek MAX (Inmunotek)" : "Poliplus (Roxall)";
    eqs.push({
      formulationName: baseName,
      concentrationString: "10.000 UT/mL por alérgeno (máx 3, sin dilución entre slots)",
      requiredVolumeMl: 0.5,
      dosesPerVial: Math.floor(VIAL_ML / 0.5),
    });
  } else if (formulation === "MODIGOID") {
    eqs.push({
      formulationName: "Modigoid (Roxall)",
      concentrationString: "4,0 µg/mL Alt a 1",
      requiredVolumeMl: 0.5,
      dosesPerVial: Math.floor(VIAL_ML / 0.5),
    });
  } else if (formulation === "DEPOT") {
    eqs.push({
      formulationName: "Extracto depot nativo",
      concentrationString: "Según ficha técnica",
      requiredVolumeMl: 0.5,
      dosesPerVial: Math.floor(VIAL_ML / 0.5),
    });
  }

  return eqs.length > 0 ? eqs : undefined;
}

// ─── Diater Rules Engine ───────────────────────────────────────────────────────

function calculateDiater(selectedAllergens: Allergen[]): ScitCalculationResult {
  const vials: Vial[] = [];
  const alerts: ClinicalAlert[] = [];
  const rulesApplied: string[] = [];

  const isOnlyAlternaria = selectedAllergens.length === 1 && selectedAllergens[0]?.isProteolytic;
  const hasAlternaria = selectedAllergens.some((a) => a.isProteolytic);

  const isOnlyMites =
    selectedAllergens.length > 0 && selectedAllergens.every((a) => a.family === "acaros");
  const hasMites = selectedAllergens.some((a) => a.family === "acaros");

  const isOnlyCypress = selectedAllergens.length === 1 && selectedAllergens[0]?.id === "cipres";
  const hasCypress = selectedAllergens.some((a) => a.id === "cipres");

  if (isOnlyMites) {
    rulesApplied.push("Diater: Base Ácaros Pura");
    vials.push(
      buildVial({
        vialNumber: 1,
        label: "MOLMite",
        formulation: "MOL",
        allergens: selectedAllergens.map(diaterMolecularEntry),
        injectionSite: "brazo_derecho",
        rationale: "Fórmula molecular preensamblada de ácaros (Der p 1 / Der p 2), µg/mL por SmPC.",
        equivalences: getEquivalences("diater", "MOL"),
        injectionVolumeMl: 0.8,
      })
    );
  } else if (hasMites && selectedAllergens.length > 1) {
    rulesApplied.push("Diater: Base Ácaros + Polimerizado");
    vials.push(
      buildVial({
        vialNumber: 1,
        label: "MOLMite Mix",
        formulation: "MOL_MIX",
        allergens: selectedAllergens.map((a) =>
          a.family === "acaros" ? diaterMolecularEntry(a) : diaterHepdEntry(a)
        ),
        injectionSite: "brazo_derecho",
        rationale:
          "MOLMite Mix: base molecular de ácaros (µg/mL) + extractos polimerizados (HEPD) para polisensibilización.",
        equivalences: getEquivalences("diater", "MOL_MIX"),
      })
    );
  } else if (isOnlyAlternaria) {
    rulesApplied.push("Diater: Base Alternaria Pura");
    vials.push(
      buildVial({
        vialNumber: 1,
        label: "Alt a 1 MOL",
        formulation: "MOL",
        allergens: selectedAllergens.map(diaterMolecularEntry),
        injectionSite: "brazo_derecho",
        rationale: "Fórmula molecular nativa de Alternaria (Alt a 1), µg/mL por SmPC.",
        equivalences: getEquivalences("diater", "MOL"),
        injectionVolumeMl: 0.8,
      })
    );
  } else if (hasAlternaria && selectedAllergens.length > 1) {
    rulesApplied.push("Diater: Base Alternaria + Polimerizado");
    vials.push(
      buildVial({
        vialNumber: 1,
        label: "Alt a 1 MOL Mix",
        formulation: "MOL_MIX",
        allergens: selectedAllergens.map((a) =>
          a.isProteolytic ? diaterMolecularEntry(a) : diaterHepdEntry(a)
        ),
        injectionSite: "brazo_derecho",
        rationale: "Alt a 1 MOL Mix: base molecular de Alternaria (µg/mL) + polimerizados (HEPD).",
        equivalences: getEquivalences("diater", "MOL_MIX"),
      })
    );
  } else if (isOnlyCypress) {
    rulesApplied.push("Diater: Base Ciprés Pura");
    vials.push(
      buildVial({
        vialNumber: 1,
        label: "Cup a 1 MOL",
        formulation: "MOL",
        allergens: selectedAllergens.map(diaterMolecularEntry),
        injectionSite: "brazo_derecho",
        rationale: "Fórmula molecular nativa de Ciprés (Cup a 1, 3,0 µg/mL SmPC).",
        equivalences: getEquivalences("diater", "MOL"),
        injectionVolumeMl: 0.8,
      })
    );
  } else if (hasCypress && selectedAllergens.length > 1) {
    rulesApplied.push("Diater: Base Ciprés + Polimerizado");
    vials.push(
      buildVial({
        vialNumber: 1,
        label: "Cup a 1 MOL Mix",
        formulation: "MOL_MIX",
        allergens: selectedAllergens.map((a) =>
          a.id === "cipres" ? diaterMolecularEntry(a) : diaterHepdEntry(a)
        ),
        injectionSite: "brazo_derecho",
        rationale: "Cup a 1 MOL Mix: base molecular de Ciprés (µg/mL) + polimerizados (HEPD).",
        equivalences: getEquivalences("diater", "MOL_MIX"),
      })
    );
  } else {
    const n = selectedAllergens.length;
    const form: FormulationType = n <= 3 ? "POLYMERIZED_100" : "POLYMERIZED";
    const label = n <= 3 ? "Polymerized 100" : "Polymerized";
    rulesApplied.push(`Diater: Extracto Polimerizado (N=${n})`);

    vials.push(
      buildVial({
        vialNumber: 1,
        label,
        formulation: form,
        allergens: selectedAllergens.map(diaterDilutionEntry),
        injectionSite: "brazo_derecho",
        rationale:
          "Allergoide polimerizado a medida (sin aluminio); concentración por diluciones relativas (1/100, 1/10, máxima) según ficha.",
        equivalences: getEquivalences("diater", form),
      })
    );
  }

  alerts.push({
    severity: "info",
    ruleTriggered: "Diater",
    message:
      "Diater se dosifica según su SmPC: moleculares en µg/mL, polimerizados en HEPD, y Depot/Polymerized en diluciones relativas. No aplica la escala UT de Inmunotek/Roxall ni una ventana µg convencional.",
  });

  const totalA = selectedAllergens.length;
  const totalV = vials.length;
  const summary = `${totalA} alérgeno${totalA > 1 ? "s" : ""} seleccionado${totalA > 1 ? "s" : ""} → ${totalV} vial${totalV > 1 ? "es" : ""} recomendado${totalV > 1 ? "s" : ""}. (Diater SCIT)`;

  return { vials, alerts, rulesApplied, summary };
}

// ─── Inmunotek / Roxall Rules Engine ─────────────────────────────────────────

function calculateInmunotekRoxall(
  selection: DoctorSelection,
  selectedAllergens: Allergen[]
): ScitCalculationResult {
  const { relevanceMode, dominantAllergenId, provider } = selection;
  const STD = STANDARD_CONCENTRATION_UT_ML;

  const vials: Vial[] = [];
  const alerts: ClinicalAlert[] = [];
  const rulesApplied: string[] = [];

  const stdEntry = (a: Allergen, isDominant = false): VialAllergenEntry =>
    utEntry(a, { utPerMl: STD, volumeMl: INJECTION_VOLUME_ML, isDominant });

  // ═══════════════════════════════════════════════════════════════════════════
  // REGLA 5 — Hongos en frasco separado
  //  - Alternaria: alergoide molecular dedicado. Roxall = Modigoid (4,0 µg/mL →
  //    2,0 µg/0,5 mL). Inmunotek = Alternaria polimerizada (Clustoid, UT).
  //  - Cladosporium u hongos sin estandarización molecular: extracto depot nativo,
  //    dosis NO calculable → se advierte.
  // ═══════════════════════════════════════════════════════════════════════════
  const proteolytic = selectedAllergens.filter((a) => a.isProteolytic);
  const remaining = selectedAllergens.filter((a) => !a.isProteolytic);

  if (proteolytic.length > 0) {
    rulesApplied.push("Regla 5: Hongos aislados");

    for (const fungus of proteolytic) {
      const standardized = fungus.modigoidUgPerMl != null || fungus.diaterMolecularUgPerMl != null;

      if (standardized && provider === "roxall") {
        vials.push(
          buildVial({
            vialNumber: vials.length + 1,
            label: `${fungus.name} (Modigoid)`,
            formulation: "MODIGOID",
            allergens: [modigoidEntry(fungus, INJECTION_VOLUME_ML)],
            injectionSite: nextSite(vials),
            rationale:
              "Alt a 1 se aísla en un alergoide molecular dedicado (Roxall Modigoid, 4,0 µg/mL → 2,0 µg en 0,5 mL). La polimerización enmascara epítopos IgE preservando inmunogenicidad.",
            equivalences: getEquivalences(provider, "MODIGOID"),
          })
        );
      } else if (standardized && provider === "inmunotek") {
        vials.push(
          buildVial({
            vialNumber: vials.length + 1,
            label: `${fungus.name} (Alternaria polimerizada)`,
            formulation: "ESTANDAR",
            allergens: [stdEntry(fungus)],
            injectionSite: nextSite(vials),
            rationale:
              "Inmunotek ofrece Alternaria polimerizada (Clustoid) dosificada en UT; se aísla en frasco separado del resto.",
            equivalences: getEquivalences(provider, "ESTANDAR"),
          })
        );
      } else {
        vials.push(
          buildVial({
            vialNumber: vials.length + 1,
            label: `${fungus.name} (aislado)`,
            formulation: "DEPOT",
            allergens: [unstandardizedEntry(fungus)],
            injectionSite: nextSite(vials),
            rationale:
              "Hongo sin estandarización molecular publicada. Se aísla en extracto depot nativo; la dosis se ajusta según ficha técnica del fabricante.",
            equivalences: getEquivalences(provider, "DEPOT"),
          })
        );
      }
    }

    const names = proteolytic.map((a) => a.name).join(", ");
    alerts.push({
      severity: "warning",
      ruleTriggered: "Regla 5",
      message: `${names} ${
        proteolytic.length > 1 ? "se aíslan" : "se aísla"
      } en frasco(s) separado(s): los hongos van en un alergoide molecular dedicado o, si no están estandarizados, no se mezclan con otros extractos.`,
    });

    const nonStandardized = proteolytic.filter(
      (a) => a.modigoidUgPerMl == null && a.diaterMolecularUgPerMl == null
    );
    if (nonStandardized.length > 0) {
      const nsNames = nonStandardized.map((a) => a.name).join(", ");
      alerts.push({
        severity: "danger",
        ruleTriggered: "Regla 5",
        message: `${nsNames} no tiene estandarización molecular publicada; la dosis no es calculable automáticamente. Prescriba según la ficha técnica del fabricante.`,
      });
    }
  }

  const N = remaining.length;

  if (N === 0) {
    // Solo hongos proteolíticos
  } else if (N === 1) {
    // ─── REGLA 1 — Monosensibilización ─────────────────────────────────
    rulesApplied.push("Regla 1: Monosensibilización");
    const a = remaining[0];
    if (a) {
      vials.push(
        buildVial({
          vialNumber: vials.length + 1,
          label: a.name,
          formulation: "ESTANDAR",
          allergens: [stdEntry(a)],
          injectionSite: nextSite(vials),
          rationale: `Formulación Estándar (${a.utLabel}) para alérgeno único.`,
          equivalences: getEquivalences(provider, "ESTANDAR"),
        })
      );
    }
  } else if (N > MAX_ALLERGENS_PER_VIAL) {
    // ─── REGLA 4 — Saturación molecular (N > 3): máx 3 por frasco ──────
    rulesApplied.push("Regla 4: Saturación Molecular");

    const perennial = remaining.filter((a) => PERENNIAL_FAMILIES.has(a.family));
    const seasonal = remaining.filter((a) => !PERENNIAL_FAMILIES.has(a.family));

    const groups: { baseLabel: string; allergens: Allergen[] }[] = [];
    for (const c of chunk(perennial, MAX_ALLERGENS_PER_VIAL))
      groups.push({ baseLabel: "Perennes", allergens: c });
    for (const c of chunk(seasonal, MAX_ALLERGENS_PER_VIAL))
      groups.push({ baseLabel: "Estacionales", allergens: c });

    for (const group of groups) {
      const sameBase = groups.filter((g) => g.baseLabel === group.baseLabel);
      const label =
        sameBase.length > 1 ? `${group.baseLabel} ${sameBase.indexOf(group) + 1}` : group.baseLabel;
      const fmt: FormulationType = group.allergens.length > 1 ? "MAX" : "ESTANDAR";
      const perenneLabel = group.baseLabel === "Perennes" ? "perenne" : "estacional";

      vials.push(
        buildVial({
          vialNumber: vials.length + 1,
          label,
          formulation: fmt,
          allergens: group.allergens.map((a) => stdEntry(a)),
          injectionSite: nextSite(vials),
          rationale:
            group.allergens.length > 1
              ? `Formulación MAX (10.000 UT por alérgeno) para preservar la dosis de cada alérgeno ${perenneLabel} en la mezcla.`
              : `Formulación Estándar para alérgeno ${perenneLabel} único.`,
          equivalences: getEquivalences(provider, fmt),
        })
      );
    }

    alerts.push({
      severity: "warning",
      ruleTriggered: "Regla 4",
      message: `Se seleccionaron ${N} alérgenos no-proteolíticos. Se separan en ${groups.length} frascos (máximo ${MAX_ALLERGENS_PER_VIAL} cada uno) para evitar degradación proteica y competición antigénica. Pauta: 0.5 mL por brazo, 30 min de separación (Cluster).`,
    });
  } else {
    // ─── N = 2 o N = 3 ────────────────────────────────────────────────
    if (relevanceMode === "dominant_split" && dominantAllergenId) {
      // ─── REGLA 3: Asimétrica → separar en viales independientes ────
      rulesApplied.push("Regla 3: Polisensibilización Asimétrica (Separar)");

      const dominant = remaining.find((a) => a.id === dominantAllergenId);
      const secondary = remaining.filter((a) => a.id !== dominantAllergenId);

      if (dominant) {
        vials.push(
          buildVial({
            vialNumber: vials.length + 1,
            label: `${dominant.name} (Dominante)`,
            formulation: "ESTANDAR",
            allergens: [stdEntry(dominant, true)],
            injectionSite: nextSite(vials),
            rationale:
              "Vial individual para el alérgeno dominante, permitiendo dosificación manual asimétrica independiente.",
            equivalences: getEquivalences(provider, "ESTANDAR"),
          })
        );
      }

      if (secondary.length === 1 && secondary[0]) {
        vials.push(
          buildVial({
            vialNumber: vials.length + 1,
            label: `${secondary[0].name} (Secundario)`,
            formulation: "ESTANDAR",
            allergens: [stdEntry(secondary[0])],
            injectionSite: nextSite(vials),
            rationale: "Vial individual para el alérgeno secundario.",
            equivalences: getEquivalences(provider, "ESTANDAR"),
          })
        );
      } else if (secondary.length > 1) {
        vials.push(
          buildVial({
            vialNumber: vials.length + 1,
            label: "Secundarios",
            formulation: "MAX",
            allergens: secondary.map((a) => stdEntry(a)),
            injectionSite: nextSite(vials),
            rationale:
              "Formulación MAX para los alérgenos secundarios, preservando la dosis completa de cada uno en la mezcla.",
            equivalences: getEquivalences(provider, "MAX"),
          })
        );
      }

      alerts.push({
        severity: "info",
        ruleTriggered: "Regla 3",
        message:
          "Al no contar con viales premezclados asimétricos (MAX FORTE) en el mercado local, la separación en viales independientes es la única forma de escalar la dosis del dominante sin sobre-exponer al secundario.",
      });
    } else if (relevanceMode === "dominant_max" && dominantAllergenId) {
      // ─── REGLA 3: Asimétrica → MAX simétrico ──────────────────────
      rulesApplied.push("Regla 3: Polisensibilización Asimétrica (MAX simétrico)");

      vials.push(
        buildVial({
          vialNumber: vials.length + 1,
          label: "Mezcla MAX",
          formulation: "MAX",
          allergens: remaining.map((a) => stdEntry(a, a.id === dominantAllergenId)),
          injectionSite: nextSite(vials),
          rationale:
            "Formulación MAX simétrica. Todos los alérgenos a 10.000 UT/mL. Se trata al dominante y secundarios al 100% de la dosis.",
          equivalences: getEquivalences(provider, "MAX"),
        })
      );

      alerts.push({
        severity: "info",
        ruleTriggered: "Regla 3",
        message:
          "MAX simétrico: dominante y secundarios reciben la misma concentración (10.000 UT/mL cada uno). MAX compensa el efecto dilucional.",
      });
    } else {
      // ─── REGLA 2: Polisensibilización Simétrica ────────────────────
      rulesApplied.push("Regla 2: Polisensibilización Simétrica");

      vials.push(
        buildVial({
          vialNumber: vials.length + 1,
          label: "Mezcla MAX",
          formulation: "MAX",
          allergens: remaining.map((a) => stdEntry(a)),
          injectionSite: nextSite(vials),
          rationale:
            "MAX compensa el efecto dilucional: cada 0.5 mL mantiene 10.000 UT de CADA alérgeno, previniendo subdosificación.",
          equivalences: getEquivalences(provider, "MAX"),
        })
      );
    }
  }

  appendTherapeuticWindowAlerts(vials, alerts);

  const totalA = selectedAllergens.length;
  const totalV = vials.length;
  const summary = `${totalA} alérgeno${totalA > 1 ? "s" : ""} seleccionado${totalA > 1 ? "s" : ""} → ${totalV} vial${totalV > 1 ? "es" : ""} recomendado${totalV > 1 ? "s" : ""}.`;

  return { vials, alerts, rulesApplied, summary };
}

// ─── Wrapper Engine ──────────────────────────────────────────────────────────

/** Motor de reglas SCIT puro (sin React). Exportado para tests unitarios. */
export function calculate(selection: DoctorSelection): ScitCalculationResult {
  const { selectedAllergenIds, provider } = selection;

  if (selectedAllergenIds.length === 0) {
    return { vials: [], alerts: [], rulesApplied: [], summary: "" };
  }

  const selectedAllergens = selectedAllergenIds
    .map(getAllergenById)
    .filter((a): a is Allergen => a != null);

  if (provider === "diater") {
    return calculateDiater(selectedAllergens);
  }

  return calculateInmunotekRoxall(selection, selectedAllergens);
}

// ─── Public Hook ─────────────────────────────────────────────────────────────

/**
 * Hook que implementa el motor de reglas SCIT.
 *
 * Dosis por proveedor (verificado 2026-06-15, ver allergens_db.ts):
 *  - Inmunotek / Roxall polimerizado: UT (no µg).
 *  - Roxall Modigoid (Alt a 1): µg reales (2,0 µg/0,5 mL).
 *  - Diater: molecular µg/mL, polimerizado HEPD, depot/polymerized diluciones.
 *
 * Reglas: 5 (hongos aislados) → 4 (N>3, máx 3/frasco) → 1 (N=1) → 2 (N=2-3
 * simétrico, MAX) → 3 (N=2-3 dominante). ⛔ MAX FORTE asimétrica no se importa.
 */
export function useScitCalculator(selection: DoctorSelection): ScitCalculationResult {
  const idsKey = selection.selectedAllergenIds.join(",");

  return useMemo(
    () => calculate(selection),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- idsKey serializes the array
    [idsKey, selection.relevanceMode, selection.dominantAllergenId, selection.provider]
  );
}

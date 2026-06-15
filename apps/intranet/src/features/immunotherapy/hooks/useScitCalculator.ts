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
  ScitCalculationResult,
  Vial,
  VialAllergenEntry,
  InjectionEquivalence,
  Provider,
} from "../data/types";

/** Máximo de alérgenos por frasco (estabilidad proteica / competición antigénica). */
const MAX_ALLERGENS_PER_VIAL = 3;

// ─── Internal Helpers ────────────────────────────────────────────────────────

function createEntry(
  allergen: Allergen,
  opts: { isDominant?: boolean; provider: Provider }
): VialAllergenEntry {
  // Diater no se dosifica en UT (usa molecular/HEPD según ficha); los proteolíticos
  // aislados tampoco llevan UT. En ambos casos la concentración UT no aplica.
  const isDiater = opts.provider === "diater";
  return {
    allergen,
    concentrationUtMl: isDiater || allergen.isProteolytic ? 0 : STANDARD_CONCENTRATION_UT_ML,
    injectedDoseUg: allergen.injectedDoseUg,
    isDominant: opts.isDominant ?? false,
  };
}

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
 * Valida cada dosis numérica (µg) contra la ventana terapéutica EAACI (5–20 µg)
 * y agrega una alerta si alguna queda fuera. Se omiten:
 *  - viales MODIGOID (alergoide molecular, fuera de la matriz UT),
 *  - entradas con displayDose (Diater / HEPD / no estandarizado),
 *  - dosis 0 (no estandarizadas, ya advertidas aparte).
 */
function appendTherapeuticWindowAlerts(vials: Vial[], alerts: ClinicalAlert[]): void {
  const below: string[] = [];
  const above: string[] = [];

  for (const vial of vials) {
    if (vial.formulation === "MODIGOID") continue;
    for (const entry of vial.allergens) {
      if (entry.displayDose) continue;
      const dose = entry.injectedDoseUg;
      if (dose <= 0) continue;
      if (dose < THERAPEUTIC_WINDOW_MIN_UG) below.push(`${entry.allergen.name} (${dose} µg)`);
      else if (dose > THERAPEUTIC_WINDOW_MAX_UG) above.push(`${entry.allergen.name} (${dose} µg)`);
    }
  }

  if (below.length > 0) {
    alerts.push({
      severity: "warning",
      ruleTriggered: "Ventana terapéutica",
      message: `Dosis por debajo del mínimo EAACI (${THERAPEUTIC_WINDOW_MIN_UG} µg): ${below.join(
        ", "
      )}. Riesgo de subdosificación; verifique la concentración disponible en ficha técnica.`,
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
  const VIAL_ML = 2.5; // asumiendo volumen estándar a granel para la mayoría

  if (provider === "diater") {
    // Diater usa volúmenes distintos según si es molecular puro o mezcla
    if (formulation === "MOL") {
      eqs.push({
        formulationName: "Molecular Nativo (MOL)",
        concentrationString: "Según alérgeno (µg/mL)",
        requiredVolumeMl: 0.8,
        dosesPerVial: Math.floor(VIAL_ML / 0.8), // ~3 dosis
      });
    } else {
      eqs.push({
        formulationName: formulation === "MOL_MIX" ? "MOL Mix" : "Polimerizado",
        concentrationString: "Según alérgeno (HEPD)",
        requiredVolumeMl: 0.5,
        dosesPerVial: Math.floor(VIAL_ML / 0.5), // 5 dosis
      });
    }
    return eqs;
  }

  // Inmunotek / Roxall
  if (formulation === "ESTANDAR") {
    const baseName =
      provider === "inmunotek" ? "Normal (Alutek/Clustoid)" : "Normal (Cluxin/Depot)";
    eqs.push({
      formulationName: baseName,
      concentrationString: "10.000 UT/mL",
      requiredVolumeMl: 0.5,
      dosesPerVial: Math.floor(VIAL_ML / 0.5), // 5 dosis
    });

    if (provider === "inmunotek") {
      // FORTE monosensibilización (30.000 UT/mL) — SÍ se importa a Chile.
      // (La que NO se importa es MAX FORTE, la asimétrica 30k/10k.)
      const forteVolume = 0.17; // 5000 UT a 30.000 UT/mL ≈ 0.17 mL
      eqs.push({
        formulationName: "Clustoid FORTE",
        concentrationString: "30.000 UT/mL",
        requiredVolumeMl: forteVolume,
        dosesPerVial: Math.floor(VIAL_ML / forteVolume), // ~14 dosis
      });
    }
  } else if (formulation === "MAX") {
    const baseName = provider === "inmunotek" ? "Clustoid MAX" : "Poliplus MAX / Cluxin";
    eqs.push({
      formulationName: baseName,
      concentrationString: "10.000 UT/mL (por alérgeno)",
      requiredVolumeMl: 0.5,
      dosesPerVial: Math.floor(VIAL_ML / 0.5),
    });
  } else if (formulation === "MODIGOID") {
    eqs.push({
      formulationName: "Modigoid Molecular",
      concentrationString: "4.0 µg/mL (Alt a 1)",
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

  // Diater no se dosifica con la matriz de microgramos de Inmunotek; sus extractos
  // moleculares/polimerizados siguen su propia ficha técnica (µg/HEPD).
  const molEntry = (a: Allergen): VialAllergenEntry => {
    const entry = createEntry(a, { provider: "diater" });
    entry.displayDose = "Molecular";
    return entry;
  };
  const hepdEntry = (a: Allergen): VialAllergenEntry => {
    const entry = createEntry(a, { provider: "diater" });
    entry.displayDose = "HEPD";
    return entry;
  };

  const isOnlyAlternaria = selectedAllergens.length === 1 && selectedAllergens[0]?.isProteolytic;
  const hasAlternaria = selectedAllergens.some((a) => a.isProteolytic);

  const isOnlyMites =
    selectedAllergens.length > 0 && selectedAllergens.every((a) => a.family === "acaros");
  const hasMites = selectedAllergens.some((a) => a.family === "acaros");

  // Nota: "cipres" no es familia sino el ID exacto en la base actual
  const isOnlyCypress = selectedAllergens.length === 1 && selectedAllergens[0]?.id === "cipres";
  const hasCypress = selectedAllergens.some((a) => a.id === "cipres");

  if (isOnlyMites) {
    rulesApplied.push("Diater: Base Ácaros Pura");
    vials.push(
      buildVial({
        vialNumber: 1,
        label: "MOLMite",
        formulation: "MOL",
        allergens: selectedAllergens.map(molEntry),
        injectionSite: "brazo_derecho",
        rationale: "Fórmula molecular preensamblada exclusiva de ácaros (Der p 1 / Der p 2).",
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
          a.family === "acaros" ? molEntry(a) : hepdEntry(a)
        ),
        injectionSite: "brazo_derecho",
        rationale:
          "MOLMite Mix: Base molecular de ácaros con extractos polimerizados para cubrir la polisensibilización.",
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
        allergens: selectedAllergens.map(molEntry),
        injectionSite: "brazo_derecho",
        rationale: "Fórmula molecular nativa de Alternaria.",
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
        allergens: selectedAllergens.map((a) => (a.isProteolytic ? molEntry(a) : hepdEntry(a))),
        injectionSite: "brazo_derecho",
        rationale:
          "Alt a 1 MOL Mix: Base molecular de Alternaria con extractos polimerizados adicionales.",
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
        allergens: selectedAllergens.map(molEntry),
        injectionSite: "brazo_derecho",
        rationale: "Fórmula molecular nativa de Ciprés.",
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
        allergens: selectedAllergens.map((a) => (a.id === "cipres" ? molEntry(a) : hepdEntry(a))),
        injectionSite: "brazo_derecho",
        rationale:
          "Cup a 1 MOL Mix: Base molecular de Ciprés con extractos polimerizados adicionales.",
        equivalences: getEquivalences("diater", "MOL_MIX"),
      })
    );
  } else {
    // Fallback to Polymerized
    const n = selectedAllergens.length;
    const form: FormulationType = n <= 3 ? "POLYMERIZED_100" : "POLYMERIZED";
    const label = n <= 3 ? "Polymerized 100" : "Polymerized";
    rulesApplied.push(`Diater: Extracto Polimerizado (N=${n})`);

    vials.push(
      buildVial({
        vialNumber: 1,
        label: label,
        formulation: form,
        allergens: selectedAllergens.map(hepdEntry),
        injectionSite: "brazo_derecho",
        rationale:
          "Formulación polimerizada a medida (sin aluminio) para combinaciones que no encajan en bases moleculares preensambladas.",
        equivalences: getEquivalences("diater", form),
      })
    );
  }

  alerts.push({
    severity: "info",
    ruleTriggered: "Diater",
    message:
      "La dosificación de Diater sigue la ficha técnica del fabricante (molecular / HEPD). No aplica la matriz de microgramos de Inmunotek/Roxall que se muestra para los otros laboratorios.",
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

  const vials: Vial[] = [];
  const alerts: ClinicalAlert[] = [];
  const rulesApplied: string[] = [];

  // ═══════════════════════════════════════════════════════════════════════════
  // REGLA 5 — Excepción Proteolítica (hongos: Alternaria, Cladosporium)
  // Las proteasas de hongos destruyen otros alérgenos en solución → se aíslan.
  //  - Alternaria: estandarizada como Modigoid (Alt a 1, 4.0 µg/mL).
  //  - Cladosporium u otros sin estandarización molecular: extracto depot nativo,
  //    dosis NO calculable automáticamente → se advierte.
  // ═══════════════════════════════════════════════════════════════════════════
  const proteolytic = selectedAllergens.filter((a) => a.isProteolytic);
  const remaining = selectedAllergens.filter((a) => !a.isProteolytic);

  if (proteolytic.length > 0) {
    rulesApplied.push("Regla 5: Excepción Proteolítica");

    for (const fungus of proteolytic) {
      const standardized = fungus.injectedDoseUg > 0; // Alternaria (Modigoid)

      if (standardized) {
        vials.push(
          buildVial({
            vialNumber: vials.length + 1,
            label: `${fungus.name} (aislado)`,
            formulation: "MODIGOID",
            allergens: [createEntry(fungus, { provider })],
            injectionSite: nextSite(vials),
            rationale:
              "Las proteasas fúngicas destruyen otros alérgenos en solución líquida. Alternaria se aísla en Modigoid (alergoide molecular Alt a 1) a 4.0 µg/mL.",
            equivalences: getEquivalences(provider, "MODIGOID"),
          })
        );
      } else {
        const entry = createEntry(fungus, { provider });
        entry.displayDose = "Sin estandarizar";
        vials.push(
          buildVial({
            vialNumber: vials.length + 1,
            label: `${fungus.name} (aislado)`,
            formulation: "DEPOT",
            allergens: [entry],
            injectionSite: nextSite(vials),
            rationale:
              "Hongo proteolítico sin estandarización molecular publicada. Se aísla en extracto depot nativo; la dosis se ajusta según ficha técnica del fabricante.",
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
        proteolytic.length > 1 ? "han sido aislados" : "ha sido aislado"
      } en frasco(s) separado(s). Las proteasas fúngicas degradan otros alérgenos en solución.`,
    });

    const nonStandardized = proteolytic.filter((a) => a.injectedDoseUg <= 0);
    if (nonStandardized.length > 0) {
      const nsNames = nonStandardized.map((a) => a.name).join(", ");
      alerts.push({
        severity: "danger",
        ruleTriggered: "Regla 5",
        message: `${nsNames} no tiene estandarización molecular publicada; la dosis no es calculable automáticamente. Prescriba según la ficha técnica del fabricante.`,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Evaluar alérgenos no-proteolíticos restantes
  // ═══════════════════════════════════════════════════════════════════════════
  const N = remaining.length;

  if (N === 0) {
    // Solo se seleccionaron hongos proteolíticos
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
          allergens: [createEntry(a, { provider })],
          injectionSite: nextSite(vials),
          rationale: `Formulación Estándar (${a.commercialEquivalence}) para alérgeno único.`,
          equivalences: getEquivalences(provider, "ESTANDAR"),
        })
      );
    }
  } else if (N > MAX_ALLERGENS_PER_VIAL) {
    // ─── REGLA 4 — Saturación Molecular (N > 3) ───────────────────────
    // Se separa en perennes vs estacionales y, dentro de cada grupo, se
    // fracciona en frascos de máximo 3 alérgenos (estabilidad / competición).
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
      const isPerennialGroup = group.baseLabel === "Perennes";

      vials.push(
        buildVial({
          vialNumber: vials.length + 1,
          label,
          formulation: fmt,
          allergens: group.allergens.map((a) => createEntry(a, { provider })),
          injectionSite: nextSite(vials),
          rationale:
            group.allergens.length > 1
              ? `Formulación MAX para preservar la dosis terapéutica de cada alérgeno ${
                  isPerennialGroup ? "perenne" : "estacional"
                } en la mezcla.`
              : `Formulación Estándar para alérgeno ${
                  isPerennialGroup ? "perenne" : "estacional"
                } único.`,
          equivalences: getEquivalences(provider, fmt),
        })
      );
    }

    alerts.push({
      severity: "warning",
      ruleTriggered: "Regla 4",
      message: `Se han seleccionado ${N} alérgenos no-proteolíticos. Se separan en ${groups.length} frascos (máximo ${MAX_ALLERGENS_PER_VIAL} alérgenos cada uno) para evitar degradación proteica y competición antigénica. Pauta: 0.5 mL por brazo, con 30 minutos de separación (Pauta Cluster Clásica).`,
    });
  } else {
    // ─── N = 2 o N = 3 ────────────────────────────────────────────────

    if (relevanceMode === "dominant_split" && dominantAllergenId) {
      // ─── REGLA 3: Asimétrica → Separar en viales independientes ────
      rulesApplied.push("Regla 3: Polisensibilización Asimétrica (Separar)");

      const dominant = remaining.find((a) => a.id === dominantAllergenId);
      const secondary = remaining.filter((a) => a.id !== dominantAllergenId);

      if (dominant) {
        vials.push(
          buildVial({
            vialNumber: vials.length + 1,
            label: `${dominant.name} (Dominante)`,
            formulation: "ESTANDAR",
            allergens: [createEntry(dominant, { provider, isDominant: true })],
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
            allergens: [createEntry(secondary[0], { provider })],
            injectionSite: nextSite(vials),
            rationale: "Vial individual para el alérgeno secundario.",
            equivalences: getEquivalences(provider, "ESTANDAR"),
          })
        );
      } else if (secondary.length > 1) {
        // N=3 con dominante: los 2 secundarios van en un vial MAX
        vials.push(
          buildVial({
            vialNumber: vials.length + 1,
            label: "Secundarios",
            formulation: "MAX",
            allergens: secondary.map((a) => createEntry(a, { provider })),
            injectionSite: nextSite(vials),
            rationale:
              "Formulación MAX para los alérgenos secundarios, preservando la dosis terapéutica completa de cada uno en la mezcla.",
            equivalences: getEquivalences(provider, "MAX"),
          })
        );
      }

      alerts.push({
        severity: "info",
        ruleTriggered: "Regla 3",
        message:
          "Al no contar con viales premezclados asimétricos (MAX FORTE) en el mercado local, la separación en viales independientes es la única forma de escalar la dosis del alérgeno dominante sin sobre-exponer al paciente al alérgeno secundario.",
      });
    } else if (relevanceMode === "dominant_max" && dominantAllergenId) {
      // ─── REGLA 3: Asimétrica → usar MAX simétrico ─────────────────
      rulesApplied.push("Regla 3: Polisensibilización Asimétrica (MAX simétrico)");

      vials.push(
        buildVial({
          vialNumber: vials.length + 1,
          label: "Mezcla MAX",
          formulation: "MAX",
          allergens: remaining.map((a) =>
            createEntry(a, { provider, isDominant: a.id === dominantAllergenId })
          ),
          injectionSite: nextSite(vials),
          rationale:
            "Formulación MAX simétrica. Todos los alérgenos reciben 10.000 UT/mL. Se acepta tratar al dominante y secundarios al 100% de la dosis terapéutica.",
          equivalences: getEquivalences(provider, "MAX"),
        })
      );

      alerts.push({
        severity: "info",
        ruleTriggered: "Regla 3",
        message:
          "Se ha optado por MAX simétrico. El alérgeno dominante y los secundarios recibirán la misma concentración (10.000 UT/mL cada uno). La tecnología MAX compensa el efecto dilucional.",
      });
    } else {
      // ─── REGLA 2: Polisensibilización Simétrica ────────────────────
      rulesApplied.push("Regla 2: Polisensibilización Simétrica");

      vials.push(
        buildVial({
          vialNumber: vials.length + 1,
          label: "Mezcla MAX",
          formulation: "MAX",
          allergens: remaining.map((a) => createEntry(a, { provider })),
          injectionSite: nextSite(vials),
          rationale:
            "La tecnología MAX compensa el efecto dilucional, asegurando que cada 0.5 mL del frasco mantengan 10.000 UT de CADA alérgeno, previniendo la subdosificación.",
          equivalences: getEquivalences(provider, "MAX"),
        })
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Validación de ventana terapéutica EAACI (5–20 µg)
  // ═══════════════════════════════════════════════════════════════════════════
  appendTherapeuticWindowAlerts(vials, alerts);

  // ═══════════════════════════════════════════════════════════════════════════
  // Resumen textual
  // ═══════════════════════════════════════════════════════════════════════════
  const totalA = selectedAllergens.length;
  const totalV = vials.length;
  const summary = `${totalA} alérgeno${totalA > 1 ? "s" : ""} seleccionado${totalA > 1 ? "s" : ""} → ${totalV} vial${totalV > 1 ? "es" : ""} recomendado${totalV > 1 ? "s" : ""}.`;

  return { vials, alerts, rulesApplied, summary };
}

// ─── Wrapper Engine ──────────────────────────────────────────────────────────

/**
 * Motor de reglas SCIT puro (sin React). Exportado para tests unitarios.
 */
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
 * Orden de evaluación:
 * 1. Regla 5 — Aislar hongos proteolíticos (Alternaria→Modigoid; resto→depot)
 * 2. Regla 4 — Si N > 3, dividir en Perennes + Estacionales (máx 3 por frasco)
 * 3. Regla 1 — Si N = 1, formulación Estándar
 * 4. Regla 2 — Si N = 2–3 y simétrico, formulación MAX
 * 5. Regla 3 — Si N = 2–3 y dominante, separar o MAX simétrico
 * + Validación de ventana terapéutica EAACI (5–20 µg) sobre las dosis finales.
 *
 * ⛔ MAX FORTE (asimétrica 30k/10k) no disponible en Chile — eliminado del motor.
 *    FORTE monosensibilización (30k) sí se importa y se ofrece como alternativa.
 */
export function useScitCalculator(selection: DoctorSelection): ScitCalculationResult {
  const idsKey = selection.selectedAllergenIds.join(",");

  return useMemo(
    () => calculate(selection),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- idsKey serializes the array
    [idsKey, selection.relevanceMode, selection.dominantAllergenId, selection.provider]
  );
}

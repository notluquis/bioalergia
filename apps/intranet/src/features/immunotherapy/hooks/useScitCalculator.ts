import { useMemo } from "react";
import {
  getAllergenById,
  INJECTION_VOLUME_ML,
  PERENNIAL_FAMILIES,
  STANDARD_CONCENTRATION_UT_ML,
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
} from "../data/types";

// ─── Internal Helpers ────────────────────────────────────────────────────────

function createEntry(allergen: Allergen, isDominant = false): VialAllergenEntry {
  return {
    allergen,
    concentrationUtMl: allergen.isProteolytic ? 0 : STANDARD_CONCENTRATION_UT_ML,
    injectedDoseUg: allergen.injectedDoseUg,
    isDominant,
  };
}

function buildVial(opts: {
  vialNumber: number;
  label: string;
  formulation: FormulationType;
  allergens: VialAllergenEntry[];
  injectionSite: InjectionSite;
  rationale: string;
}): Vial {
  return { ...opts, injectionVolumeMl: INJECTION_VOLUME_ML };
}

function nextSite(existingVials: Vial[]): InjectionSite {
  return existingVials.length % 2 === 0 ? "brazo_derecho" : "brazo_izquierdo";
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
        allergens: selectedAllergens.map((a) => createEntry(a)),
        injectionSite: "brazo_derecho",
        rationale: "Fórmula molecular preensamblada exclusiva de ácaros (Der p 1 / Der p 2).",
      })
    );
  } else if (hasMites && selectedAllergens.length > 1) {
    rulesApplied.push("Diater: Base Ácaros + Polimerizado");
    vials.push(
      buildVial({
        vialNumber: 1,
        label: "MOLMite Mix",
        formulation: "MOL_MIX",
        allergens: selectedAllergens.map((a) => {
          const entry = createEntry(a);
          if (a.family !== "acaros") entry.displayDose = "HEPD";
          return entry;
        }),
        injectionSite: "brazo_derecho",
        rationale:
          "MOLMite Mix: Base molecular de ácaros con extractos polimerizados para cubrir la polisensibilización.",
      })
    );
  } else if (isOnlyAlternaria) {
    rulesApplied.push("Diater: Base Alternaria Pura");
    vials.push(
      buildVial({
        vialNumber: 1,
        label: "Alt a 1 MOL",
        formulation: "MOL",
        allergens: selectedAllergens.map((a) => createEntry(a)),
        injectionSite: "brazo_derecho",
        rationale: "Fórmula molecular nativa de Alternaria.",
      })
    );
  } else if (hasAlternaria && selectedAllergens.length > 1) {
    rulesApplied.push("Diater: Base Alternaria + Polimerizado");
    vials.push(
      buildVial({
        vialNumber: 1,
        label: "Alt a 1 MOL Mix",
        formulation: "MOL_MIX",
        allergens: selectedAllergens.map((a) => {
          const entry = createEntry(a);
          if (!a.isProteolytic) entry.displayDose = "HEPD";
          return entry;
        }),
        injectionSite: "brazo_derecho",
        rationale:
          "Alt a 1 MOL Mix: Base molecular de Alternaria con extractos polimerizados adicionales.",
      })
    );
  } else if (isOnlyCypress) {
    rulesApplied.push("Diater: Base Ciprés Pura");
    vials.push(
      buildVial({
        vialNumber: 1,
        label: "Cup a 1 MOL",
        formulation: "MOL",
        allergens: selectedAllergens.map((a) => createEntry(a)),
        injectionSite: "brazo_derecho",
        rationale: "Fórmula molecular nativa de Ciprés.",
      })
    );
  } else if (hasCypress && selectedAllergens.length > 1) {
    rulesApplied.push("Diater: Base Ciprés + Polimerizado");
    vials.push(
      buildVial({
        vialNumber: 1,
        label: "Cup a 1 MOL Mix",
        formulation: "MOL_MIX",
        allergens: selectedAllergens.map((a) => {
          const entry = createEntry(a);
          if (a.id !== "cipres") entry.displayDose = "HEPD";
          return entry;
        }),
        injectionSite: "brazo_derecho",
        rationale:
          "Cup a 1 MOL Mix: Base molecular de Ciprés con extractos polimerizados adicionales.",
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
        allergens: selectedAllergens.map((a) => {
          const entry = createEntry(a);
          entry.displayDose = "HEPD";
          return entry;
        }),
        injectionSite: "brazo_derecho",
        rationale:
          "Formulación polimerizada a medida (sin aluminio) para combinaciones que no encajan en bases moleculares preensambladas.",
      })
    );
  }

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
  const { relevanceMode, dominantAllergenId } = selection;

  const vials: Vial[] = [];
  const alerts: ClinicalAlert[] = [];
  const rulesApplied: string[] = [];

  // ═══════════════════════════════════════════════════════════════════════════
  // REGLA 5 — Excepción Proteolítica (Alternaria)
  // Las proteasas de hongos destruyen otros alérgenos en solución.
  // Se aísla SIEMPRE en un frasco Modigoid separado.
  // ═══════════════════════════════════════════════════════════════════════════
  const proteolytic = selectedAllergens.filter((a) => a.isProteolytic);
  const remaining = selectedAllergens.filter((a) => !a.isProteolytic);

  if (proteolytic.length > 0) {
    rulesApplied.push("Regla 5: Excepción Proteolítica");

    for (const alt of proteolytic) {
      vials.push(
        buildVial({
          vialNumber: vials.length + 1,
          label: `${alt.name} (aislado)`,
          formulation: "MODIGOID",
          allergens: [createEntry(alt)],
          injectionSite: nextSite(vials),
          rationale:
            "Las proteasas de los hongos destruyen otros alérgenos nativos o alergoides si conviven en solución líquida. Se aísla en Modigoid (Alergoide Molecular Alt a 1) a 4.0 μg/mL.",
        })
      );
    }

    alerts.push({
      severity: "warning",
      ruleTriggered: "Regla 5",
      message:
        "Alternaria ha sido aislada automáticamente en un frasco Modigoid separado. Sus proteasas degradan otros alérgenos en solución.",
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Evaluar alérgenos no-proteolíticos restantes
  // ═══════════════════════════════════════════════════════════════════════════
  const N = remaining.length;

  if (N === 0) {
    // Solo se seleccionó Alternaria u hongos proteolíticos
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
          allergens: [createEntry(a)],
          injectionSite: nextSite(vials),
          rationale: `Formulación Estándar (${a.commercialEquivalence}) para alérgeno único.`,
        })
      );
    }
  } else if (N > 3) {
    // ─── REGLA 4 — Saturación Molecular (N > 3) ───────────────────────
    rulesApplied.push("Regla 4: Saturación Molecular");

    const perennial = remaining.filter((a) => PERENNIAL_FAMILIES.has(a.family));
    const seasonal = remaining.filter((a) => !PERENNIAL_FAMILIES.has(a.family));

    // Si todos caen en una sola categoría, dividir en 2 grupos balanceados
    if (perennial.length === 0 || seasonal.length === 0) {
      const all = perennial.length > 0 ? perennial : seasonal;
      const mid = Math.ceil(all.length / 2);
      const group1 = all.slice(0, mid);
      const group2 = all.slice(mid);

      const fmt1: FormulationType = group1.length > 1 ? "MAX" : "ESTANDAR";
      vials.push(
        buildVial({
          vialNumber: vials.length + 1,
          label: "Grupo 1",
          formulation: fmt1,
          allergens: group1.map((a) => createEntry(a)),
          injectionSite: "brazo_derecho",
          rationale:
            group1.length > 1
              ? "Formulación MAX para preservar la dosis terapéutica de cada alérgeno en la mezcla."
              : "Formulación Estándar para alérgeno único en este vial.",
        })
      );

      if (group2.length > 0) {
        const fmt2: FormulationType = group2.length > 1 ? "MAX" : "ESTANDAR";
        vials.push(
          buildVial({
            vialNumber: vials.length + 1,
            label: "Grupo 2",
            formulation: fmt2,
            allergens: group2.map((a) => createEntry(a)),
            injectionSite: "brazo_izquierdo",
            rationale:
              group2.length > 1
                ? "Formulación MAX para preservar la dosis terapéutica de cada alérgeno en la mezcla."
                : "Formulación Estándar para alérgeno único en este vial.",
          })
        );
      }
    } else {
      // Split natural: perennes vs estacionales
      const fmtP: FormulationType = perennial.length > 1 ? "MAX" : "ESTANDAR";
      vials.push(
        buildVial({
          vialNumber: vials.length + 1,
          label: "Perennes",
          formulation: fmtP,
          allergens: perennial.map((a) => createEntry(a)),
          injectionSite: "brazo_derecho",
          rationale:
            perennial.length > 1
              ? "Formulación MAX para preservar la dosis terapéutica de cada alérgeno perenne en la mezcla."
              : "Formulación Estándar para alérgeno perenne único.",
        })
      );

      const fmtS: FormulationType = seasonal.length > 1 ? "MAX" : "ESTANDAR";
      vials.push(
        buildVial({
          vialNumber: vials.length + 1,
          label: "Estacionales",
          formulation: fmtS,
          allergens: seasonal.map((a) => createEntry(a)),
          injectionSite: "brazo_izquierdo",
          rationale:
            seasonal.length > 1
              ? "Formulación MAX para preservar la dosis terapéutica de cada alérgeno estacional en la mezcla."
              : "Formulación Estándar para alérgeno estacional único.",
        })
      );
    }

    alerts.push({
      severity: "warning",
      ruleTriggered: "Regla 4",
      message: `Se han seleccionado ${N} alérgenos no-proteolíticos. Se recomienda separar en 2 frascos para evitar degradación proteica y competición antigénica. Pauta: 0.5 mL por brazo, con 30 minutos de separación (Pauta Cluster Clásica).`,
    });

    // Advertir si algún vial excede 3 alérgenos
    const overloaded = vials.filter((v) => v.formulation !== "MODIGOID" && v.allergens.length > 3);
    if (overloaded.length > 0) {
      alerts.push({
        severity: "danger",
        ruleTriggered: "Regla 4",
        message:
          "Uno de los viales contiene más de 3 alérgenos. Existe riesgo de degradación proteica y competición a nivel de Células Dendríticas. Considere redistribuir manualmente.",
      });
    }
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
            allergens: [createEntry(dominant, true)],
            injectionSite: nextSite(vials),
            rationale:
              "Vial individual para el alérgeno dominante, permitiendo dosificación manual asimétrica independiente.",
          })
        );
      }

      if (secondary.length === 1 && secondary[0]) {
        vials.push(
          buildVial({
            vialNumber: vials.length + 1,
            label: `${secondary[0].name} (Secundario)`,
            formulation: "ESTANDAR",
            allergens: [createEntry(secondary[0])],
            injectionSite: nextSite(vials),
            rationale: "Vial individual para el alérgeno secundario.",
          })
        );
      } else if (secondary.length > 1) {
        // N=3 con dominante: los 2 secundarios van en un vial MAX
        vials.push(
          buildVial({
            vialNumber: vials.length + 1,
            label: "Secundarios",
            formulation: "MAX",
            allergens: secondary.map((a) => createEntry(a)),
            injectionSite: nextSite(vials),
            rationale:
              "Formulación MAX para los alérgenos secundarios, preservando la dosis terapéutica completa de cada uno en la mezcla.",
          })
        );
      }

      alerts.push({
        severity: "info",
        ruleTriggered: "Regla 3",
        message:
          "Al no contar con viales premezclados asimétricos (Forte) en el mercado local, la separación en viales independientes es la única forma de escalar la dosis del alérgeno dominante sin sobre-exponer al paciente al alérgeno secundario.",
      });
    } else if (relevanceMode === "dominant_max" && dominantAllergenId) {
      // ─── REGLA 3: Asimétrica → usar MAX simétrico ─────────────────
      rulesApplied.push("Regla 3: Polisensibilización Asimétrica (MAX simétrico)");

      vials.push(
        buildVial({
          vialNumber: vials.length + 1,
          label: "Mezcla MAX",
          formulation: "MAX",
          allergens: remaining.map((a) => createEntry(a, a.id === dominantAllergenId)),
          injectionSite: nextSite(vials),
          rationale:
            "Formulación MAX simétrica. Todos los alérgenos reciben 10.000 UT/mL. Se acepta tratar al dominante y secundarios al 100% de la dosis terapéutica.",
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
          allergens: remaining.map((a) => createEntry(a)),
          injectionSite: nextSite(vials),
          rationale:
            "La tecnología MAX compensa el efecto dilucional, asegurando que cada 0.5 mL del frasco mantengan 10.000 UT de CADA alérgeno, previniendo la subdosificación.",
        })
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Resumen textual
  // ═══════════════════════════════════════════════════════════════════════════
  const totalA = selectedAllergens.length;
  const totalV = vials.length;
  const summary = `${totalA} alérgeno${totalA > 1 ? "s" : ""} seleccionado${totalA > 1 ? "s" : ""} → ${totalV} vial${totalV > 1 ? "es" : ""} recomendado${totalV > 1 ? "s" : ""}.`;

  return { vials, alerts, rulesApplied, summary };
}

// ─── Wrapper Engine ──────────────────────────────────────────────────────────

function calculate(selection: DoctorSelection): ScitCalculationResult {
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
 * 1. Regla 5 — Aislar hongos proteolíticos (Alternaria) en Modigoid
 * 2. Regla 4 — Si N > 3, dividir en Perennes + Estacionales
 * 3. Regla 1 — Si N = 1, formulación Estándar
 * 4. Regla 2 — Si N = 2–3 y simétrico, formulación MAX
 * 5. Regla 3 — Si N = 2–3 y dominante, separar o MAX simétrico
 *
 * ⛔ MAX FORTE no disponible en Chile — eliminado del motor.
 */
export function useScitCalculator(selection: DoctorSelection): ScitCalculationResult {
  const idsKey = selection.selectedAllergenIds.join(",");

  return useMemo(
    () => calculate(selection),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- idsKey serializes the array
    [idsKey, selection.relevanceMode, selection.dominantAllergenId, selection.provider]
  );
}

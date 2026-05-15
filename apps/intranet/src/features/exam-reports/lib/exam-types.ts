import type { ExamType } from "@finanzas/orpc-contracts/exam-reports";

/**
 * Static configuration for each ExamType: the visible report title
 * (printed in the PDF) and the canonical sections the wizard renders.
 *
 * Sections are pre-seeded — the operator can leave any section empty
 * (it then prints "Sin reacción a alergenos testeados.") or add
 * reactions. Section labels are what shows in the PDF; sectionKey is
 * the stable id stored in the DB so renaming the visible label is safe.
 *
 * Mirrors the 5 PDF templates the user provided:
 *   PATCH                  → Test de Parche (lectura 48h, lectura 96h)
 *   MULTITEST_PANELS       → Panel 1, 2, 3 + Acaros / Insectario
 *   FOOD_PANEL             → Panel Alimentario único
 *   AEROALLERGENS_I        → Acaros, Epitelios, Polenes (Arboles,
 *                            Gramíneas, Malezas, Hongos)
 *   AEROALLERGENS_II       → Same skeleton as I — operator-driven
 *                            content; second variant for follow-ups.
 */

export interface ExamSectionTemplate {
  sectionKey: string;
  label: string;
  // Optional grouping: subsections render under a parent label
  // (e.g. "POLENES > ARBOLES"). When set, the parent prints once.
  group?: string;
}

export interface ExamTypeConfig {
  /** Title printed in the PDF (multi-line allowed via `\n`). */
  title: string;
  /** Pre-seeded sections shown in the wizard. Operator can clear any. */
  sections: ExamSectionTemplate[];
  /** Optional default footer note (printed below sections). */
  defaultNotes?: string;
}

export const EXAM_TYPE_CONFIG: Record<ExamType, ExamTypeConfig> = {
  PATCH: {
    title: "INFORME TEST DE PARCHE",
    sections: [
      { sectionKey: "lectura_48h", label: "Primera lectura 48 horas" },
      { sectionKey: "lectura_96h", label: "Segunda lectura 96 horas" },
    ],
    // Patch testing follows ICDRG/ESCD criteria, not SPT (no histamine
    // control, different lectura window). Disclaimer reflects that.
    defaultNotes:
      "*Lecturas a 48 h y 96 h post-aplicación. La sensibilización detectada no equivale necesariamente a alergia clínica de contacto: requiere correlación con la historia de exposición. Estándar ICDRG / ESCD.",
  },
  MULTITEST_PANELS: {
    title: "INFORME TEST CUTÁNEO\nMULTITEST PANEL 1, 2, 3 Y ÁCAROS",
    sections: [
      { sectionKey: "panel_1", label: "PANEL 1" },
      { sectionKey: "panel_2", label: "PANEL 2" },
      { sectionKey: "panel_3", label: "PANEL 3" },
      { sectionKey: "acaros_insectario", label: "ÁCAROS / INSECTARIO" },
    ],
    defaultNotes:
      "*solo se considera reacción positiva moderada con pápula mayor o igual a 3 mm y positiva fuerte mayor o igual a 6 mm.",
  },
  FOOD_PANEL: {
    title: "INFORME TEST CUTÁNEO\nPANEL ALIMENTARIO I",
    sections: [{ sectionKey: "panel_alimentario", label: "PANEL ALIMENTARIO" }],
    defaultNotes:
      "*solo se considera reacción positiva moderada con pápula mayor o igual a 3 mm y positiva fuerte mayor o igual a 6 mm.",
  },
  AEROALLERGENS_I: {
    title: "INFORME MULTITEST\nAEROALÉRGENOS I",
    sections: [
      { sectionKey: "acaros", label: "ÁCAROS" },
      { sectionKey: "epitelios", label: "EPITELIOS" },
      { sectionKey: "polenes_arboles", label: "ÁRBOLES", group: "PÓLENES" },
      { sectionKey: "polenes_gramineas", label: "GRAMÍNEAS (pastos)", group: "PÓLENES" },
      { sectionKey: "polenes_malezas", label: "MALEZAS", group: "PÓLENES" },
      { sectionKey: "polenes_hongos", label: "HONGOS", group: "PÓLENES" },
    ],
    defaultNotes:
      "*solo se considera reacción positiva moderada con pápula mayor o igual a 3 mm y positiva fuerte mayor o igual a 6 mm.",
  },
  AEROALLERGENS_II: {
    title: "INFORME MULTITEST\nAEROALÉRGENOS II",
    sections: [
      { sectionKey: "acaros", label: "ÁCAROS" },
      { sectionKey: "epitelios", label: "EPITELIOS" },
      { sectionKey: "polenes_arboles", label: "ÁRBOLES", group: "PÓLENES" },
      { sectionKey: "polenes_gramineas", label: "GRAMÍNEAS (pastos)", group: "PÓLENES" },
      { sectionKey: "polenes_malezas", label: "MALEZAS", group: "PÓLENES" },
      { sectionKey: "polenes_hongos", label: "HONGOS", group: "PÓLENES" },
    ],
    defaultNotes:
      "*solo se considera reacción positiva moderada con pápula mayor o igual a 3 mm y positiva fuerte mayor o igual a 6 mm.",
  },
};

export const EXAM_TYPE_LABEL: Record<ExamType, string> = {
  PATCH: "Test de Parche",
  MULTITEST_PANELS: "Multitest Panel 1, 2, 3 y Ácaros",
  FOOD_PANEL: "Panel Alimentario I",
  AEROALLERGENS_I: "Aeroalérgenos I",
  AEROALLERGENS_II: "Aeroalérgenos II",
};

/**
 * Short description per exam type — printed under the title on the
 * type-picker card so the operator picks the right one without having
 * to recognise the long internal name.
 */
export const EXAM_TYPE_DESCRIPTION: Record<ExamType, string> = {
  PATCH: "Patch test de contacto · lecturas a 48 h y 96 h · criterios ICDRG/ESCD.",
  MULTITEST_PANELS:
    "Prick test estandarizado · 3 paneles + ácaros · controles histamina y SSF · lectura 15–20 min.",
  FOOD_PANEL: "Prick test de panel alimentario · controles histamina y SSF · lectura 15–20 min.",
  AEROALLERGENS_I:
    "Prick test de aeroalérgenos · ácaros, epitelios y pólenes · controles histamina y SSF · lectura 15–20 min.",
  AEROALLERGENS_II:
    "Prick test de aeroalérgenos (panel ampliado) · ácaros, epitelios y pólenes · controles histamina y SSF · lectura 15–20 min.",
};

export const EXAM_TYPE_ORDER: ExamType[] = [
  "PATCH",
  "MULTITEST_PANELS",
  "FOOD_PANEL",
  "AEROALLERGENS_I",
  "AEROALLERGENS_II",
];

// ── Reaction labels (Spanish, used in PDF + UI) ───────────────────────

export const REACTION_LABEL = {
  NEGATIVA: "Sin reacción",
  DEBIL: "Reacción positiva débil",
  MODERADA: "Reacción positiva moderada",
  FUERTE: "Reacción positiva fuerte",
} as const;

/**
 * Compose the inline-PDF copy for a section's reactions, mirroring the
 * format from the source PDFs:
 *   "Reacción positiva moderada con: Allergen A, Allergen B."
 *   "Reacción positiva fuerte con: Allergen C."
 *   When the section has no positive reactions:
 *   "Sin reacción positiva a alergenos testeados."
 */
export function composeReactionLines(
  reactions: { reaction: string; allergenName: string }[]
): string[] {
  if (reactions.length === 0) return ["Sin reacción a alérgenos testeados."];

  const positives = reactions.filter((r) => r.reaction !== "NEGATIVA");
  if (positives.length === 0) return ["Sin reacción positiva a alérgenos testeados."];

  const groups = new Map<string, string[]>();
  for (const r of positives) {
    const bucket = groups.get(r.reaction) ?? [];
    bucket.push(r.allergenName);
    groups.set(r.reaction, bucket);
  }

  const order = ["DEBIL", "MODERADA", "FUERTE"] as const;
  const lines: string[] = [];
  for (const key of order) {
    const allergens = groups.get(key);
    if (!allergens || allergens.length === 0) continue;
    const label = REACTION_LABEL[key];
    lines.push(`${label} con: ${allergens.join(", ")}.`);
  }
  return lines;
}

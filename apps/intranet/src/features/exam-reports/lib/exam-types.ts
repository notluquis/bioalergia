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
  },
  MULTITEST_PANELS: {
    title: "INFORME TEST CUTANEO\nMULTITEST PANEL 1, 2, 3 y ACAROS",
    sections: [
      { sectionKey: "panel_1", label: "PANEL 1" },
      { sectionKey: "panel_2", label: "PANEL 2" },
      { sectionKey: "panel_3", label: "PANEL 3" },
      { sectionKey: "acaros_insectario", label: "ACAROS / INSECTARIO" },
    ],
    defaultNotes:
      "*solo se considera reacción positiva moderada con pápula mayor o igual a 3 mm y positiva fuerte mayor o igual a 6 mm.",
  },
  FOOD_PANEL: {
    title: "INFORME TEST CUTANEO\nPANEL ALIMENTARIO I",
    sections: [{ sectionKey: "panel_alimentario", label: "PANEL ALIMENTARIO" }],
    defaultNotes:
      "*solo se considera reacción positiva moderada con pápula mayor o igual a 3 mm y positiva fuerte mayor o igual a 6 mm.",
  },
  AEROALLERGENS_I: {
    title: "INFORME MULTITEST\nAEROALERGENOS I",
    sections: [
      { sectionKey: "acaros", label: "ACAROS" },
      { sectionKey: "epitelios", label: "EPITELIOS" },
      { sectionKey: "polenes_arboles", label: "ARBOLES", group: "POLENES" },
      { sectionKey: "polenes_gramineas", label: "GRAMINEAS (pastos)", group: "POLENES" },
      { sectionKey: "polenes_malezas", label: "MALEZAS", group: "POLENES" },
      { sectionKey: "polenes_hongos", label: "HONGOS", group: "POLENES" },
    ],
    defaultNotes:
      "*solo se considera reacción positiva moderada con pápula mayor o igual a 3 mm y positiva fuerte mayor o igual a 6 mm.",
  },
  AEROALLERGENS_II: {
    title: "INFORME MULTITEST\nAEROALERGENOS II",
    sections: [
      { sectionKey: "acaros", label: "ACAROS" },
      { sectionKey: "epitelios", label: "EPITELIOS" },
      { sectionKey: "polenes_arboles", label: "ARBOLES", group: "POLENES" },
      { sectionKey: "polenes_gramineas", label: "GRAMINEAS (pastos)", group: "POLENES" },
      { sectionKey: "polenes_malezas", label: "MALEZAS", group: "POLENES" },
      { sectionKey: "polenes_hongos", label: "HONGOS", group: "POLENES" },
    ],
    defaultNotes:
      "*solo se considera reacción positiva moderada con pápula mayor o igual a 3 mm y positiva fuerte mayor o igual a 6 mm.",
  },
};

export const EXAM_TYPE_LABEL: Record<ExamType, string> = {
  PATCH: "Test de Parche",
  MULTITEST_PANELS: "Multitest Panel 1, 2, 3 y Acaros",
  FOOD_PANEL: "Panel Alimentario I",
  AEROALLERGENS_I: "Aeroalergenos I",
  AEROALLERGENS_II: "Aeroalergenos II",
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
  if (reactions.length === 0) return ["Sin reacción a alergenos testeados."];

  const positives = reactions.filter((r) => r.reaction !== "NEGATIVA");
  if (positives.length === 0) return ["Sin reacción positiva a alergenos testeados."];

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

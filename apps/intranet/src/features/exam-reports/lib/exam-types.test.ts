/**
 * Tests for `exam-types.ts` — pure config + reaction-line composition
 * for the exam-reports PDF / wizard.
 *
 * Pure logic, no React, no async — `.test.ts` rather than `.test.tsx`.
 */

import { describe, expect, it } from "vitest";

import {
  EXAM_TYPE_CONFIG,
  EXAM_TYPE_DESCRIPTION,
  EXAM_TYPE_LABEL,
  EXAM_TYPE_ORDER,
  REACTION_LABEL,
  composeReactionLines,
} from "./exam-types";

describe("EXAM_TYPE_ORDER", () => {
  it("lists all 5 exam types exactly once in PDF order", () => {
    expect(EXAM_TYPE_ORDER).toEqual([
      "PATCH",
      "MULTITEST_PANELS",
      "FOOD_PANEL",
      "AEROALLERGENS_I",
      "AEROALLERGENS_II",
    ]);
    expect(new Set(EXAM_TYPE_ORDER).size).toBe(EXAM_TYPE_ORDER.length);
  });

  it("every exam type has matching config, label, description", () => {
    for (const t of EXAM_TYPE_ORDER) {
      expect(EXAM_TYPE_CONFIG[t]).toBeDefined();
      expect(EXAM_TYPE_LABEL[t]).toBeTruthy();
      expect(EXAM_TYPE_DESCRIPTION[t]).toBeTruthy();
    }
  });
});

describe("EXAM_TYPE_CONFIG sections", () => {
  it("PATCH has the two ICDRG lectura sections", () => {
    const keys = EXAM_TYPE_CONFIG.PATCH.sections.map((s) => s.sectionKey);
    expect(keys).toEqual(["lectura_48h", "lectura_96h"]);
  });

  it("MULTITEST_PANELS has 4 sections, FOOD_PANEL has 1", () => {
    expect(EXAM_TYPE_CONFIG.MULTITEST_PANELS.sections).toHaveLength(4);
    expect(EXAM_TYPE_CONFIG.FOOD_PANEL.sections).toHaveLength(1);
  });

  it("AEROALLERGENS_I groups pollen sections under PÓLENES", () => {
    const pollens = EXAM_TYPE_CONFIG.AEROALLERGENS_I.sections.filter((s) => s.group === "PÓLENES");
    expect(pollens.map((s) => s.sectionKey)).toEqual([
      "polenes_arboles",
      "polenes_gramineas",
      "polenes_malezas",
      "polenes_hongos",
    ]);
  });

  it("AEROALLERGENS_I and AEROALLERGENS_II share the same section skeleton", () => {
    const i = EXAM_TYPE_CONFIG.AEROALLERGENS_I.sections.map((s) => s.sectionKey);
    const ii = EXAM_TYPE_CONFIG.AEROALLERGENS_II.sections.map((s) => s.sectionKey);
    expect(i).toEqual(ii);
  });

  it("every section has stable non-empty sectionKey + label", () => {
    for (const t of EXAM_TYPE_ORDER) {
      for (const s of EXAM_TYPE_CONFIG[t].sections) {
        expect(s.sectionKey).toMatch(/\S/);
        expect(s.label).toMatch(/\S/);
      }
    }
  });

  it("every config has defaultNotes disclaimer", () => {
    for (const t of EXAM_TYPE_ORDER) {
      expect(EXAM_TYPE_CONFIG[t].defaultNotes).toMatch(/\S/);
    }
  });
});

describe("composeReactionLines", () => {
  it("returns the 'Sin reacción' fallback when no reactions exist", () => {
    expect(composeReactionLines([])).toEqual(["Sin reacción a alérgenos testeados."]);
  });

  it("treats only-NEGATIVA inputs as no-positive case", () => {
    const result = composeReactionLines([
      { reaction: "NEGATIVA", allergenName: "Polvo de hogar" },
      { reaction: "NEGATIVA", allergenName: "Caspa de gato" },
    ]);
    expect(result).toEqual(["Sin reacción positiva a alérgenos testeados."]);
  });

  it("groups positives by reaction class and preserves DEBIL → MODERADA → FUERTE order", () => {
    const result = composeReactionLines([
      { reaction: "FUERTE", allergenName: "Polen de gramínea" },
      { reaction: "DEBIL", allergenName: "Hongo Alternaria" },
      { reaction: "MODERADA", allergenName: "Ácaro D. pteronyssinus" },
      { reaction: "FUERTE", allergenName: "Polen de olivo" },
    ]);
    expect(result).toEqual([
      `${REACTION_LABEL.DEBIL} con: Hongo Alternaria.`,
      `${REACTION_LABEL.MODERADA} con: Ácaro D. pteronyssinus.`,
      `${REACTION_LABEL.FUERTE} con: Polen de gramínea, Polen de olivo.`,
    ]);
  });

  it("ignores NEGATIVA entries when positives are present", () => {
    const result = composeReactionLines([
      { reaction: "NEGATIVA", allergenName: "Caspa de gato" },
      { reaction: "MODERADA", allergenName: "Ácaro" },
    ]);
    expect(result).toEqual([`${REACTION_LABEL.MODERADA} con: Ácaro.`]);
  });

  it("joins multiple allergens of the same class with comma + space", () => {
    const result = composeReactionLines([
      { reaction: "DEBIL", allergenName: "A" },
      { reaction: "DEBIL", allergenName: "B" },
      { reaction: "DEBIL", allergenName: "C" },
    ]);
    expect(result).toEqual([`${REACTION_LABEL.DEBIL} con: A, B, C.`]);
  });
});

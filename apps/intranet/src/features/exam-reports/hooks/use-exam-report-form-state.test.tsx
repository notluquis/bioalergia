/**
 * Tests for `useExamReportFormState` — the shared seed hook for the
 * exam-report wizard. Covers:
 *   - create-mode: empty seed + examType-driven reseed
 *   - edit-mode: every field rehydrates from `initialReport`
 *   - edit-mode: examType change does NOT wipe persisted sections
 *   - controlsSource derivation from persisted vs absent values
 */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { type InitialReportSeed, useExamReportFormState } from "./use-exam-report-form-state";

const baseInitial: InitialReportSeed = {
  id: 42,
  examType: "MULTITEST_PANELS",
  conclusionText: "Piel reactiva valida el examen.",
  conclusionTemplateId: 7,
  notes: "Nota persistida",
  histamineMm: 5.5,
  salineMm: 0,
  doctorName: "Dra. Persistida",
  doctorSpecialty: "Inmunología",
  doctorRut: "11.111.111-1",
  reagents: "Histamina 1mg/mL",
  technique: "Prick test",
  sections: [
    {
      sectionKey: "panel_1",
      label: "Panel 1",
      reactions: [
        {
          allergenId: "all_1",
          reaction: "FUERTE",
          papuleMm: 7,
          allergen: { commonName: "Dermatofagoides" },
        },
      ],
    },
  ],
};

describe("useExamReportFormState", () => {
  describe("create-mode (no initial)", () => {
    it("seeds with PATCH default examType + zero reactions", () => {
      const { result } = renderHook(() => useExamReportFormState());
      expect(result.current.isEdit).toBe(false);
      expect(result.current.examType).toBe("PATCH");
      expect(result.current.sections.every((s) => s.reactions.length === 0)).toBe(true);
      expect(result.current.controlsSource).toBeNull();
      expect(result.current.conclusionText).toBe("");
      expect(result.current.histamineMm).toBeNull();
    });

    it("reseeds sections when examType changes", () => {
      const { result } = renderHook(() => useExamReportFormState());
      const beforeKeys = result.current.sections.map((s) => s.sectionKey);
      act(() => result.current.setExamType("FOOD_PANEL"));
      const afterKeys = result.current.sections.map((s) => s.sectionKey);
      // Section template differs between PATCH and FOOD_PANEL, so the
      // shape must change after switching types in create-mode.
      expect(afterKeys).not.toEqual(beforeKeys);
    });
  });

  describe("edit-mode (initial provided)", () => {
    it("isEdit flag is true and every persisted field rehydrates", () => {
      const { result } = renderHook(() => useExamReportFormState(baseInitial));
      expect(result.current.isEdit).toBe(true);
      expect(result.current.examType).toBe("MULTITEST_PANELS");
      expect(result.current.conclusionText).toBe("Piel reactiva valida el examen.");
      expect(result.current.conclusionTemplateId).toBe(7);
      expect(result.current.histamineMm).toBe(5.5);
      expect(result.current.salineMm).toBe(0);
      expect(result.current.doctorName).toBe("Dra. Persistida");
      expect(result.current.doctorRut).toBe("11.111.111-1");
      expect(result.current.notes).toBe("Nota persistida");
    });

    it("sections rehydrate with persisted reactions", () => {
      const { result } = renderHook(() => useExamReportFormState(baseInitial));
      expect(result.current.sections).toHaveLength(1);
      const section = result.current.sections[0];
      expect(section).toBeDefined();
      if (!section) return;
      expect(section.sectionKey).toBe("panel_1");
      expect(section.reactions).toHaveLength(1);
      const reaction = section.reactions[0];
      expect(reaction).toBeDefined();
      if (!reaction) return;
      expect(reaction.allergenId).toBe("all_1");
      expect(reaction.allergenName).toBe("Dermatofagoides");
      expect(reaction.reaction).toBe("FUERTE");
      expect(reaction.papuleMm).toBe(7);
    });

    it("controlsSource is 'persisted' when histamineMm or salineMm is non-null", () => {
      const { result } = renderHook(() => useExamReportFormState(baseInitial));
      expect(result.current.controlsSource).toEqual({ kind: "persisted" });
    });

    it("controlsSource is null when both control values are null", () => {
      const { result } = renderHook(() =>
        useExamReportFormState({
          ...baseInitial,
          histamineMm: null,
          salineMm: null,
        })
      );
      expect(result.current.controlsSource).toBeNull();
    });

    it("changing examType does NOT wipe persisted sections in edit-mode", () => {
      const { result } = renderHook(() => useExamReportFormState(baseInitial));
      const before = result.current.sections.map((s) => s.sectionKey);
      act(() => result.current.setExamType("FOOD_PANEL"));
      const after = result.current.sections.map((s) => s.sectionKey);
      // Edit-mode locks the persisted sections regardless of type changes.
      expect(after).toEqual(before);
    });
  });
});

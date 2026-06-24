import { useEffect, useState } from "react";
import type { ExamType, SkinReaction } from "@finanzas/orpc-contracts/exam-reports";

import { EXAM_TYPE_CONFIG } from "../lib/exam-types";

/**
 * Shared form-state hook for the exam-report wizard. Centralises the
 * seed logic so both create-mode (blank from EXAM_TYPE_CONFIG, prefilled
 * from latest XLSX controls) and edit-mode (rehydrated from a persisted
 * `ExamReportDetail`) share the same state shape and the same React
 * setters.
 *
 * In edit-mode the `initialReport` argument is provided once on mount —
 * the hook seeds every field from it and locks `examType` change (the
 * caller passes `isEdit` so the section-reset effect doesn't wipe the
 * rehydrated reactions when examType is "already" PATCH).
 */

export interface DraftReaction {
  allergenId: string;
  allergenName: string;
  reaction: SkinReaction;
  papuleMm: number | null;
}

export interface DraftSection {
  id: string;
  sectionKey: string;
  label: string;
  reactions: DraftReaction[];
}

export type ControlsSource =
  | { kind: "xlsx"; date: string }
  | { kind: "persisted" }
  | { kind: "manual" }
  | null;

export interface InitialReportSeed {
  id: number;
  examType: ExamType;
  conclusionText: string;
  conclusionTemplateId: number | null;
  notes: string | null;
  histamineMm: number | null;
  salineMm: number | null;
  doctorName: string;
  doctorSpecialty: string;
  doctorRut: string | null;
  reagents: string | null;
  technique: string | null;
  sections: {
    sectionKey: string;
    label: string;
    reactions: {
      allergenId: string;
      reaction: SkinReaction;
      papuleMm: number | null;
      allergen: { commonName: string };
    }[];
  }[];
}

export interface ExamReportFormState {
  step: 1 | 2 | 3 | 4;
  setStep: (s: 1 | 2 | 3 | 4) => void;
  examType: ExamType;
  setExamType: (t: ExamType) => void;
  sections: DraftSection[];
  setSections: (s: DraftSection[]) => void;
  conclusionTemplateId: number | null;
  setConclusionTemplateId: (id: number | null) => void;
  conclusionText: string;
  setConclusionText: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  histamineMm: number | null;
  setHistamineMm: (v: number | null) => void;
  salineMm: number | null;
  setSalineMm: (v: number | null) => void;
  controlsSource: ControlsSource;
  setControlsSource: (s: ControlsSource) => void;
  doctorName: string;
  setDoctorName: (v: string) => void;
  doctorSpecialty: string;
  setDoctorSpecialty: (v: string) => void;
  doctorRut: string;
  setDoctorRut: (v: string) => void;
  /** True when seeded from a persisted report (edit-mode). */
  isEdit: boolean;
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function seedDraftSectionsFromConfig(examType: ExamType): DraftSection[] {
  const cfg = EXAM_TYPE_CONFIG[examType];
  return cfg.sections.map((s) => ({
    id: randomId(),
    sectionKey: s.sectionKey,
    label: s.label,
    reactions: [],
  }));
}

export function seedDraftSectionsFromInitial(initial: InitialReportSeed): DraftSection[] {
  return initial.sections.map((s) => ({
    id: randomId(),
    sectionKey: s.sectionKey,
    label: s.label,
    reactions: s.reactions.map((r) => ({
      allergenId: r.allergenId,
      allergenName: r.allergen.commonName,
      reaction: r.reaction,
      papuleMm: r.papuleMm,
    })),
  }));
}

export function useExamReportFormState(initial?: InitialReportSeed): ExamReportFormState {
  const isEdit = Boolean(initial);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [examType, setExamType] = useState<ExamType>(initial?.examType ?? "PATCH");
  const [sections, setSections] = useState<DraftSection[]>(() =>
    initial ? seedDraftSectionsFromInitial(initial) : seedDraftSectionsFromConfig("PATCH")
  );
  const [conclusionTemplateId, setConclusionTemplateId] = useState<number | null>(
    initial?.conclusionTemplateId ?? null
  );
  const [conclusionText, setConclusionText] = useState<string>(initial?.conclusionText ?? "");
  const [notes, setNotes] = useState<string>(
    initial?.notes ?? EXAM_TYPE_CONFIG[initial?.examType ?? "PATCH"].defaultNotes ?? ""
  );
  const [histamineMm, setHistamineMm] = useState<number | null>(initial?.histamineMm ?? null);
  const [salineMm, setSalineMm] = useState<number | null>(initial?.salineMm ?? null);
  const [controlsSource, setControlsSource] = useState<ControlsSource>(
    initial && (initial.histamineMm != null || initial.salineMm != null)
      ? { kind: "persisted" }
      : null
  );
  const [doctorName, setDoctorName] = useState<string>(initial?.doctorName ?? "");
  const [doctorSpecialty, setDoctorSpecialty] = useState<string>(initial?.doctorSpecialty ?? "");
  const [doctorRut, setDoctorRut] = useState<string>(initial?.doctorRut ?? "");

  // In CREATE mode only: reseed sections + notes when examType changes.
  // EDIT mode preserves the persisted sections — operator can't switch
  // examType anyway (the picker is hidden), so the effect is a noop.
  useEffect(() => {
    if (isEdit) return;
    setSections(seedDraftSectionsFromConfig(examType));
    const cfg = EXAM_TYPE_CONFIG[examType];
    setNotes(cfg.defaultNotes ?? "");
  }, [examType, isEdit]);

  return {
    step,
    setStep,
    examType,
    setExamType,
    sections,
    setSections,
    conclusionTemplateId,
    setConclusionTemplateId,
    conclusionText,
    setConclusionText,
    notes,
    setNotes,
    histamineMm,
    setHistamineMm,
    salineMm,
    setSalineMm,
    controlsSource,
    setControlsSource,
    doctorName,
    setDoctorName,
    doctorSpecialty,
    setDoctorSpecialty,
    doctorRut,
    setDoctorRut,
    isEdit,
  };
}

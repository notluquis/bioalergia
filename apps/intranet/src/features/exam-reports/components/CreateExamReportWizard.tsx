import {
  Autocomplete,
  Button,
  Chip,
  Description,
  EmptyState,
  Form,
  Header,
  Input,
  Label,
  ListBox,
  Modal,
  NumberField,
  Radio,
  RadioGroup,
  ScrollShadow,
  SearchField,
  Select,
  Separator,
  Spinner,
  Tabs,
  TextArea,
  TextField,
  useFilter,
  type Key,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { CheckCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useToast } from "@/context/ToastContext";
import { fetchPatients } from "@/features/patients/api";

type Patient = Awaited<ReturnType<typeof fetchPatients>>[number];

import { examReportsORPCClient, toExamReportsApiError } from "../orpc";
import { examReportsKeys } from "../queries";
import {
  type ControlsSource,
  type DraftSection,
  type InitialReportSeed,
  useExamReportFormState,
} from "../hooks/use-exam-report-form-state";
import {
  EXAM_TYPE_CONFIG,
  EXAM_TYPE_DESCRIPTION,
  EXAM_TYPE_LABEL,
  EXAM_TYPE_ORDER,
} from "../lib/exam-types";
import { downloadExamReportPdf } from "../lib/pdf";
import type { ExamType, SkinReaction } from "@finanzas/orpc-contracts/exam-reports";

/**
 * Wizard to create OR edit an exam report. Patient is selected upstream
 * (PatientSelectModal) for create-mode; in edit-mode the patient is
 * derived from the persisted report and locked. Steps:
 *
 *   1. Tipo de examen          (hidden in edit-mode — type is immutable)
 *   2. Alergenos por sección   (per pre-seeded section, pick allergens
 *                                from the catalog + reaction enum +
 *                                optional papule mm)
 *   3. Conclusión              (template dropdown + free-text override)
 *   4. Revisar + generar PDF   (server creates / updates the report,
 *                                client downloads the rendered PDF
 *                                immediately on create; edit just saves)
 */

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

const REACTION_OPTIONS: { value: SkinReaction; label: string }[] = [
  { value: "NEGATIVA", label: "Sin reacción" },
  { value: "DEBIL", label: "Positiva débil" },
  { value: "MODERADA", label: "Positiva moderada" },
  { value: "FUERTE", label: "Positiva fuerte" },
];

function computeAge(birthDate: string | null | undefined): string | null {
  if (!birthDate) return null;
  const years = dayjs().diff(dayjs(birthDate, "YYYY-MM-DD"), "year");
  return Number.isFinite(years) && years >= 0 ? `${years} años` : null;
}

function patientFullName(p: {
  person: { names: string; fatherName?: string | null; motherName?: string | null };
}): string {
  const { names, fatherName, motherName } = p.person;
  return [names, fatherName, motherName].filter(Boolean).join(" ");
}

export interface CreateExamReportWizardProps {
  /** Required in create-mode; optional in edit-mode (derived from `initialReport`). */
  patient?: Patient;
  /** When present → edit-mode. Seeds every field, locks patient + examType. */
  initialReport?: InitialReportSeed & {
    patient: {
      id: number;
      birthDate: string | null;
      person: {
        names: string;
        fatherName: string | null;
        motherName: string | null;
        rut: string | null;
      };
    };
  };
  isOpen: boolean;
  onClose: () => void;
}

export function CreateExamReportWizard({
  patient,
  initialReport,
  isOpen,
  onClose,
}: CreateExamReportWizardProps) {
  const toast = useToast();
  const qc = useQueryClient();

  const form = useExamReportFormState(initialReport);
  const isEdit = form.isEdit;

  // Resolve the effective patient: create-mode = prop; edit-mode = from
  // initialReport (its shape is a superset of `Patient` minus the
  // payment/consultation history the wizard never touches).
  const effectivePatient = useMemo<{
    id: number;
    birthDate: string | null;
    person: {
      names: string;
      fatherName: string | null;
      motherName: string | null;
      rut: string | null;
    };
  } | null>(() => {
    if (initialReport) return initialReport.patient;
    if (patient) {
      return {
        id: patient.id,
        birthDate:
          "birthDate" in patient && typeof patient.birthDate === "string"
            ? patient.birthDate
            : null,
        person: {
          names: patient.person.names,
          fatherName: patient.person.fatherName ?? null,
          motherName: patient.person.motherName ?? null,
          rut: patient.person.rut ?? null,
        },
      };
    }
    return null;
  }, [patient, initialReport]);

  const templatesQ = useQuery(examReportsKeys.templates(form.examType));
  // Default-conclusion seed: ONLY in create-mode and only if the user
  // hasn't picked a template yet. Edit-mode keeps the persisted text.
  useEffect(() => {
    if (isEdit) return;
    const tpls = templatesQ.data?.templates;
    if (!tpls || form.conclusionTemplateId !== null) return;
    const def = tpls.find((t) => t.isDefault) ?? tpls[0];
    if (def) {
      form.setConclusionTemplateId(def.id);
      form.setConclusionText(def.text);
    }
  }, [templatesQ.data, form, isEdit]);

  const settingsQ = useQuery(examReportsKeys.clinicSettings());
  const allergensQ = useQuery(examReportsKeys.allergens({ limit: 500 }));
  const latestControlsQ = useQuery(
    examReportsKeys.latestPatientControls(effectivePatient?.id ?? 0)
  );

  // XLSX prefill — create-mode only AND only when no persisted source.
  useEffect(() => {
    if (isEdit) return;
    if (form.controlsSource !== null) return;
    const lc = latestControlsQ.data;
    if (!lc) return;
    if (lc.histamineMm == null && lc.salineMm == null) return;
    form.setHistamineMm(lc.histamineMm);
    form.setSalineMm(lc.salineMm);
    form.setControlsSource({ kind: "xlsx", date: lc.testDate ?? "—" });
  }, [latestControlsQ.data, form, isEdit]);

  // Doctor info defaults: in CREATE mode, fall back to ClinicSettings if
  // operator hasn't typed anything. Edit-mode preserves persisted values.
  useEffect(() => {
    if (isEdit) return;
    const s = settingsQ.data;
    if (!s) return;
    if (!form.doctorName) form.setDoctorName(s.doctorName);
    if (!form.doctorSpecialty) form.setDoctorSpecialty(s.doctorSpecialty);
    if (!form.doctorRut && s.doctorRut) form.setDoctorRut(s.doctorRut);
  }, [settingsQ.data, form, isEdit]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!effectivePatient) throw new Error("Falta paciente");
      return examReportsORPCClient.create({
        patientId: effectivePatient.id,
        examType: form.examType,
        conclusionText: form.conclusionText,
        conclusionTemplateId: form.conclusionTemplateId,
        notes: form.notes || null,
        histamineMm: form.histamineMm,
        salineMm: form.salineMm,
        doctorName: form.doctorName || undefined,
        doctorSpecialty: form.doctorSpecialty || undefined,
        doctorRut: form.doctorRut || null,
        sections: form.sections.map((s, sIdx) => ({
          sectionKey: s.sectionKey,
          label: s.label,
          position: sIdx,
          reactions: s.reactions.map((r, rIdx) => ({
            allergenId: r.allergenId,
            reaction: r.reaction,
            papuleMm: r.papuleMm,
            position: rIdx,
          })),
        })),
      });
    },
    onSuccess: async (created) => {
      void qc.invalidateQueries({ queryKey: examReportsKeys.lists() });
      const settings = settingsQ.data;
      if (settings && effectivePatient) {
        await downloadExamReportPdf(
          {
            examType: created.examType,
            conclusionText: created.conclusionText,
            reagents: created.reagents,
            technique: created.technique,
            notes: created.notes,
            doctorName: created.doctorName,
            doctorSpecialty: created.doctorSpecialty,
            doctorRut: created.doctorRut,
            patient: {
              fullName: patientFullName(created.patient),
              age: computeAge(created.patient.birthDate),
              rut: created.patient.person.rut,
            },
            sections: created.sections.map((s) => ({
              sectionKey: s.sectionKey,
              label: s.label,
              reactions: s.reactions.map((r) => ({
                reaction: r.reaction,
                allergen: r.allergen,
                papuleMm: r.papuleMm,
              })),
            })),
            controls: { histamineMm: form.histamineMm, salineMm: form.salineMm },
          },
          settings,
          `informe-${EXAM_TYPE_LABEL[created.examType].replace(/\s+/g, "-")}-${created.id}.pdf`
        );
        await examReportsORPCClient.markGenerated({ id: created.id });
      }
      toast.success("Informe creado y descargado");
      onClose();
    },
    onError: (err) => toast.error(toExamReportsApiError(err).message),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!initialReport) throw new Error("Falta initialReport para edit-mode");
      return examReportsORPCClient.update({
        id: initialReport.id,
        conclusionText: form.conclusionText,
        conclusionTemplateId: form.conclusionTemplateId,
        notes: form.notes || null,
        histamineMm: form.histamineMm,
        salineMm: form.salineMm,
        doctorName: form.doctorName || undefined,
        doctorSpecialty: form.doctorSpecialty || undefined,
        doctorRut: form.doctorRut || null,
        sections: form.sections.map((s, sIdx) => ({
          sectionKey: s.sectionKey,
          label: s.label,
          position: sIdx,
          reactions: s.reactions.map((r, rIdx) => ({
            allergenId: r.allergenId,
            reaction: r.reaction,
            papuleMm: r.papuleMm,
            position: rIdx,
          })),
        })),
      });
    },
    onSuccess: (updated) => {
      void qc.invalidateQueries({ queryKey: examReportsKeys.lists() });
      void qc.invalidateQueries({ queryKey: examReportsKeys.detail(updated.id).queryKey });
      toast.success("Informe actualizado");
      onClose();
    },
    onError: (err) => toast.error(toExamReportsApiError(err).message),
  });

  const activeMutation = isEdit ? updateMutation : createMutation;

  const canSubmit =
    !activeMutation.isPending &&
    form.conclusionText.trim().length > 0 &&
    form.sections.some((s) => s.reactions.length > 0);

  const headerTitle = isEdit
    ? `Editar informe — ${effectivePatient ? patientFullName(effectivePatient) : ""}`
    : `Nuevo Informe — ${effectivePatient ? patientFullName(effectivePatient) : ""}`;

  return (
    <Modal>
      <Modal.Backdrop
        className="bg-black/40 backdrop-blur-[2px]"
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative flex h-[90dvh] w-full max-w-3xl flex-col rounded-[28px] bg-background p-0 shadow-2xl">
            <Modal.Header className="border-default-100 border-b px-6 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Modal.Heading
                    className="font-bold text-primary text-lg"
                    data-testid="exam-report-wizard-heading"
                  >
                    {headerTitle}
                  </Modal.Heading>
                  <p className="text-default-600 text-xs">
                    Paso {form.step} de 4 · {EXAM_TYPE_LABEL[form.examType]}
                    {isEdit ? " · edición" : ""}
                  </p>
                </div>
                <Tabs
                  selectedKey={String(form.step)}
                  onSelectionChange={(k) => form.setStep(Number(k) as 1 | 2 | 3 | 4)}
                >
                  <Tabs.ListContainer>
                    <Tabs.List
                      aria-label="Pasos"
                      className="max-md:overflow-x-auto max-md:[scrollbar-width:none] max-md:[&>*]:shrink-0 max-md:[&>*]:!w-auto"
                    >
                      <Tabs.Tab id="1" isDisabled={isEdit}>
                        1. Tipo
                      </Tabs.Tab>
                      <Tabs.Tab id="2">2. Alérgenos</Tabs.Tab>
                      <Tabs.Tab id="3">3. Conclusión</Tabs.Tab>
                      <Tabs.Tab id="4">4. Revisar</Tabs.Tab>
                    </Tabs.List>
                  </Tabs.ListContainer>
                </Tabs>
              </div>
            </Modal.Header>
            <Modal.Body className="flex-1 overflow-hidden p-0">
              <ScrollShadow className="h-full overflow-y-auto p-6">
                {form.step === 1 && !isEdit && (
                  <Step1Type examType={form.examType} onChange={form.setExamType} />
                )}
                {form.step === 1 && isEdit && (
                  <div className="rounded-2xl border border-default-200 bg-default-50/40 p-6 text-sm text-default-700">
                    <p>
                      Tipo de examen: <strong>{EXAM_TYPE_LABEL[form.examType]}</strong>
                    </p>
                    <p className="mt-1 text-default-600 text-xs">
                      No se puede cambiar el tipo de un informe ya creado.
                    </p>
                  </div>
                )}
                {form.step === 2 && (
                  <Step2Allergens
                    sections={form.sections}
                    onChange={form.setSections}
                    allergens={allergensQ.data?.allergens ?? []}
                    isLoading={allergensQ.isLoading}
                    histamineMm={form.histamineMm}
                    salineMm={form.salineMm}
                    controlsSource={form.controlsSource}
                    onHistamineChange={(v) => {
                      form.setHistamineMm(v);
                      form.setControlsSource({ kind: "manual" });
                    }}
                    onSalineChange={(v) => {
                      form.setSalineMm(v);
                      form.setControlsSource({ kind: "manual" });
                    }}
                  />
                )}
                {form.step === 3 && (
                  <Step3Conclusion
                    templates={templatesQ.data?.templates ?? []}
                    templateId={form.conclusionTemplateId}
                    onTemplateChange={(id) => {
                      form.setConclusionTemplateId(id);
                      const t = templatesQ.data?.templates.find((x) => x.id === id);
                      if (t) form.setConclusionText(t.text);
                    }}
                    text={form.conclusionText}
                    onTextChange={form.setConclusionText}
                    notes={form.notes}
                    onNotesChange={form.setNotes}
                    doctorName={form.doctorName}
                    onDoctorNameChange={form.setDoctorName}
                    doctorSpecialty={form.doctorSpecialty}
                    onDoctorSpecialtyChange={form.setDoctorSpecialty}
                    doctorRut={form.doctorRut}
                    onDoctorRutChange={form.setDoctorRut}
                  />
                )}
                {form.step === 4 && (
                  <Step4Review
                    examType={form.examType}
                    sections={form.sections}
                    conclusionText={form.conclusionText}
                    notes={form.notes}
                    settings={settingsQ.data}
                    doctorOverride={{
                      name: form.doctorName,
                      specialty: form.doctorSpecialty,
                      rut: form.doctorRut,
                    }}
                  />
                )}
              </ScrollShadow>
            </Modal.Body>
            <Modal.Footer className="border-default-100 border-t px-6 py-3">
              <div className="flex w-full items-center justify-between gap-3">
                <Button
                  isDisabled={form.step === 1}
                  onPress={() => form.setStep(Math.max(1, form.step - 1) as 1 | 2 | 3 | 4)}
                  variant="outline"
                >
                  Atrás
                </Button>
                {form.step < 4 ? (
                  <Button onPress={() => form.setStep(Math.min(4, form.step + 1) as 1 | 2 | 3 | 4)}>
                    Siguiente
                  </Button>
                ) : (
                  <Button
                    data-testid="exam-report-wizard-submit"
                    isDisabled={!canSubmit}
                    isPending={activeMutation.isPending}
                    onPress={() => activeMutation.mutate()}
                  >
                    <CheckCircle className="size-4" />
                    {isEdit ? "Guardar cambios" : "Generar y descargar PDF"}
                  </Button>
                )}
              </div>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

// ── Step 1: Exam type picker ───────────────────────────────────────────

function Step1Type({
  examType,
  onChange,
}: {
  examType: ExamType;
  onChange: (t: ExamType) => void;
}) {
  return (
    <RadioGroup
      aria-label="Tipo de examen"
      onChange={(v) => onChange(v as ExamType)}
      value={examType}
    >
      <div className="grid gap-2 md:grid-cols-2">
        {EXAM_TYPE_ORDER.map((t) => {
          const sectionCount = EXAM_TYPE_CONFIG[t].sections.length;
          const sectionsLabel =
            sectionCount === 1 ? "1 sección prediseñada" : `${sectionCount} secciones prediseñadas`;
          return (
            <Radio
              className="rounded-2xl border border-default-200 p-4 data-[selected=true]:border-primary data-[selected=true]:bg-primary/5"
              key={t}
              value={t}
            >
              <div className="flex flex-col gap-1.5">
                <span className="font-semibold text-foreground">{EXAM_TYPE_LABEL[t]}</span>
                <span className="text-default-600 text-xs leading-snug">
                  {EXAM_TYPE_DESCRIPTION[t]}
                </span>
                <span className="text-default-500 text-xs">{sectionsLabel}</span>
              </div>
            </Radio>
          );
        })}
      </div>
    </RadioGroup>
  );
}

// ── Step 2: Allergens per section ──────────────────────────────────────

function Step2Allergens({
  sections,
  onChange,
  allergens,
  isLoading,
  histamineMm,
  salineMm,
  controlsSource,
  onHistamineChange,
  onSalineChange,
}: {
  sections: DraftSection[];
  onChange: (s: DraftSection[]) => void;
  allergens: { id: string; commonName: string; category: string }[];
  isLoading: boolean;
  histamineMm: number | null;
  salineMm: number | null;
  controlsSource: ControlsSource;
  onHistamineChange: (v: number | null) => void;
  onSalineChange: (v: number | null) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-default-600">
        <Spinner size="sm" />
        Cargando alérgenos…
      </div>
    );
  }

  const updateSection = (idx: number, patch: Partial<DraftSection>) => {
    const next = sections.slice();
    next[idx] = { ...next[idx], ...patch } as DraftSection;
    onChange(next);
  };

  const removeSection = (idx: number) => {
    onChange(sections.filter((_, i) => i !== idx));
  };

  const addSection = () => {
    onChange([
      ...sections,
      {
        id: randomId(),
        sectionKey: `custom_${randomId()}`,
        label: `Sección ${sections.length + 1}`,
        reactions: [],
      },
    ]);
  };

  return (
    <div className="space-y-6">
      <ControlsBlock
        histamineMm={histamineMm}
        salineMm={salineMm}
        source={controlsSource}
        onHistamineChange={onHistamineChange}
        onSalineChange={onSalineChange}
      />
      {sections.length === 0 && (
        <EmptyState className="rounded-2xl border border-default-200 border-dashed p-6 text-center">
          Sin secciones. Comienza desde cero agregando paneles personalizados, o vuelve al paso 1
          para elegir un tipo preestablecido.
        </EmptyState>
      )}
      {sections.map((section, sIdx) => (
        <section className="rounded-2xl border border-default-200 p-4" key={section.id}>
          <div className="mb-3 flex items-start justify-between gap-3">
            <EditableSectionLabel
              count={section.reactions.length}
              label={section.label}
              onChange={(label) => updateSection(sIdx, { label })}
            />
            <Button
              aria-label="Eliminar sección"
              isIconOnly
              onPress={() => removeSection(sIdx)}
              size="sm"
              variant="ghost"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <AllergenPicker
            allergens={allergens}
            excludeIds={section.reactions.map((r) => r.allergenId)}
            onAdd={(allergen) => {
              updateSection(sIdx, {
                reactions: [
                  ...section.reactions,
                  {
                    allergenId: allergen.id,
                    allergenName: allergen.commonName,
                    reaction: "MODERADA",
                    papuleMm: null,
                  },
                ],
              });
            }}
          />
          {section.reactions.length > 0 && (
            <div className="mt-3 space-y-2">
              {section.reactions.map((r, rIdx) => (
                <div
                  className="flex items-center gap-2 rounded-xl border border-default-100 bg-default-50/40 p-2"
                  key={r.allergenId}
                >
                  <span className="flex-1 truncate text-sm">{r.allergenName}</span>
                  <Select
                    aria-label="Reacción"
                    className="w-44"
                    onSelectionChange={(k) =>
                      updateSection(sIdx, {
                        reactions: section.reactions.map((rr, i) =>
                          i === rIdx ? { ...rr, reaction: k as SkinReaction } : rr
                        ),
                      })
                    }
                    selectedKey={r.reaction}
                  >
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {REACTION_OPTIONS.map((opt) => (
                          <ListBox.Item id={opt.value} key={opt.value}>
                            {opt.label}
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                  <NumberField
                    aria-label="Pápula mm"
                    className="w-24"
                    formatOptions={{ maximumFractionDigits: 1 }}
                    minValue={0}
                    onChange={(v) =>
                      updateSection(sIdx, {
                        reactions: section.reactions.map((rr, i) =>
                          i === rIdx ? { ...rr, papuleMm: Number.isFinite(v) ? v : null } : rr
                        ),
                      })
                    }
                    value={r.papuleMm ?? undefined}
                  >
                    <NumberField.Group>
                      <NumberField.Input placeholder="mm" />
                    </NumberField.Group>
                  </NumberField>
                  <Button
                    aria-label="Quitar"
                    isIconOnly
                    onPress={() =>
                      updateSection(sIdx, {
                        reactions: section.reactions.filter((_, i) => i !== rIdx),
                      })
                    }
                    size="sm"
                    variant="outline"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
      <div className="flex justify-center">
        <Button className="gap-2" onPress={addSection} size="sm" variant="outline">
          <Plus className="size-4" />
          Agregar sección personalizada
        </Button>
      </div>
    </div>
  );
}

// ── Controls block (histamine + saline mm) ─────────────────────────────
function ControlsBlock({
  histamineMm,
  salineMm,
  source,
  onHistamineChange,
  onSalineChange,
}: {
  histamineMm: number | null;
  salineMm: number | null;
  source: ControlsSource;
  onHistamineChange: (v: number | null) => void;
  onSalineChange: (v: number | null) => void;
}) {
  const sourceLabel: string | null =
    source?.kind === "xlsx"
      ? `Origen: XLSX ${source.date} (editable)`
      : source?.kind === "persisted"
        ? "Origen: informe persistido (editable)"
        : null;
  return (
    <section
      aria-labelledby="exam-controls-heading"
      className="rounded-2xl border border-default-200 p-4"
      data-testid="exam-report-controls-block"
    >
      <header className="mb-2">
        <h3 className="font-bold text-primary text-sm" id="exam-controls-heading">
          Controles del examen
        </h3>
        <p className="text-default-600 text-xs">
          EAACI exige histamina ≥ 3 mm para validar el test; suero salino debe ser &lt; 3 mm.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Control positivo histamina (mm)</Label>
          <NumberField
            aria-label="Control positivo histamina en mm"
            data-testid="control-histamine-input"
            formatOptions={{ maximumFractionDigits: 1 }}
            maxValue={15}
            minValue={0}
            onChange={(v) => onHistamineChange(Number.isFinite(v) ? v : null)}
            value={histamineMm ?? undefined}
          >
            <NumberField.Group>
              <NumberField.Input placeholder="mm" />
            </NumberField.Group>
          </NumberField>
          {sourceLabel && (
            <Chip
              className="text-caption"
              color="accent"
              data-testid="control-histamine-source-chip"
              size="sm"
              variant="soft"
            >
              {sourceLabel}
            </Chip>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Control negativo suero salino (mm)</Label>
          <NumberField
            aria-label="Control negativo suero salino en mm"
            data-testid="control-saline-input"
            formatOptions={{ maximumFractionDigits: 1 }}
            maxValue={15}
            minValue={0}
            onChange={(v) => onSalineChange(Number.isFinite(v) ? v : null)}
            value={salineMm ?? undefined}
          >
            <NumberField.Group>
              <NumberField.Input placeholder="mm" />
            </NumberField.Group>
          </NumberField>
          {sourceLabel && (
            <Chip
              className="text-caption"
              color="accent"
              data-testid="control-saline-source-chip"
              size="sm"
              variant="soft"
            >
              {sourceLabel}
            </Chip>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Editable section label (click pencil to rename) ────────────────────

function EditableSectionLabel({
  label,
  count,
  onChange,
}: {
  label: string;
  count: number;
  onChange: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  useEffect(() => {
    if (!editing) setDraft(label);
  }, [label, editing]);

  if (editing) {
    return (
      <TextField aria-label="Nombre del panel" className="flex-1" onChange={setDraft} value={draft}>
        <Input
          autoFocus
          onBlur={() => {
            const next = draft.trim() || label;
            onChange(next);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const next = draft.trim() || label;
              onChange(next);
              setEditing(false);
            }
            if (e.key === "Escape") {
              setDraft(label);
              setEditing(false);
            }
          }}
        />
      </TextField>
    );
  }

  return (
    <Button
      aria-label={`Renombrar panel ${label}`}
      className="group flex flex-1 items-center gap-2 text-left"
      onPress={() => setEditing(true)}
      variant="ghost"
    >
      <h3 className="font-bold text-primary">{label}</h3>
      <Pencil className="size-3.5 text-default-500 opacity-0 transition group-hover:opacity-100" />
      <span className="ml-auto text-default-600 text-xs">
        {count === 1 ? "1 alérgeno" : `${count} alérgenos`}
      </span>
    </Button>
  );
}

// ── Allergen picker — inline Autocomplete (type-to-search) ─────────────

function AllergenPicker({
  allergens,
  excludeIds,
  onAdd,
}: {
  allergens: { id: string; commonName: string; category: string }[];
  excludeIds: string[];
  onAdd: (a: { id: string; commonName: string; category: string }) => void;
}) {
  const { contains } = useFilter({ sensitivity: "base" });
  const [pickerKey, setPickerKey] = useState(0);
  const [value, setValue] = useState<Key | null>(null);

  const available = useMemo(() => {
    const exclude = new Set(excludeIds);
    const filtered = allergens.filter((a) => !exclude.has(a.id));
    const buckets = new Map<string, typeof filtered>();
    for (const a of filtered) {
      const key = a.category || "Otros";
      const bucket = buckets.get(key) ?? [];
      bucket.push(a);
      buckets.set(key, bucket);
    }
    return Array.from(buckets.entries())
      .map(([category, items]) => ({
        category,
        items: items.sort((a, b) => a.commonName.localeCompare(b.commonName)),
      }))
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [allergens, excludeIds]);

  return (
    <Autocomplete
      aria-label="Agregar alérgeno"
      className="w-full"
      key={pickerKey}
      onChange={(k) => {
        const key = Array.isArray(k) ? k[0] : k;
        const picked = allergens.find((x) => x.id === String(key));
        if (picked) {
          onAdd(picked);
          setValue(null);
          setPickerKey((n) => n + 1);
        } else {
          setValue(k as Key | null);
        }
      }}
      placeholder="Buscar y agregar alérgeno…"
      selectionMode="single"
      value={value}
    >
      <Autocomplete.Trigger>
        <Autocomplete.Value />
        <Autocomplete.ClearButton />
        <Autocomplete.Indicator />
      </Autocomplete.Trigger>
      <Autocomplete.Popover>
        <Autocomplete.Filter filter={contains}>
          <SearchField autoFocus name="search" variant="secondary">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Escribe para buscar…" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <ListBox renderEmptyState={() => <EmptyState>Sin resultados</EmptyState>}>
            {available.map((group) => (
              <ListBox.Section key={group.category}>
                <Header>{group.category}</Header>
                {group.items.map((a) => (
                  <ListBox.Item id={a.id} key={a.id} textValue={a.commonName}>
                    {a.commonName}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox.Section>
            ))}
          </ListBox>
        </Autocomplete.Filter>
      </Autocomplete.Popover>
    </Autocomplete>
  );
}

// ── Step 3: Conclusion + notes + doctor info ───────────────────────────

function Step3Conclusion({
  templates,
  templateId,
  onTemplateChange,
  text,
  onTextChange,
  notes,
  onNotesChange,
  doctorName,
  onDoctorNameChange,
  doctorSpecialty,
  onDoctorSpecialtyChange,
  doctorRut,
  onDoctorRutChange,
}: {
  templates: { id: number; text: string; isDefault: boolean }[];
  templateId: number | null;
  onTemplateChange: (id: number | null) => void;
  text: string;
  onTextChange: (v: string) => void;
  notes: string;
  onNotesChange: (v: string) => void;
  doctorName: string;
  onDoctorNameChange: (v: string) => void;
  doctorSpecialty: string;
  onDoctorSpecialtyChange: (v: string) => void;
  doctorRut: string;
  onDoctorRutChange: (v: string) => void;
}) {
  return (
    <Form className="space-y-4">
      <TextField className="w-full" name="conclusion" value={text} onChange={onTextChange}>
        <Label>Conclusión del examen</Label>
        <TextArea placeholder="Ej. Piel reactiva valida el examen" rows={3} />
        <Description>Aparece bajo "CONCLUSION EXAMEN" en el PDF.</Description>
      </TextField>

      <div className="space-y-1">
        <Label>Plantilla rápida</Label>
        <Select
          aria-label="Plantilla de conclusión"
          onSelectionChange={(k) => onTemplateChange(k ? Number(k) : null)}
          selectedKey={templateId ? String(templateId) : null}
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {templates.map((t) => (
                <ListBox.Item id={String(t.id)} key={t.id}>
                  {t.text}
                  {t.isDefault ? " (predeterminada)" : ""}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      <TextField className="w-full" name="notes" value={notes} onChange={onNotesChange}>
        <Label>Nota al pie (opcional)</Label>
        <TextArea
          placeholder="*solo se considera reacción positiva con pápula mayor a 3 mm"
          rows={2}
        />
      </TextField>

      <Separator />

      <div className="grid gap-3 md:grid-cols-3">
        <TextField
          className="w-full"
          name="doctorName"
          onChange={onDoctorNameChange}
          value={doctorName}
        >
          <Label>Médico</Label>
          <Input placeholder="Nombre del médico" />
        </TextField>
        <TextField
          className="w-full"
          name="doctorSpecialty"
          onChange={onDoctorSpecialtyChange}
          value={doctorSpecialty}
        >
          <Label>Especialidad</Label>
          <Input placeholder="Inmunología clínica" />
        </TextField>
        <TextField
          className="w-full"
          name="doctorRut"
          onChange={onDoctorRutChange}
          value={doctorRut}
        >
          <Label>RUT del médico</Label>
          <Input placeholder="12.345.678-9" />
        </TextField>
      </div>
    </Form>
  );
}

// ── Step 4: Review preview ─────────────────────────────────────────────

function Step4Review({
  examType,
  sections,
  conclusionText,
  notes,
  settings,
  doctorOverride,
}: {
  examType: ExamType;
  sections: DraftSection[];
  conclusionText: string;
  notes: string;
  settings:
    | {
        doctorName: string;
        doctorSpecialty: string;
        defaultReagents: string;
        defaultTechnique: string;
      }
    | undefined;
  doctorOverride: { name: string; specialty: string; rut: string };
}) {
  const cfg = EXAM_TYPE_CONFIG[examType];
  const totalReactions = sections.reduce((acc, s) => acc + s.reactions.length, 0);
  const effectiveDoctorName = doctorOverride.name || settings?.doctorName || "—";
  const effectiveDoctorSpecialty = doctorOverride.specialty || settings?.doctorSpecialty || "—";
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-default-200 bg-default-50/30 p-4">
        <h3 className="mb-2 font-bold text-primary">{cfg.title}</h3>
        <p className="text-default-700 text-sm">
          <strong>CONCLUSION EXAMEN:</strong> {conclusionText || "—"}
        </p>
      </div>
      <div className="rounded-2xl border border-default-200 p-4">
        <h4 className="mb-2 font-bold">Resumen</h4>
        <ul className="space-y-1 text-sm text-default-700">
          <li>{sections.filter((s) => s.reactions.length > 0).length} sección(es) con datos</li>
          <li>{totalReactions} reacción(es) registrada(s)</li>
          {notes && <li className="italic">{notes}</li>}
        </ul>
      </div>
      <Separator />
      <p className="text-default-600 text-xs">
        Firma como: <strong>{effectiveDoctorName}</strong> ({effectiveDoctorSpecialty})
      </p>
      <p className="text-default-600 text-xs">
        Reactivos: {settings?.defaultReagents ?? "—"} · Técnica: {settings?.defaultTechnique ?? "—"}
      </p>
    </div>
  );
}

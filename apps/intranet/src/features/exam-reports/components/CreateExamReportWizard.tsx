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
  EXAM_TYPE_CONFIG,
  EXAM_TYPE_DESCRIPTION,
  EXAM_TYPE_LABEL,
  EXAM_TYPE_ORDER,
} from "../lib/exam-types";
import { downloadExamReportPdf } from "../lib/pdf";
import type { ExamType, SkinReaction } from "@finanzas/orpc-contracts/exam-reports";

/**
 * Wizard to create an exam report. Patient is selected upstream
 * (PatientSelectModal) — same flow as CreateShipmentWizard. Steps:
 *
 *   1. Tipo de examen          (radio of the 5 ExamTypes)
 *   2. Alergenos por sección   (per pre-seeded section, pick allergens
 *                                from the catalog + reaction enum +
 *                                optional papule mm)
 *   3. Conclusión              (template dropdown + free-text override)
 *   4. Revisar + generar PDF   (server creates the report, client
 *                                downloads the rendered PDF immediately)
 */

interface DraftReaction {
  allergenId: string;
  allergenName: string;
  reaction: SkinReaction;
  papuleMm: number | null;
}

interface DraftSection {
  /** Stable client-side id (React key + section delete target). */
  id: string;
  /** API-side section key. Preseed sections keep their canonical key
   *  ("panel_1", "lectura_48h", …); user-added sections get a
   *  `custom_<short-id>` so the server can disambiguate. */
  sectionKey: string;
  /** Editable label shown in the UI and printed in the PDF. */
  label: string;
  reactions: DraftReaction[];
}

function randomId(): string {
  // 8 hex chars — collision-proof for the ~10 sections a single report
  // could ever realistically hold. Avoids `crypto.randomUUID()` to keep
  // older Safari happy on the iPad use case.
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

export function CreateExamReportWizard({
  patient,
  isOpen,
  onClose,
}: {
  patient: Patient;
  isOpen: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const qc = useQueryClient();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [examType, setExamType] = useState<ExamType>("PATCH");
  const [sections, setSections] = useState<DraftSection[]>([]);
  const [conclusionTemplateId, setConclusionTemplateId] = useState<number | null>(null);
  const [conclusionText, setConclusionText] = useState("");
  const [notes, setNotes] = useState<string>("");
  // ── Controls (validity gates printed on the PDF) ──────────────────────
  // Operator can either (a) let the wizard pre-fill from the most recent
  // XLSX skin-test snapshot or (b) type the mm values manually. Default
  // state is "not yet set" (null) so the PDF renders "—" when neither
  // path produces a value.
  const [histamineMm, setHistamineMm] = useState<number | null>(null);
  const [salineMm, setSalineMm] = useState<number | null>(null);
  // Source of currently-shown values — drives the visible "Origen: XLSX
  // <date>" chip. Flips back to "manual" the moment the operator edits a
  // field; nulls suppress the chip entirely.
  const [controlsSource, setControlsSource] = useState<
    { kind: "xlsx"; date: string } | { kind: "manual" } | null
  >(null);

  // Reset draft sections every time examType changes — the seed
  // sections are different per type and we don't want stale entries.
  // Each section gets a stable client-side id for React keys + delete
  // targeting; preseeded sections keep their canonical sectionKey so
  // the PDF renderer can apply per-type formatting (POLENES grouping
  // etc.) — user-added sections fall through to the flat layout.
  useEffect(() => {
    const cfg = EXAM_TYPE_CONFIG[examType];
    setSections(
      cfg.sections.map((s) => ({
        id: randomId(),
        sectionKey: s.sectionKey,
        label: s.label,
        reactions: [],
      }))
    );
    setNotes(cfg.defaultNotes ?? "");
  }, [examType]);

  // Seed with the universal default conclusion on open / type change.
  const templatesQ = useQuery(examReportsKeys.templates(examType));
  useEffect(() => {
    const tpls = templatesQ.data?.templates;
    if (!tpls || conclusionTemplateId !== null) return;
    const def = tpls.find((t) => t.isDefault) ?? tpls[0];
    if (def) {
      setConclusionTemplateId(def.id);
      setConclusionText(def.text);
    }
  }, [templatesQ.data, conclusionTemplateId]);

  const settingsQ = useQuery(examReportsKeys.clinicSettings());
  const allergensQ = useQuery(examReportsKeys.allergens({ limit: 500 }));
  const latestControlsQ = useQuery(examReportsKeys.latestPatientControls(patient.id));

  // Prefill from XLSX skin-test snapshot exactly once. Operator edits
  // (which set controlsSource="manual") take precedence forever.
  useEffect(() => {
    if (controlsSource !== null) return;
    const lc = latestControlsQ.data;
    if (!lc) return;
    if (lc.histamineMm == null && lc.salineMm == null) return;
    setHistamineMm(lc.histamineMm);
    setSalineMm(lc.salineMm);
    setControlsSource({ kind: "xlsx", date: lc.testDate ?? "—" });
  }, [latestControlsQ.data, controlsSource]);

  const createMutation = useMutation({
    mutationFn: () =>
      examReportsORPCClient.create({
        patientId: patient.id,
        examType,
        conclusionText,
        conclusionTemplateId,
        notes: notes || null,
        // Persist controls so reopening the report round-trips them.
        // Either field may be null (operator skipped it); the server
        // stores null verbatim and the PDF renders "—" as before.
        histamineMm,
        salineMm,
        sections: sections.map((s, sIdx) => ({
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
      }),
    onSuccess: async (created) => {
      void qc.invalidateQueries({ queryKey: examReportsKeys.lists() });
      const settings = settingsQ.data;
      if (settings) {
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
            controls: { histamineMm, salineMm },
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

  const canSubmit =
    !createMutation.isPending &&
    conclusionText.trim().length > 0 &&
    sections.some((s) => s.reactions.length > 0);

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
                  <Modal.Heading className="font-bold text-primary text-lg">
                    Nuevo Informe — {patientFullName(patient)}
                  </Modal.Heading>
                  <p className="text-default-600 text-xs">
                    Paso {step} de 4 · {EXAM_TYPE_LABEL[examType]}
                  </p>
                </div>
                <Tabs
                  selectedKey={String(step)}
                  onSelectionChange={(k) => setStep(Number(k) as 1 | 2 | 3 | 4)}
                >
                  <Tabs.ListContainer>
                    <Tabs.List
                      aria-label="Pasos"
                      className="max-md:overflow-x-auto max-md:[scrollbar-width:none] max-md:[&>*]:shrink-0 max-md:[&>*]:!w-auto"
                    >
                      <Tabs.Tab id="1">1. Tipo</Tabs.Tab>
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
                {step === 1 && <Step1Type examType={examType} onChange={setExamType} />}
                {step === 2 && (
                  <Step2Allergens
                    sections={sections}
                    onChange={setSections}
                    allergens={allergensQ.data?.allergens ?? []}
                    isLoading={allergensQ.isLoading}
                    histamineMm={histamineMm}
                    salineMm={salineMm}
                    controlsSource={controlsSource}
                    onHistamineChange={(v) => {
                      setHistamineMm(v);
                      setControlsSource({ kind: "manual" });
                    }}
                    onSalineChange={(v) => {
                      setSalineMm(v);
                      setControlsSource({ kind: "manual" });
                    }}
                  />
                )}
                {step === 3 && (
                  <Step3Conclusion
                    templates={templatesQ.data?.templates ?? []}
                    templateId={conclusionTemplateId}
                    onTemplateChange={(id) => {
                      setConclusionTemplateId(id);
                      const t = templatesQ.data?.templates.find((x) => x.id === id);
                      if (t) setConclusionText(t.text);
                    }}
                    text={conclusionText}
                    onTextChange={setConclusionText}
                    notes={notes}
                    onNotesChange={setNotes}
                  />
                )}
                {step === 4 && (
                  <Step4Review
                    examType={examType}
                    sections={sections}
                    conclusionText={conclusionText}
                    notes={notes}
                    settings={settingsQ.data}
                  />
                )}
              </ScrollShadow>
            </Modal.Body>
            <Modal.Footer className="border-default-100 border-t px-6 py-3">
              <div className="flex w-full items-center justify-between gap-3">
                <Button
                  isDisabled={step === 1}
                  onPress={() => setStep((s) => Math.max(1, s - 1) as 1 | 2 | 3 | 4)}
                  variant="outline"
                >
                  Atrás
                </Button>
                {step < 4 ? (
                  <Button onPress={() => setStep((s) => Math.min(4, s + 1) as 1 | 2 | 3 | 4)}>
                    Siguiente
                  </Button>
                ) : (
                  <Button
                    isDisabled={!canSubmit}
                    isPending={createMutation.isPending}
                    onPress={() => createMutation.mutate()}
                  >
                    <CheckCircle className="size-4" />
                    Generar y descargar PDF
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
  controlsSource: { kind: "xlsx"; date: string } | { kind: "manual" } | null;
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
//
// Two HeroUI v3 NumberFields wired to the wizard's local state. When a
// recent XLSX skin-test snapshot exists, the values are prefilled by the
// parent useEffect; a Chip next to each field shows "Origen: XLSX
// <fecha> (editable)" so the operator knows where the numbers came
// from. The moment they edit either field, source flips to "manual" and
// the chip disappears (parent state).
function ControlsBlock({
  histamineMm,
  salineMm,
  source,
  onHistamineChange,
  onSalineChange,
}: {
  histamineMm: number | null;
  salineMm: number | null;
  source: { kind: "xlsx"; date: string } | { kind: "manual" } | null;
  onHistamineChange: (v: number | null) => void;
  onSalineChange: (v: number | null) => void;
}) {
  const showXlsxChip = source?.kind === "xlsx";
  const xlsxDate = source?.kind === "xlsx" ? source.date : null;
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
          {showXlsxChip && (
            <Chip
              className="text-caption"
              color="accent"
              data-testid="control-histamine-source-chip"
              size="sm"
              variant="soft"
            >
              {`Origen: XLSX ${xlsxDate ?? "—"} (editable)`}
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
          {showXlsxChip && (
            <Chip
              className="text-caption"
              color="accent"
              data-testid="control-saline-source-chip"
              size="sm"
              variant="soft"
            >
              {`Origen: XLSX ${xlsxDate ?? "—"} (editable)`}
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
  // Keep local draft in sync if the label changes externally (e.g. type
  // switch repopulates sections) and we're not actively editing.
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
  /** Allergens already in this section — kept out of the dropdown so
   *  the operator can't double-add the same one. */
  excludeIds: string[];
  onAdd: (a: { id: string; commonName: string; category: string }) => void;
}) {
  const { contains } = useFilter({ sensitivity: "base" });
  // Reset trick: bumping `pickerKey` after a selection clears the
  // Autocomplete's internal state (search field + selected key), so the
  // picker feels like "add one at a time" instead of staying selected.
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
          // Force re-mount to clear the input + selected highlight.
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

// ── Step 3: Conclusion + notes ─────────────────────────────────────────

function Step3Conclusion({
  templates,
  templateId,
  onTemplateChange,
  text,
  onTextChange,
  notes,
  onNotesChange,
}: {
  templates: { id: number; text: string; isDefault: boolean }[];
  templateId: number | null;
  onTemplateChange: (id: number | null) => void;
  text: string;
  onTextChange: (v: string) => void;
  notes: string;
  onNotesChange: (v: string) => void;
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
}) {
  const cfg = EXAM_TYPE_CONFIG[examType];
  const totalReactions = sections.reduce((acc, s) => acc + s.reactions.length, 0);
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
        Firma como: <strong>{settings?.doctorName ?? "—"}</strong> (
        {settings?.doctorSpecialty ?? "—"})
      </p>
      <p className="text-default-600 text-xs">
        Reactivos: {settings?.defaultReagents ?? "—"} · Técnica: {settings?.defaultTechnique ?? "—"}
      </p>
    </div>
  );
}

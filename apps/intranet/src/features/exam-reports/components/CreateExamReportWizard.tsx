import {
  Button,
  Description,
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
  Select,
  Separator,
  Spinner,
  Tabs,
  TextArea,
  TextField,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { CheckCircle, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useToast } from "@/context/ToastContext";
import { fetchPatients } from "@/features/patients/api";

type Patient = Awaited<ReturnType<typeof fetchPatients>>[number];

import { examReportsORPCClient, toExamReportsApiError } from "../orpc";
import { examReportsKeys } from "../queries";
import {
  EXAM_TYPE_CONFIG,
  EXAM_TYPE_LABEL,
  EXAM_TYPE_ORDER,
} from "../lib/exam-types";
import { downloadExamReportPdf } from "../lib/pdf";
import type {
  ExamType,
  SkinReaction,
} from "@finanzas/orpc-contracts/exam-reports";

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
  sectionKey: string;
  label: string;
  reactions: DraftReaction[];
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

function patientFullName(p: Patient | { person: Patient["person"] }): string {
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

  // Reset draft sections every time examType changes — the seed
  // sections are different per type and we don't want stale entries.
  useEffect(() => {
    const cfg = EXAM_TYPE_CONFIG[examType];
    setSections(
      cfg.sections.map((s) => ({
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

  const createMutation = useMutation({
    mutationFn: () =>
      examReportsORPCClient.create({
        patientId: patient.id,
        examType,
        conclusionText,
        conclusionTemplateId,
        notes: notes || null,
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
      qc.invalidateQueries({ queryKey: examReportsKeys.lists() });
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
              })),
            })),
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
                      <Tabs.Tab id="2">2. Alergenos</Tabs.Tab>
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
                  onPress={() => setStep((s) => (Math.max(1, s - 1) as 1 | 2 | 3 | 4))}
                  variant="outline"
                >
                  Atrás
                </Button>
                {step < 4 ? (
                  <Button onPress={() => setStep((s) => (Math.min(4, s + 1) as 1 | 2 | 3 | 4))}>
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
        {EXAM_TYPE_ORDER.map((t) => (
          <Radio
            className="rounded-2xl border border-default-200 p-4 data-[selected=true]:border-primary data-[selected=true]:bg-primary/5"
            key={t}
            value={t}
          >
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-foreground">{EXAM_TYPE_LABEL[t]}</span>
              <span className="text-default-600 text-xs">
                {EXAM_TYPE_CONFIG[t].sections.length} sección(es) prediseñada(s)
              </span>
            </div>
          </Radio>
        ))}
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
}: {
  sections: DraftSection[];
  onChange: (s: DraftSection[]) => void;
  allergens: { id: string; commonName: string; category: string }[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-default-600">
        <Spinner size="sm" />
        Cargando alergenos…
      </div>
    );
  }

  const updateSection = (idx: number, patch: Partial<DraftSection>) => {
    const next = sections.slice();
    next[idx] = { ...next[idx], ...patch } as DraftSection;
    onChange(next);
  };

  return (
    <div className="space-y-6">
      {sections.map((section, sIdx) => (
        <section className="rounded-2xl border border-default-200 p-4" key={section.sectionKey}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold text-primary">{section.label}</h3>
            <span className="text-default-600 text-xs">
              {section.reactions.length} alergeno(s)
            </span>
          </div>
          <AllergenPicker
            allergens={allergens}
            onAdd={(allergen) => {
              if (section.reactions.some((r) => r.allergenId === allergen.id)) return;
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
                          i === rIdx
                            ? { ...rr, papuleMm: Number.isFinite(v) ? v : null }
                            : rr
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
    </div>
  );
}

function AllergenPicker({
  allergens,
  onAdd,
}: {
  allergens: { id: string; commonName: string; category: string }[];
  onAdd: (a: { id: string; commonName: string; category: string }) => void;
}) {
  const [query, setQuery] = useState("");

  // Filter then group by category — the source PDFs (and the protocol
  // §2 definitions) organise allergens by category (POLENES > ARBOLES,
  // ACAROS, EPITELIOS, ALIMENTOS, …). The dropdown mirrors that for
  // discoverability without forcing the operator to know names.
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? allergens.filter((a) => a.commonName.toLowerCase().includes(q))
      : allergens;
    const buckets = new Map<string, typeof filtered>();
    for (const a of filtered) {
      const key = a.category || "Otros";
      const bucket = buckets.get(key) ?? [];
      bucket.push(a);
      buckets.set(key, bucket);
    }
    // Cap each category to keep the dropdown bounded under heavy data.
    return Array.from(buckets.entries())
      .map(([category, items]) => ({ category, items: items.slice(0, 12) }))
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [allergens, query]);

  return (
    <div className="flex items-center gap-2">
      <TextField
        aria-label="Buscar alergeno"
        className="flex-1"
        onChange={setQuery}
        value={query}
      >
        <Input placeholder="Buscar alergeno…" />
      </TextField>
      <Select
        aria-label="Agregar alergeno"
        className="w-72"
        onSelectionChange={(k) => {
          const a = allergens.find((x) => x.id === String(k));
          if (a) {
            onAdd(a);
            setQuery("");
          }
        }}
        selectedKey={null}
      >
        <Select.Trigger>
          <Plus className="size-4" />
          <span>Agregar…</span>
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {grouped.map((group) => (
              <ListBox.Section key={group.category}>
                <Header>{group.category}</Header>
                {group.items.map((a) => (
                  <ListBox.Item id={a.id} key={a.id} textValue={a.commonName}>
                    {a.commonName}
                  </ListBox.Item>
                ))}
              </ListBox.Section>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
    </div>
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
    | { doctorName: string; doctorSpecialty: string; defaultReagents: string; defaultTechnique: string }
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
        Firma como: <strong>{settings?.doctorName ?? "—"}</strong> ({settings?.doctorSpecialty ?? "—"})
      </p>
      <p className="text-default-600 text-xs">
        Reactivos: {settings?.defaultReagents ?? "—"} · Técnica: {settings?.defaultTechnique ?? "—"}
      </p>
    </div>
  );
}

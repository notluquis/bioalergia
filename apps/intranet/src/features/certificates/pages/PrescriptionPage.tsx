import {
  Button,
  ButtonGroup,
  Card,
  Chip,
  Disclosure,
  Dropdown,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  TextArea,
  TextField,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import type {
  GenerateMedicalPrescriptionInput,
  MedicalPrescription,
} from "@finanzas/orpc-contracts/certificates";
import {
  Ban,
  ChevronDown,
  Download,
  FileText,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  formatPrescriptionDiagnoses,
  type PrescriptionDiagnosis,
} from "@/features/certificates/diagnosis-catalog";
import { AppDatePicker } from "@/components/forms/AppDatePicker";
import { FrequentDiagnosisCombobox } from "@/features/certificates/FrequentDiagnosisCombobox";
import { cie11Equivalent, loadIcd10To11 } from "@/features/certificates/icd-crosswalk";
import { Icd11DiagnosisPicker } from "@/features/certificates/Icd11DiagnosisPicker";
import { MedicationAutocomplete } from "@/features/certificates/MedicationAutocomplete";
import { SelectedDiagnosisChip } from "@/features/certificates/SelectedDiagnosisChip";
import {
  type CodeDisplay,
  SNRE_DRUG_FORM_LABEL,
  SNRE_DRUG_FORMS,
  SNRE_ROUTE_LABEL,
  SNRE_ROUTES,
  SNRE_TIME_UNIT_LABEL,
  SNRE_TIME_UNITS,
} from "@/features/certificates/snre-valuesets";
import { certificatesORPCClient, toCertificatesApiError } from "@/features/certificates/orpc";
import { PatientSelectModal } from "@/features/exam-reports/components/PatientSelectModal";
import { fetchPatient } from "@/features/patients/api";
import { CreatePatientModal } from "@/features/patients/components/CreatePatientModal";
import { EmailPrescriptionModal } from "@/features/certificates/components/EmailPrescriptionModal";
import { confirmAction } from "@/components/ui/ConfirmDialog";
import { chileDay, endOfWeek, formatChile, getISOWeek, startOfWeek, today } from "@/lib/dates";
import { toast } from "@/lib/toast-interceptor";

const routeApi = getRouteApi("/_authed/certificates/prescription");

type SelectedPatient = {
  id: number;
  person: {
    fatherName?: string | null;
    motherName?: string | null;
    names: string;
    rut?: string | null;
  };
};

type MedicationDraft = {
  id: string;
  name: string;
  doseValue: string;
  doseUnit: string; // SNRE_DRUG_FORMS code
  route: string; // SNRE_ROUTES code
  freqValue: string;
  freqUnit: string; // SNRE_TIME_UNITS code
  durValue: string;
  durUnit: string; // SNRE_TIME_UNITS code
  instructions: string;
};

// Compone los campos estructurados (value sets SNRE) en los strings que ya
// recibe el contrato/PDF: dosis "10 mg, vía oral", frecuencia "cada 8 horas",
// duración "7 días".
function composeDosage(m: MedicationDraft): string | undefined {
  const value = m.doseValue.trim();
  const base = value ? `${value} ${SNRE_DRUG_FORM_LABEL[m.doseUnit] ?? m.doseUnit}` : "";
  const route = SNRE_ROUTE_LABEL[m.route];
  if (base && route) return `${base}, vía ${route}`;
  return base || undefined;
}
function composeFrequency(m: MedicationDraft): string | undefined {
  const value = m.freqValue.trim();
  return value ? `cada ${value} ${SNRE_TIME_UNIT_LABEL[m.freqUnit] ?? m.freqUnit}` : undefined;
}
function composeDuration(m: MedicationDraft): string | undefined {
  const value = m.durValue.trim();
  return value ? `${value} ${SNRE_TIME_UNIT_LABEL[m.durUnit] ?? m.durUnit}` : undefined;
}

function CodeSelect({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: CodeDisplay[];
  value: string;
  onChange: (code: string) => void;
  className?: string;
}) {
  return (
    <Select className={className} onChange={(key) => onChange(String(key))} value={value}>
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox className="max-h-72 overflow-y-auto">
          {options.map((option) => (
            <ListBox.Item id={option.code} key={option.code}>
              {option.display}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

function newMedicationDraft(): MedicationDraft {
  return {
    doseUnit: "comprimido",
    doseValue: "",
    durUnit: "d",
    durValue: "",
    freqUnit: "h",
    freqValue: "",
    id: crypto.randomUUID(),
    instructions: "",
    name: "",
    route: "oral",
  };
}

// Reconstruye un draft editable desde un medicamento guardado. La posología
// estructurada (dosis/frecuencia/duración) se guardó ya compuesta como texto;
// la volcamos al campo libre `instructions` (sin pérdida) para que el médico la
// revise — los selects estructurados quedan vacíos y se re-componen si los toca.
function draftFromStored(med: Record<string, unknown>): MedicationDraft {
  const posology = [med.dosage, med.frequency, med.duration]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean)
    .join(" · ");
  const existing = typeof med.instructions === "string" ? med.instructions.trim() : "";
  const instructions = [posology, existing].filter(Boolean).join(" — ");
  return {
    ...newMedicationDraft(),
    instructions,
    name: typeof med.name === "string" ? med.name : "",
  };
}

function draftsFromStored(value: unknown): MedicationDraft[] {
  if (!Array.isArray(value) || value.length === 0) return [newMedicationDraft()];
  return value
    .filter((m): m is Record<string, unknown> => Boolean(m) && typeof m === "object")
    .map(draftFromStored);
}

// Descarga el PDF desde el endpoint raw (bytes correctos; oRPC/SuperJSON
// corrompe binario). Sirve para emitir y para re-descargar desde el historial.
async function downloadFromUrl(url: string, filename: string): Promise<void> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    toast.error("No se pudo descargar el PDF");
    return;
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}

// mode: "full" = digital completa · "overlay" = solo datos (sobre recetario
// pre-impreso) · "template" = recetario en blanco.
async function downloadPrescriptionPdf(
  id: string,
  mode: "full" | "overlay" = "full"
): Promise<void> {
  const suffix = mode === "overlay" ? "_recetario" : "";
  await downloadFromUrl(
    `/api/certificates/prescription/${id}/pdf?mode=${mode}`,
    `receta_${id}${suffix}.pdf`
  );
}

async function downloadBlankRecetario(): Promise<void> {
  await downloadFromUrl("/api/certificates/prescription/blank-template", "recetario_blanco.pdf");
}

// Imprime el PDF: lo abre en una pestaña (visor PDF nativo del navegador) y
// dispara el diálogo de impresión. El iframe oculto imprimía en blanco (visor
// no renderiza en iframe 0×0); la pestaña SIEMPRE muestra el PDF real. mode
// "overlay" imprime SOLO los datos sobre el recetario pre-impreso (Epson).
function printPrescriptionPdf(id: string, mode: "full" | "overlay" = "full"): void {
  // OJO: sin "noopener" — esa flag hace que window.open devuelva null y se
  // pierde la referencia para .print(). Mismo origen → la referencia es segura.
  const win = window.open(`/api/certificates/prescription/${id}/pdf?mode=${mode}`, "_blank");
  if (!win) {
    toast.error("Permite ventanas emergentes para imprimir, o usa Descargar");
    return;
  }
  // Best-effort: dispara el diálogo de impresión cuando cargue el visor. Si el
  // navegador no lo permite, el PDF ya quedó visible para imprimir a mano.
  win.addEventListener("load", () => {
    try {
      win.focus();
      win.print();
    } catch {
      /* el visor nativo permite imprimir manualmente */
    }
  });
}

function patientFullName(patient: SelectedPatient): string {
  return [patient.person.names, patient.person.fatherName, patient.person.motherName]
    .filter(Boolean)
    .join(" ");
}

export function PrescriptionPage() {
  const search = routeApi.useSearch();
  const queryClient = useQueryClient();
  const searchPatientId = search.patientId;
  const [selectPatientOpen, setSelectPatientOpen] = useState(false);
  const [createPatientOpen, setCreatePatientOpen] = useState(false);
  const [patient, setPatient] = useState<SelectedPatient | null>(null);
  const [date, setDate] = useState(today());
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<PrescriptionDiagnosis[]>([]);
  const [customDiagnosis, setCustomDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [medications, setMedications] = useState<MedicationDraft[]>(() => [newMedicationDraft()]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Modificar = re-emitir: id de la receta que se anula al generar la nueva.
  const [supersedesId, setSupersedesId] = useState<string | null>(null);
  const [emailTarget, setEmailTarget] = useState<MedicalPrescription | null>(null);
  // Filtros del historial (búsqueda server-side sobre TODO el historial).
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [dateField, setDateField] = useState<"date" | "issuedAt">("issuedAt");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "ISSUED" | "ANNULLED">("ALL");
  const hasFilters = Boolean(debouncedSearch || fromDate || toDate) || filterStatus !== "ALL";

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchText.trim()), 300);
    return () => clearTimeout(t);
  }, [searchText]);

  const clearFilters = () => {
    setSearchText("");
    setDebouncedSearch("");
    setFromDate("");
    setToDate("");
    setDateField("issuedAt");
    setFilterStatus("ALL");
  };

  const selectedPatientQ = useQuery({
    enabled: searchPatientId != null,
    queryKey: ["patient", String(searchPatientId)],
    queryFn: async () => {
      if (searchPatientId == null) throw new Error("Paciente no seleccionado");
      return fetchPatient(searchPatientId);
    },
  });

  useEffect(() => {
    if (!selectedPatientQ.data) return;
    setPatient({
      id: selectedPatientQ.data.id,
      person: selectedPatientQ.data.person,
    });
  }, [selectedPatientQ.data]);

  const patientLabel = useMemo(() => (patient ? patientFullName(patient) : ""), [patient]);
  const prescriptionsQ = useQuery({
    queryKey: [
      "medical-prescriptions",
      patient?.id ?? "all",
      debouncedSearch,
      fromDate,
      toDate,
      dateField,
      filterStatus,
    ],
    queryFn: async () =>
      certificatesORPCClient.listPrescriptions({
        limit: 200,
        patientId: patient?.id,
        search: debouncedSearch || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        dateField,
        status: filterStatus === "ALL" ? undefined : filterStatus,
      }),
  });

  const generateMutation = useMutation({
    mutationFn: async (input: GenerateMedicalPrescriptionInput) => {
      try {
        return await certificatesORPCClient.generatePrescription(input);
      } catch (error) {
        throw toCertificatesApiError(error);
      }
    },
    onSuccess: () => {
      // Cierra el modal y refresca el historial: la receta nueva aparece arriba
      // con Imprimir/Descargar. NO auto-descargamos (regeneraba el PDF de nuevo
      // server-side → lentitud + descarga inesperada). El médico imprime desde
      // la fila cuando quiere (Imprimir full o Recetario overlay).
      setPatient(null);
      setSupersedesId(null);
      void queryClient.invalidateQueries({ queryKey: ["medical-prescriptions"] });
      toast.success("Receta generada");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Error al generar receta");
    },
  });

  const annulMutation = useMutation({
    mutationFn: async (id: string) => {
      try {
        return await certificatesORPCClient.annulPrescription({ id });
      } catch (error) {
        throw toCertificatesApiError(error);
      }
    },
    // Update OPTIMISTA: marca ANNULLED en el cache al instante. Lo lento no era
    // anular (2 queries) sino el refetch del historial completo que disparaba
    // después; con el patch optimista no hace falta refetch.
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["medical-prescriptions"] });
      const snapshots = queryClient.getQueriesData<{ items: MedicalPrescription[] }>({
        queryKey: ["medical-prescriptions"],
      });
      for (const [key, data] of snapshots) {
        if (!data) continue;
        queryClient.setQueryData(key, {
          ...data,
          items: data.items.map((it) => (it.id === id ? { ...it, status: "ANNULLED" } : it)),
        });
      }
      return { snapshots };
    },
    onError: (error, _id, ctx) => {
      for (const [key, data] of ctx?.snapshots ?? []) {
        queryClient.setQueryData(key, data);
      }
      toast.error(error instanceof Error ? error.message : "Error al anular receta");
    },
    onSuccess: () => {
      toast.success("Receta anulada");
    },
  });

  const handleAnnul = async (item: MedicalPrescription) => {
    const ok = await confirmAction({
      title: "Anular receta",
      description: `La receta${item.folio ? ` ${item.folio}` : ""} quedará marcada como ANULADA (se conserva para auditoría). ¿Continuar?`,
      confirmLabel: "Anular",
      variant: "danger",
    });
    if (ok) annulMutation.mutate(item.id);
  };

  // Modificar = cargar la receta al formulario y re-emitir (la vieja se anula).
  const handleEditPrescription = (item: MedicalPrescription) => {
    setPatient({ id: item.patient.id, person: item.patient.person });
    setDate(formatChile(item.date, "YYYY-MM-DD"));
    setSelectedDiagnoses(
      Array.isArray(item.diagnoses) ? (item.diagnoses as PrescriptionDiagnosis[]) : []
    );
    setNotes(item.notes ?? "");
    setMedications(draftsFromStored(item.medications));
    setSupersedesId(item.id);
    setSubmitError(null);
  };

  const updateMedication = (id: string, patch: Partial<MedicationDraft>) => {
    setMedications((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  };

  const removeMedication = (id: string) => {
    setMedications((current) =>
      current.length <= 1 ? current : current.filter((item) => item.id !== id)
    );
  };

  const addDiagnosis = (diagnosis: PrescriptionDiagnosis) => {
    setSelectedDiagnoses((current) =>
      current.some((item) => item.id === diagnosis.id) ? current : [...current, diagnosis]
    );
  };

  const addCustomDiagnosis = () => {
    const label = customDiagnosis.trim();
    if (!label) return;
    addDiagnosis({
      custom: true,
      id: `custom-${crypto.randomUUID()}`,
      label,
      source: "CUSTOM",
      sourceLabel: "Diagnóstico escrito",
    });
    setCustomDiagnosis("");
  };

  const removeDiagnosis = (id: string) => {
    setSelectedDiagnoses((current) => current.filter((item) => item.id !== id));
  };

  const handleSubmit = async () => {
    if (!patient) {
      setSubmitError("Selecciona un paciente");
      return;
    }
    const cleanMedications = medications
      .map((item) => ({
        dosage: composeDosage(item),
        duration: composeDuration(item),
        frequency: composeFrequency(item),
        instructions: item.instructions.trim() || undefined,
        name: item.name.trim(),
      }))
      .filter((item) => item.name.length > 0);
    if (cleanMedications.length === 0) {
      setSubmitError("Agrega al menos un medicamento");
      return;
    }
    const diagnosisText = formatPrescriptionDiagnoses(selectedDiagnoses);
    setSubmitError(null);
    await generateMutation.mutateAsync({
      date,
      diagnosis: diagnosisText || undefined,
      diagnoses: selectedDiagnoses.length > 0 ? selectedDiagnoses : undefined,
      medications: cleanMedications,
      notes: notes.trim() || undefined,
      patientId: patient.id,
      supersedesId: supersedesId ?? undefined,
    });
    // Re-emisión completada: limpia el vínculo y deja el formulario fresco.
    setSupersedesId(null);
    setSelectedDiagnoses([]);
    setNotes("");
    setMedications([newMedicationDraft()]);
  };

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-foreground text-lg">Recetas médicas</h2>
            <p className="text-default-600 text-sm">
              {patient ? patientLabel : "Selecciona un paciente para generar una receta"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              className="gap-2"
              onPress={() => void downloadBlankRecetario()}
              variant="outline"
            >
              <FileText size={16} />
              Recetario en blanco
            </Button>
            <Button className="gap-2" onPress={() => setSelectPatientOpen(true)}>
              <Plus size={16} />
              Nueva receta
            </Button>
          </div>
        </div>
      </Card>

      <PrescriptionFilters
        dateField={dateField}
        filterStatus={filterStatus}
        fromDate={fromDate}
        hasFilters={hasFilters}
        onClear={clearFilters}
        onDateFieldChange={setDateField}
        onFromChange={setFromDate}
        onSearchChange={setSearchText}
        onStatusChange={setFilterStatus}
        onToChange={setToDate}
        search={searchText}
        toDate={toDate}
      />

      <PrescriptionHistory
        isLoading={prescriptionsQ.isLoading}
        items={prescriptionsQ.data?.items ?? []}
        onAnnul={handleAnnul}
        onEdit={handleEditPrescription}
        onEmail={setEmailTarget}
        title={patient ? `Recetas de ${patientLabel}` : "Recetas recientes"}
      />

      <EmailPrescriptionModal
        isOpen={emailTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEmailTarget(null);
        }}
        prescription={emailTarget}
      />

      {patient ? (
        <PrescriptionModal
          customDiagnosis={customDiagnosis}
          date={date}
          generatePending={generateMutation.isPending}
          isEditing={supersedesId != null}
          medications={medications}
          notes={notes}
          selectedDiagnoses={selectedDiagnoses}
          onAddCustomDiagnosis={addCustomDiagnosis}
          onAddDiagnosis={addDiagnosis}
          onAddMedication={() => setMedications((current) => [...current, newMedicationDraft()])}
          onCustomDiagnosisChange={setCustomDiagnosis}
          onClose={() => {
            setPatient(null);
            setSupersedesId(null);
          }}
          onDateChange={setDate}
          onMedicationChange={updateMedication}
          onMedicationRemove={removeMedication}
          onNotesChange={setNotes}
          onRemoveDiagnosis={removeDiagnosis}
          onSubmit={handleSubmit}
          patientLabel={patientLabel}
          submitError={submitError}
        />
      ) : null}

      <PatientSelectModal
        isOpen={selectPatientOpen}
        onClose={() => setSelectPatientOpen(false)}
        onCreateNew={() => {
          setSelectPatientOpen(false);
          setCreatePatientOpen(true);
        }}
        onSelect={(selected) => {
          setPatient(selected);
          setSelectPatientOpen(false);
        }}
      />

      <CreatePatientModal
        isOpen={createPatientOpen}
        onClose={() => {
          setCreatePatientOpen(false);
          setSelectPatientOpen(true);
        }}
      />
    </div>
  );
}

function medicationSummary(value: unknown): string {
  if (!Array.isArray(value)) return "Sin medicamentos";
  const names = value
    .map((item) =>
      item && typeof item === "object" && "name" in item && typeof item.name === "string"
        ? item.name
        : null
    )
    .filter((name): name is string => Boolean(name));
  if (names.length === 0) return "Sin medicamentos";
  return names.join(", ");
}

const DATE_FIELD_OPTIONS: CodeDisplay[] = [
  { code: "issuedAt", display: "Fecha de emisión" },
  { code: "date", display: "Fecha de receta" },
];
const STATUS_FILTER_OPTIONS: CodeDisplay[] = [
  { code: "ALL", display: "Todos los estados" },
  { code: "ISSUED", display: "Vigente" },
  { code: "ANNULLED", display: "Anulada" },
];

// Barra de filtros del historial: búsqueda libre (server-side) + rango de
// fechas (sobre emisión o receta) + tipo + estado.
function PrescriptionFilters({
  dateField,
  filterStatus,
  fromDate,
  hasFilters,
  onClear,
  onDateFieldChange,
  onFromChange,
  onSearchChange,
  onStatusChange,
  onToChange,
  search,
  toDate,
}: {
  dateField: "date" | "issuedAt";
  filterStatus: "ALL" | "ISSUED" | "ANNULLED";
  fromDate: string;
  hasFilters: boolean;
  onClear: () => void;
  onDateFieldChange: (v: "date" | "issuedAt") => void;
  onFromChange: (v: string) => void;
  onSearchChange: (v: string) => void;
  onStatusChange: (v: "ALL" | "ISSUED" | "ANNULLED") => void;
  onToChange: (v: string) => void;
  search: string;
  toDate: string;
}) {
  return (
    <Card className="p-4">
      <div className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr]">
        <TextField aria-label="Buscar recetas" value={search} onChange={onSearchChange}>
          <Label>Buscar</Label>
          <Input placeholder="Paciente, RUT, diagnóstico o medicamento…" />
        </TextField>
        <div />
        <CodeSelect
          label="Estado"
          onChange={(c) => onStatusChange(c as "ALL" | "ISSUED" | "ANNULLED")}
          options={STATUS_FILTER_OPTIONS}
          value={filterStatus}
        />
      </div>
      <div className="mt-3 grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_auto]">
        <CodeSelect
          label="Filtrar por"
          onChange={(c) => onDateFieldChange(c as "date" | "issuedAt")}
          options={DATE_FIELD_OPTIONS}
          value={dateField}
        />
        <AppDatePicker label="Desde" onChange={onFromChange} value={fromDate} />
        <AppDatePicker label="Hasta" onChange={onToChange} value={toDate} />
        {hasFilters ? (
          <Button className="gap-2" onPress={onClear} variant="ghost">
            <X size={14} />
            Limpiar
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

// Acciones secundarias de cada receta en un menú overflow (declutter del row).
function PrescriptionRowMenu({
  item,
  onAnnul,
  onEdit,
  onEmail,
}: {
  item: MedicalPrescription;
  onAnnul: (item: MedicalPrescription) => void;
  onEdit: (item: MedicalPrescription) => void;
  onEmail: (item: MedicalPrescription) => void;
}) {
  const annulled = item.status === "ANNULLED";
  // Receta inmutable: NO se elimina (documento legal). Solo anular o re-emitir.
  const menuItems = [
    { icon: <Printer size={14} />, id: "print-overlay", label: "Imprimir en recetario" },
    { icon: <Download size={14} />, id: "download-overlay", label: "PDF solo datos" },
    { icon: <Mail size={14} />, id: "email", label: "Enviar por email" },
    ...(annulled
      ? []
      : [
          { icon: <Pencil size={14} />, id: "edit", label: "Modificar (re-emitir)" },
          { icon: <Ban size={14} />, id: "annul", label: "Anular" },
        ]),
  ];

  const onAction = (key: string) => {
    switch (key) {
      case "print-overlay":
        printPrescriptionPdf(item.id, "overlay");
        break;
      case "download-overlay":
        void downloadPrescriptionPdf(item.id, "overlay");
        break;
      case "email":
        onEmail(item);
        break;
      case "edit":
        onEdit(item);
        break;
      case "annul":
        onAnnul(item);
        break;
    }
  };

  return (
    <Dropdown>
      <Dropdown.Trigger>
        <Button aria-label="Más acciones" className="px-2" size="sm" variant="ghost">
          <MoreHorizontal size={16} />
        </Button>
      </Dropdown.Trigger>
      <Dropdown.Popover className="min-w-52" placement="bottom end">
        <Dropdown.Menu
          aria-label="Más acciones de la receta"
          items={menuItems}
          onAction={(key) => onAction(String(key))}
        >
          {(entry: (typeof menuItems)[number]) => (
            <Dropdown.Item id={entry.id} key={entry.id} textValue={entry.label}>
              {entry.icon}
              <Label>{entry.label}</Label>
            </Dropdown.Item>
          )}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

// Agrupa recetas por año › mes › semana ISO (igual que el historial de
// informes). Agrupa por la fecha de la receta (`date`). Server las entrega
// ordenadas DESC por issuedAt.
interface PxWeekGroup {
  key: string;
  label: string;
  items: MedicalPrescription[];
}
interface PxMonthGroup {
  key: string;
  label: string;
  count: number;
  weeks: PxWeekGroup[];
}
interface PxYearGroup {
  year: number;
  count: number;
  months: PxMonthGroup[];
}

function groupPrescriptions(items: MedicalPrescription[]): PxYearGroup[] {
  const years = new Map<number, PxMonthGroup[]>();
  const monthIndex = new Map<string, PxMonthGroup>();
  const weekIndex = new Map<string, PxWeekGroup>();

  for (const r of items) {
    const when = r.date;
    const iso = chileDay(when);
    const year = Number(iso.slice(0, 4));
    const month0 = Number(iso.slice(5, 7)) - 1;
    const isoWeek = getISOWeek(when);
    const monthKey = `${year}-${month0}`;
    const weekKey = `${year}-W${isoWeek}`;

    let monthGroup = monthIndex.get(monthKey);
    if (!monthGroup) {
      monthGroup = { key: monthKey, label: formatChile(when, "MMMM YYYY"), count: 0, weeks: [] };
      monthIndex.set(monthKey, monthGroup);
      const bucket = years.get(year) ?? [];
      bucket.push(monthGroup);
      years.set(year, bucket);
    }

    let weekGroup = weekIndex.get(weekKey);
    if (!weekGroup) {
      weekGroup = {
        key: weekKey,
        label: `Semana ${isoWeek} · ${formatChile(startOfWeek(when), "DD MMM")} – ${formatChile(endOfWeek(when), "DD MMM")}`,
        items: [],
      };
      weekIndex.set(weekKey, weekGroup);
      monthGroup.weeks.push(weekGroup);
    }
    weekGroup.items.push(r);
    monthGroup.count += 1;
  }

  return Array.from(years.entries())
    .map(([year, months]) => ({
      year,
      count: months.reduce((acc, m) => acc + m.count, 0),
      months,
    }))
    .sort((a, b) => b.year - a.year);
}

function PrescriptionHistory({
  isLoading,
  items,
  onAnnul,
  onEdit,
  onEmail,
  title,
}: {
  isLoading: boolean;
  items: MedicalPrescription[];
  onAnnul: (item: MedicalPrescription) => void;
  onEdit: (item: MedicalPrescription) => void;
  onEmail: (item: MedicalPrescription) => void;
  title: string;
}) {
  const grouped = groupPrescriptions(items);

  const currentIso = chileDay(today());
  const currentYear = Number(currentIso.slice(0, 4));
  const currentMonth = Number(currentIso.slice(5, 7)) - 1;
  const currentWeek = getISOWeek(today());
  const currentMonthKey = `${currentYear}-${currentMonth}`;
  const currentWeekKey = `${currentYear}-W${currentWeek}`;

  const renderRow = (item: MedicalPrescription) => (
    <article
      className="flex flex-col gap-2 border-default-100 border-b p-3 last:border-b-0 sm:flex-row sm:items-start"
      key={item.id}
    >
      <div className="flex min-w-0 flex-1 gap-3">
        <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <FileText size={16} />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="truncate text-sm">
              {[item.patient.person.names, item.patient.person.fatherName]
                .filter(Boolean)
                .join(" ")}
            </strong>
            <Chip size="sm" variant="soft">
              <Chip.Label>{formatChile(item.date, "DD/MM/YYYY")}</Chip.Label>
            </Chip>
            {item.folio ? (
              <Chip size="sm" variant="soft">
                <Chip.Label>{item.folio}</Chip.Label>
              </Chip>
            ) : null}
            {item.status === "ANNULLED" ? (
              <Chip color="danger" size="sm" variant="soft">
                <Chip.Label>Anulada</Chip.Label>
              </Chip>
            ) : null}
          </div>
          <p className="mt-1 line-clamp-1 text-default-700 text-sm">
            {medicationSummary(item.medications)}
          </p>
          {item.diagnosis ? (
            <p className="line-clamp-1 text-default-500 text-xs">{item.diagnosis}</p>
          ) : null}
          <p className="text-default-500 text-xs">
            Emitida {formatChile(item.issuedAt, "DD/MM/YYYY HH:mm")}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:self-start">
        <ButtonGroup>
          <Button
            className="gap-2"
            isDisabled={item.status === "ANNULLED"}
            onPress={() => printPrescriptionPdf(item.id, "full")}
            size="sm"
            variant="primary"
          >
            <Printer size={14} />
            Imprimir
          </Button>
          <Dropdown>
            <Dropdown.Trigger>
              <Button
                isDisabled={item.status === "ANNULLED"}
                isIconOnly
                size="sm"
                variant="primary"
              >
                <ChevronDown size={14} />
              </Button>
            </Dropdown.Trigger>
            <Dropdown.Popover placement="bottom end">
              <Dropdown.Menu
                onAction={(key) => printPrescriptionPdf(item.id, key as "full" | "overlay")}
              >
                <Dropdown.Item id="full">Imprimir receta completa</Dropdown.Item>
                <Dropdown.Item id="overlay">Imprimir solo datos</Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </ButtonGroup>

        <ButtonGroup>
          <Button
            className="gap-2"
            onPress={() => void downloadPrescriptionPdf(item.id, "full")}
            size="sm"
            variant="outline"
          >
            <Download size={14} />
            Descargar
          </Button>
          <Dropdown>
            <Dropdown.Trigger>
              <Button isIconOnly size="sm" variant="outline">
                <ChevronDown size={14} />
              </Button>
            </Dropdown.Trigger>
            <Dropdown.Popover placement="bottom end">
              <Dropdown.Menu
                onAction={(key) => void downloadPrescriptionPdf(item.id, key as "full" | "overlay")}
              >
                <Dropdown.Item id="full">Descargar receta completa</Dropdown.Item>
                <Dropdown.Item id="overlay">Descargar solo datos</Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </ButtonGroup>

        <Button
          isIconOnly
          size="sm"
          variant="outline"
          onPress={() => onEmail(item)}
          aria-label="Enviar por email"
        >
          <Mail size={14} />
        </Button>

        <PrescriptionRowMenu item={item} onAnnul={onAnnul} onEdit={onEdit} onEmail={onEmail} />
      </div>
    </article>
  );
  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground text-base">{title}</h3>
          <p className="text-default-600 text-sm">
            {isLoading ? "Cargando..." : `${items.length} receta${items.length === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-default-600 text-sm">Cargando recetas...</p>
      ) : items.length === 0 ? (
        <p className="text-default-600 text-sm">No hay recetas registradas.</p>
      ) : (
        <div className="space-y-2">
          {grouped.map((yearGroup) => (
            <Disclosure defaultExpanded={yearGroup.year === currentYear} key={yearGroup.year}>
              <Disclosure.Heading>
                <Button
                  className="group flex w-full items-center justify-between px-3 py-2"
                  slot="trigger"
                  variant="outline"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <FileText className="size-4 text-default-500" />
                    {yearGroup.year}
                  </span>
                  <span className="flex items-center gap-2 text-default-500 text-xs">
                    {yearGroup.count} receta{yearGroup.count === 1 ? "" : "s"}
                    <ChevronDown className="size-4 transition group-data-[expanded]:rotate-180" />
                  </span>
                </Button>
              </Disclosure.Heading>
              <Disclosure.Content>
                <Disclosure.Body className="space-y-2 p-2 pl-4">
                  {yearGroup.months.map((monthGroup) => (
                    <Disclosure
                      defaultExpanded={
                        yearGroup.months.length === 1 || monthGroup.key === currentMonthKey
                      }
                      key={monthGroup.key}
                    >
                      <Disclosure.Heading>
                        <Button
                          className="group flex w-full items-center justify-between gap-2 px-3 py-1.5 text-sm capitalize"
                          size="sm"
                          slot="trigger"
                          variant="ghost"
                        >
                          <span>{monthGroup.label}</span>
                          <span className="flex items-center gap-2 text-default-500 text-xs">
                            {monthGroup.count}
                            <ChevronDown className="size-3.5 transition group-data-[expanded]:rotate-180" />
                          </span>
                        </Button>
                      </Disclosure.Heading>
                      <Disclosure.Content>
                        <Disclosure.Body className="space-y-1 p-1 pl-3">
                          {monthGroup.weeks.map((weekGroup) => (
                            <Disclosure
                              defaultExpanded={
                                monthGroup.weeks.length === 1 || weekGroup.key === currentWeekKey
                              }
                              key={weekGroup.key}
                            >
                              <Disclosure.Heading>
                                <Button
                                  className="group flex w-full items-center justify-between gap-2 px-3 py-1 text-default-600 text-xs"
                                  size="sm"
                                  slot="trigger"
                                  variant="ghost"
                                >
                                  <span>{weekGroup.label}</span>
                                  <span className="flex items-center gap-2">
                                    {weekGroup.items.length}
                                    <ChevronDown className="size-3.5 transition group-data-[expanded]:rotate-180" />
                                  </span>
                                </Button>
                              </Disclosure.Heading>
                              <Disclosure.Content>
                                <Disclosure.Body className="p-0">
                                  <div className="overflow-hidden rounded-xl border border-default-100">
                                    {weekGroup.items.map(renderRow)}
                                  </div>
                                </Disclosure.Body>
                              </Disclosure.Content>
                            </Disclosure>
                          ))}
                        </Disclosure.Body>
                      </Disclosure.Content>
                    </Disclosure>
                  ))}
                </Disclosure.Body>
              </Disclosure.Content>
            </Disclosure>
          ))}
        </div>
      )}
    </Card>
  );
}

function DiagnosisPicker({
  customDiagnosis,
  selectedDiagnoses,
  onAddCustomDiagnosis,
  onAddDiagnosis,
  onCustomDiagnosisChange,
  onRemoveDiagnosis,
}: {
  customDiagnosis: string;
  selectedDiagnoses: PrescriptionDiagnosis[];
  onAddCustomDiagnosis: () => void;
  onAddDiagnosis: (diagnosis: PrescriptionDiagnosis) => void;
  onCustomDiagnosisChange: (value: string) => void;
  onRemoveDiagnosis: (id: string) => void;
}) {
  const [icdQuery, setIcdQuery] = useState("");
  const [cie10Input, setCie10Input] = useState("");
  const [cie10Error, setCie10Error] = useState<string | null>(null);

  // Pre-carga el crosswalk CIE-10→CIE-11 para la búsqueda dual por código viejo.
  useEffect(() => {
    void loadIcd10To11();
  }, []);

  const lookupCie10 = () => {
    const hit = cie11Equivalent(cie10Input);
    if (!hit) {
      setCie10Error("Código CIE-10 sin equivalente en CIE-11");
      return;
    }
    setCie10Error(null);
    setCie10Input("");
    // Inyecta el código CIE-11 al buscador oficial → el dr confirma el oficial.
    setIcdQuery(hit.c);
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>Diagnósticos</Label>
        <p className="text-default-500 text-xs">
          Atajo de frecuentes o búsqueda oficial CIE-11 (OMS) en español. Uno o más diagnósticos.
        </p>
      </div>

      <FrequentDiagnosisCombobox onPick={(query) => setIcdQuery(query)} />

      {selectedDiagnoses.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedDiagnoses.map((diagnosis) => (
            <SelectedDiagnosisChip
              diagnosis={diagnosis}
              key={diagnosis.id}
              onRemove={() => onRemoveDiagnosis(diagnosis.id)}
            />
          ))}
        </div>
      ) : null}

      <Icd11DiagnosisPicker
        onQueryChange={setIcdQuery}
        onSelect={onAddDiagnosis}
        query={icdQuery}
      />

      <Disclosure>
        <Disclosure.Heading>
          <Button size="sm" slot="trigger" variant="ghost">
            Más opciones (código CIE-10 viejo · diagnóstico escrito)
            <Disclosure.Indicator />
          </Button>
        </Disclosure.Heading>
        <Disclosure.Content>
          <Disclosure.Body className="space-y-3 pt-2">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <TextField
                value={cie10Input}
                onChange={(value) => {
                  setCie10Input(value);
                  if (cie10Error) setCie10Error(null);
                }}
              >
                <Label>¿Tienes el código CIE-10 viejo?</Label>
                <Input placeholder="Ej: J30.1 — lo convierto a CIE-11" />
                {cie10Error ? <FieldError>{cie10Error}</FieldError> : null}
              </TextField>
              <Button
                className="self-end"
                isDisabled={!cie10Input.trim()}
                onPress={lookupCie10}
                type="button"
                variant="outline"
              >
                Buscar CIE-11
              </Button>
            </div>

            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <TextField value={customDiagnosis} onChange={onCustomDiagnosisChange}>
                <Label>Diagnóstico escrito</Label>
                <Input placeholder="Agregar diagnóstico no listado en CIE-11" />
              </TextField>
              <Button
                className="self-end"
                isDisabled={!customDiagnosis.trim()}
                onPress={onAddCustomDiagnosis}
                type="button"
                variant="outline"
              >
                Agregar escrito
              </Button>
            </div>
          </Disclosure.Body>
        </Disclosure.Content>
      </Disclosure>
    </div>
  );
}

function PrescriptionModal({
  customDiagnosis,
  date,
  generatePending,
  isEditing,
  medications,
  notes,
  selectedDiagnoses,
  onAddCustomDiagnosis,
  onAddDiagnosis,
  onAddMedication,
  onCustomDiagnosisChange,
  onClose,
  onDateChange,
  onMedicationChange,
  onMedicationRemove,
  onNotesChange,
  onRemoveDiagnosis,
  onSubmit,
  patientLabel,
  submitError,
}: {
  customDiagnosis: string;
  date: string;
  generatePending: boolean;
  isEditing: boolean;
  medications: MedicationDraft[];
  notes: string;
  selectedDiagnoses: PrescriptionDiagnosis[];
  onAddCustomDiagnosis: () => void;
  onAddDiagnosis: (diagnosis: PrescriptionDiagnosis) => void;
  onAddMedication: () => void;
  onCustomDiagnosisChange: (value: string) => void;
  onClose: () => void;
  onDateChange: (value: string) => void;
  onMedicationChange: (id: string, patch: Partial<MedicationDraft>) => void;
  onMedicationRemove: (id: string) => void;
  onNotesChange: (value: string) => void;
  onRemoveDiagnosis: (id: string) => void;
  onSubmit: () => Promise<void>;
  patientLabel: string;
  submitError: string | null;
}) {
  return (
    <Modal>
      <Modal.Backdrop
        className="bg-black/40 backdrop-blur-[2px]"
        isOpen
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4">
              <Modal.Heading className="font-semibold text-primary text-xl">
                {isEditing ? "Modificar receta" : "Receta médica"}
              </Modal.Heading>
              <p className="text-default-600 text-sm">{patientLabel}</p>
              {isEditing ? (
                <p className="mt-2 rounded-lg bg-warning/10 px-3 py-2 text-warning text-xs">
                  Al generar, la receta original se anulará y se emitirá una nueva con folio nuevo.
                </p>
              ) : null}
            </Modal.Header>
            <Modal.Body>
              <Form
                onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void onSubmit();
                }}
                validationBehavior="aria"
              >
                <div className="grid gap-4">
                  <AppDatePicker label="Fecha" onChange={onDateChange} value={date} />

                  <DiagnosisPicker
                    customDiagnosis={customDiagnosis}
                    selectedDiagnoses={selectedDiagnoses}
                    onAddCustomDiagnosis={onAddCustomDiagnosis}
                    onAddDiagnosis={onAddDiagnosis}
                    onCustomDiagnosisChange={onCustomDiagnosisChange}
                    onRemoveDiagnosis={onRemoveDiagnosis}
                  />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-foreground text-sm">Medicamentos</h3>
                      <Button
                        className="gap-2"
                        onPress={onAddMedication}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <Plus size={14} />
                        Agregar
                      </Button>
                    </div>

                    {medications.map((medication, index) => (
                      <div
                        className="space-y-3 rounded-lg border border-default-200 p-3"
                        key={medication.id}
                      >
                        <MedicationAutocomplete
                          label={`Medicamento ${index + 1}`}
                          value={medication.name}
                          onChange={(name) => onMedicationChange(medication.id, { name })}
                          onSelect={(med) =>
                            onMedicationChange(medication.id, {
                              name: med.presentation ? `${med.name} ${med.presentation}` : med.name,
                            })
                          }
                        />

                        <div className="grid gap-3 sm:grid-cols-[6rem_1fr_1fr]">
                          <TextField
                            value={medication.doseValue}
                            onChange={(value) =>
                              onMedicationChange(medication.id, { doseValue: value })
                            }
                          >
                            <Label>Dosis</Label>
                            <Input inputMode="decimal" placeholder="Ej: 1" />
                          </TextField>
                          <CodeSelect
                            label="Unidad"
                            onChange={(code) =>
                              onMedicationChange(medication.id, { doseUnit: code })
                            }
                            options={SNRE_DRUG_FORMS}
                            value={medication.doseUnit}
                          />
                          <CodeSelect
                            label="Vía"
                            onChange={(code) => onMedicationChange(medication.id, { route: code })}
                            options={SNRE_ROUTES}
                            value={medication.route}
                          />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="grid grid-cols-[auto_5rem_1fr] items-end gap-2">
                            <span className="pb-2 text-default-600 text-sm">cada</span>
                            <TextField
                              value={medication.freqValue}
                              onChange={(value) =>
                                onMedicationChange(medication.id, { freqValue: value })
                              }
                            >
                              <Label>Frecuencia</Label>
                              <Input inputMode="numeric" placeholder="8" />
                            </TextField>
                            <CodeSelect
                              label="​"
                              onChange={(code) =>
                                onMedicationChange(medication.id, { freqUnit: code })
                              }
                              options={SNRE_TIME_UNITS}
                              value={medication.freqUnit}
                            />
                          </div>
                          <div className="grid grid-cols-[5rem_1fr] items-end gap-2">
                            <TextField
                              value={medication.durValue}
                              onChange={(value) =>
                                onMedicationChange(medication.id, { durValue: value })
                              }
                            >
                              <Label>Duración</Label>
                              <Input inputMode="numeric" placeholder="7" />
                            </TextField>
                            <CodeSelect
                              label="​"
                              onChange={(code) =>
                                onMedicationChange(medication.id, { durUnit: code })
                              }
                              options={SNRE_TIME_UNITS}
                              value={medication.durUnit}
                            />
                          </div>
                        </div>

                        <TextField
                          value={medication.instructions}
                          onChange={(value) =>
                            onMedicationChange(medication.id, { instructions: value })
                          }
                        >
                          <Label>Instrucciones</Label>
                          <TextArea placeholder="Ej: tomar con alimentos" rows={2} />
                        </TextField>

                        <div className="flex justify-end">
                          <Button
                            className="gap-2"
                            isDisabled={medications.length <= 1}
                            onPress={() => onMedicationRemove(medication.id)}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            <Trash2 size={14} />
                            Quitar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <TextField value={notes} onChange={onNotesChange}>
                    <Label>Observaciones</Label>
                    <TextArea rows={3} />
                  </TextField>

                  {submitError ? <FieldError>{submitError}</FieldError> : null}

                  <div className="flex justify-end gap-3 border-default-200 border-t pt-4">
                    <Button
                      isDisabled={generatePending}
                      onPress={onClose}
                      type="button"
                      variant="outline"
                    >
                      Cancelar
                    </Button>
                    <Button isPending={generatePending} type="submit">
                      Generar receta
                    </Button>
                  </div>
                </div>
              </Form>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

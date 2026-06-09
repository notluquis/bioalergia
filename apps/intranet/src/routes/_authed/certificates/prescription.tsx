import {
  Button,
  Card,
  Chip,
  Disclosure,
  FieldError,
  Form,
  Input,
  Label,
  Modal,
  TextArea,
  TextField,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type {
  GenerateMedicalPrescriptionInput,
  MedicalPrescription,
} from "@finanzas/orpc-contracts/certificates";
import { FileText, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import {
  formatPrescriptionDiagnoses,
  type PrescriptionDiagnosis,
} from "@/features/certificates/diagnosis-catalog";
import { AppDatePicker } from "@/components/forms/AppDatePicker";
import { FrequentDiagnosisCombobox } from "@/features/certificates/FrequentDiagnosisCombobox";
import { cie11Equivalent, loadIcd10To11 } from "@/features/certificates/icd-crosswalk";
import { Icd11DiagnosisPicker } from "@/features/certificates/Icd11DiagnosisPicker";
import { SelectedDiagnosisChip } from "@/features/certificates/SelectedDiagnosisChip";
import { certificatesORPCClient, toCertificatesApiError } from "@/features/certificates/orpc";
import { PatientSelectModal } from "@/features/exam-reports/components/PatientSelectModal";
import { fetchPatient } from "@/features/patients/api";
import { CreatePatientModal } from "@/features/patients/components/CreatePatientModal";
import { formatChile, today } from "@/lib/dates";
import { toast } from "@/lib/toast-interceptor";

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
  dosage: string;
  duration: string;
  frequency: string;
  id: string;
  instructions: string;
  name: string;
};

const prescriptionSearchSchema = z.object({
  patientId: z.coerce.number().int().positive().optional(),
});

export const Route = createFileRoute("/_authed/certificates/prescription")({
  validateSearch: prescriptionSearchSchema,
  staticData: {
    nav: { iconKey: "ClipboardList", label: "Recetas Médicas", order: 81, section: "Clínica" },
    permission: { action: "create", subject: "MedicalCertificate" },
    title: "Generar Receta Médica",
  },
  component: MedicalPrescriptionPage,
});

function newMedicationDraft(): MedicationDraft {
  return {
    dosage: "",
    duration: "",
    frequency: "",
    id: crypto.randomUUID(),
    instructions: "",
    name: "",
  };
}

function patientFullName(patient: SelectedPatient): string {
  return [patient.person.names, patient.person.fatherName, patient.person.motherName]
    .filter(Boolean)
    .join(" ");
}

function MedicalPrescriptionPage() {
  const search = Route.useSearch();
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
    queryKey: ["medical-prescriptions", patient?.id ?? "all"],
    queryFn: async () =>
      certificatesORPCClient.listPrescriptions({
        limit: 50,
        patientId: patient?.id,
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
    onSuccess: (file, variables) => {
      const blob = file instanceof Blob ? file : new Blob([file as BlobPart]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        file instanceof File && file.name
          ? file.name
          : `receta_${variables.patientId}_${formatChile(new Date(), "YYYYMMDD")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      void queryClient.invalidateQueries({ queryKey: ["medical-prescriptions"] });
      toast.success("Receta generada");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Error al generar receta");
    },
  });

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
      .map(({ id: _id, ...item }) => ({
        dosage: item.dosage.trim() || undefined,
        duration: item.duration.trim() || undefined,
        frequency: item.frequency.trim() || undefined,
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
    });
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
          <Button className="gap-2" onPress={() => setSelectPatientOpen(true)}>
            <Plus size={16} />
            Nueva receta
          </Button>
        </div>
      </Card>

      <PrescriptionHistory
        isLoading={prescriptionsQ.isLoading}
        items={prescriptionsQ.data?.items ?? []}
        title={patient ? `Recetas de ${patientLabel}` : "Recetas recientes"}
      />

      {patient ? (
        <PrescriptionModal
          customDiagnosis={customDiagnosis}
          date={date}
          generatePending={generateMutation.isPending}
          medications={medications}
          notes={notes}
          selectedDiagnoses={selectedDiagnoses}
          onAddCustomDiagnosis={addCustomDiagnosis}
          onAddDiagnosis={addDiagnosis}
          onAddMedication={() => setMedications((current) => [...current, newMedicationDraft()])}
          onCustomDiagnosisChange={setCustomDiagnosis}
          onClose={() => setPatient(null)}
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

function PrescriptionHistory({
  isLoading,
  items,
  title,
}: {
  isLoading: boolean;
  items: MedicalPrescription[];
  title: string;
}) {
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
        <div className="divide-y divide-default-200">
          {items.map((item) => (
            <article className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start" key={item.id}>
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
            </article>
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
                Receta médica
              </Modal.Heading>
              <p className="text-default-600 text-sm">{patientLabel}</p>
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
                  <AppDatePicker
                    className="sm:w-64"
                    label="Fecha"
                    onChange={onDateChange}
                    value={date}
                  />

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
                        className="grid gap-3 rounded-lg border border-default-200 p-3 sm:grid-cols-2"
                        key={medication.id}
                      >
                        <TextField
                          isRequired
                          value={medication.name}
                          onChange={(value) => onMedicationChange(medication.id, { name: value })}
                        >
                          <Label>Medicamento {index + 1}</Label>
                          <Input placeholder="Nombre" />
                        </TextField>
                        <TextField
                          value={medication.dosage}
                          onChange={(value) => onMedicationChange(medication.id, { dosage: value })}
                        >
                          <Label>Dosis</Label>
                          <Input placeholder="Ej: 1 comprimido" />
                        </TextField>
                        <TextField
                          value={medication.frequency}
                          onChange={(value) =>
                            onMedicationChange(medication.id, { frequency: value })
                          }
                        >
                          <Label>Frecuencia</Label>
                          <Input placeholder="Ej: cada 12 horas" />
                        </TextField>
                        <TextField
                          value={medication.duration}
                          onChange={(value) =>
                            onMedicationChange(medication.id, { duration: value })
                          }
                        >
                          <Label>Duración</Label>
                          <Input placeholder="Ej: por 7 días" />
                        </TextField>
                        <TextField
                          className="sm:col-span-2"
                          value={medication.instructions}
                          onChange={(value) =>
                            onMedicationChange(medication.id, { instructions: value })
                          }
                        >
                          <Label>Instrucciones</Label>
                          <TextArea rows={2} />
                        </TextField>
                        <div className="flex justify-end sm:col-span-2">
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

import {
  Button,
  Calendar,
  Card,
  DateField,
  DatePicker,
  FieldError,
  Form,
  Input,
  Label,
  Modal,
  TextArea,
  TextField,
} from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { GenerateMedicalPrescriptionInput } from "@finanzas/orpc-contracts/certificates";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

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
  const searchPatientId = search.patientId;
  const [selectPatientOpen, setSelectPatientOpen] = useState(false);
  const [createPatientOpen, setCreatePatientOpen] = useState(false);
  const [patient, setPatient] = useState<SelectedPatient | null>(null);
  const [date, setDate] = useState(today());
  const [diagnosis, setDiagnosis] = useState("");
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
    setSubmitError(null);
    await generateMutation.mutateAsync({
      date,
      diagnosis: diagnosis.trim() || undefined,
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

      {patient ? (
        <PrescriptionModal
          date={date}
          diagnosis={diagnosis}
          generatePending={generateMutation.isPending}
          medications={medications}
          notes={notes}
          onAddMedication={() => setMedications((current) => [...current, newMedicationDraft()])}
          onClose={() => setPatient(null)}
          onDateChange={setDate}
          onDiagnosisChange={setDiagnosis}
          onMedicationChange={updateMedication}
          onMedicationRemove={removeMedication}
          onNotesChange={setNotes}
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

function PrescriptionModal({
  date,
  diagnosis,
  generatePending,
  medications,
  notes,
  onAddMedication,
  onClose,
  onDateChange,
  onDiagnosisChange,
  onMedicationChange,
  onMedicationRemove,
  onNotesChange,
  onSubmit,
  patientLabel,
  submitError,
}: {
  date: string;
  diagnosis: string;
  generatePending: boolean;
  medications: MedicationDraft[];
  notes: string;
  onAddMedication: () => void;
  onClose: () => void;
  onDateChange: (value: string) => void;
  onDiagnosisChange: (value: string) => void;
  onMedicationChange: (id: string, patch: Partial<MedicationDraft>) => void;
  onMedicationRemove: (id: string) => void;
  onNotesChange: (value: string) => void;
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
                  <DatePicker
                    className="sm:w-64"
                    onChange={(value) => onDateChange(value?.toString() ?? "")}
                    value={date ? parseDate(date) : undefined}
                  >
                    <Label>Fecha</Label>
                    <DateField.Group>
                      <DateField.InputContainer>
                        <DateField.Input>
                          {(segment) => <DateField.Segment segment={segment} />}
                        </DateField.Input>
                      </DateField.InputContainer>
                      <DateField.Suffix>
                        <DatePicker.Trigger>
                          <DatePicker.TriggerIndicator />
                        </DatePicker.Trigger>
                      </DateField.Suffix>
                    </DateField.Group>
                    <DatePicker.Popover>
                      <Calendar aria-label="Fecha de la receta">
                        <Calendar.Header>
                          <Calendar.YearPickerTrigger>
                            <Calendar.YearPickerTriggerHeading />
                            <Calendar.YearPickerTriggerIndicator />
                          </Calendar.YearPickerTrigger>
                          <Calendar.NavButton slot="previous" />
                          <Calendar.NavButton slot="next" />
                        </Calendar.Header>
                        <Calendar.Grid>
                          <Calendar.GridHeader>
                            {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                          </Calendar.GridHeader>
                          <Calendar.GridBody>
                            {(calendarDate) => <Calendar.Cell date={calendarDate} />}
                          </Calendar.GridBody>
                        </Calendar.Grid>
                        <Calendar.YearPickerGrid>
                          <Calendar.YearPickerGridBody>
                            {({ year }) => <Calendar.YearPickerCell year={year} />}
                          </Calendar.YearPickerGridBody>
                        </Calendar.YearPickerGrid>
                      </Calendar>
                    </DatePicker.Popover>
                  </DatePicker>

                  <TextField value={diagnosis} onChange={onDiagnosisChange}>
                    <Label>Diagnóstico</Label>
                    <TextArea rows={2} />
                  </TextField>

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

import {
  Button,
  Form,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  TextArea,
  TextField,
} from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { AppDatePicker } from "@/components/forms/AppDatePicker";
import { updatePatient } from "@/features/patients/api";
import { patientKeys } from "@/features/patients/queries";
import { toast } from "@/lib/toast-interceptor";

const BLOOD_TYPES = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

type EditablePatient = {
  id: number;
  birthDate?: string | null;
  bloodType?: string | null;
  notes?: string | null;
  person: {
    names: string;
    fatherName?: string | null;
    motherName?: string | null;
    rut?: string | null;
    email?: string | null;
    phone?: string | null;
    sex?: string | null;
  };
};

export function EditPatientModal({
  isOpen,
  onClose,
  patient,
}: {
  isOpen: boolean;
  onClose: () => void;
  patient: EditablePatient;
}) {
  const queryClient = useQueryClient();
  const [names, setNames] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [motherName, setMotherName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sex, setSex] = useState("");
  const [bloodType, setBloodType] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [notes, setNotes] = useState("");

  // Prefill desde el paciente al abrir.
  useEffect(() => {
    if (!isOpen) return;
    setNames(patient.person.names ?? "");
    setFatherName(patient.person.fatherName ?? "");
    setMotherName(patient.person.motherName ?? "");
    setEmail(patient.person.email ?? "");
    setPhone(patient.person.phone ?? "");
    setSex(patient.person.sex ?? "");
    setBloodType(patient.bloodType ?? "");
    setBirthDate(patient.birthDate ?? "");
    setNotes(patient.notes ?? "");
  }, [isOpen, patient]);

  const mutation = useMutation({
    mutationFn: async () =>
      updatePatient({
        patientId: patient.id,
        names: names.trim(),
        fatherName: fatherName.trim() || undefined,
        motherName: motherName.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        sex: sex ? (sex as "M" | "F" | "X") : undefined,
        bloodType: bloodType || undefined,
        birthDate: birthDate || undefined,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: patientKeys.detail(String(patient.id)) });
      void queryClient.invalidateQueries({ queryKey: patientKeys.all });
      toast.success("Paciente actualizado");
      onClose();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Error al actualizar paciente");
    },
  });

  if (!isOpen) return null;

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
          <Modal.Dialog className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4">
              <Modal.Heading className="font-semibold text-primary text-xl">
                Editar paciente
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <Form
                onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (names.trim()) mutation.mutate();
                }}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField value={names} onChange={setNames} isRequired>
                    <Label>Nombres</Label>
                    <Input placeholder="Nombres" />
                  </TextField>
                  <TextField value={fatherName} onChange={setFatherName}>
                    <Label>Apellido paterno</Label>
                    <Input />
                  </TextField>
                  <TextField value={motherName} onChange={setMotherName}>
                    <Label>Apellido materno</Label>
                    <Input />
                  </TextField>
                  <Select
                    onChange={(val) => setSex(val === "__no_sex__" ? "" : String(val))}
                    value={sex || "__no_sex__"}
                  >
                    <Label>Sexo</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        <ListBox.Item id="__no_sex__" key="__no_sex__">
                          Sin especificar
                        </ListBox.Item>
                        <ListBox.Item id="M" key="M">
                          Masculino
                        </ListBox.Item>
                        <ListBox.Item id="F" key="F">
                          Femenino
                        </ListBox.Item>
                        <ListBox.Item id="X" key="X">
                          Otro / Indeterminado
                        </ListBox.Item>
                      </ListBox>
                    </Select.Popover>
                  </Select>
                  <AppDatePicker
                    label="Fecha de nacimiento"
                    onChange={setBirthDate}
                    value={birthDate}
                  />
                  <Select
                    onChange={(val) => setBloodType(val === "__no_blood__" ? "" : String(val))}
                    value={bloodType || "__no_blood__"}
                  >
                    <Label>Grupo sanguíneo</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        <ListBox.Item id="__no_blood__" key="__no_blood__">
                          Desconocido
                        </ListBox.Item>
                        {BLOOD_TYPES.map((type) => (
                          <ListBox.Item id={type} key={type}>
                            {type}
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                  <TextField value={email} onChange={setEmail}>
                    <Label>Email</Label>
                    <Input type="email" />
                  </TextField>
                  <TextField value={phone} onChange={setPhone}>
                    <Label>Teléfono</Label>
                    <Input />
                  </TextField>
                </div>
                <TextField className="mt-3" value={notes} onChange={setNotes}>
                  <Label>Notas</Label>
                  <TextArea rows={2} />
                </TextField>
                <p className="mt-2 text-default-500 text-xs">
                  El RUT no se edita acá (evita duplicados). Para corregirlo, contactar soporte.
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <Button onPress={onClose} type="button" variant="ghost">
                    Cancelar
                  </Button>
                  <Button isDisabled={!names.trim()} isPending={mutation.isPending} type="submit">
                    Guardar cambios
                  </Button>
                </div>
              </Form>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

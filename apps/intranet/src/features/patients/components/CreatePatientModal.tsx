import type { DateValue } from "@internationalized/date";
import {
  Button,
  Calendar,
  Chip,
  DateField,
  DatePicker,
  Form,
  Label,
  ListBox,
  Modal,
  Select,
} from "@heroui/react";
import { useForm } from "@tanstack/react-form";
import { useStore } from "@tanstack/react-store";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, OctagonX, Save, User, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import {
  TanStackInputField,
  TanStackTextAreaField,
} from "@/components/forms/TanStackFieldControls";
import { useToast } from "@/context/ToastContext";
import { createPatient, fetchPatients } from "@/features/patients/api";
import { findPersonByRut } from "@/features/people/api";
import { formatRut, validateRut } from "@/lib/rut";

const BLOOD_TYPES = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

interface PatientFormState {
  rut: string;
  names: string;
  fatherName: string;
  motherName: string;
  email: string;
  phone: string;
  birthDate: DateValue | null;
  bloodType: string;
  notes: string;
}

type PatientPayload = Omit<PatientFormState, "birthDate"> & { birthDate?: string };

interface CreatePatientModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreatePatientModal({ isOpen, onClose }: Readonly<CreatePatientModalProps>) {
  const queryClient = useQueryClient();
  const { error: toastError, success } = useToast();

  const createPatientMutation = useMutation({
    mutationFn: async (payload: PatientPayload) => createPatient(payload),
    onError: (err) => {
      toastError(err instanceof Error ? err.message : "Error al registrar paciente");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["patients"] });
      success("Paciente registrado exitosamente");
      form.reset();
      onClose();
    },
  });

  const form = useForm({
    defaultValues: {
      rut: "",
      names: "",
      fatherName: "",
      motherName: "",
      email: "",
      phone: "",
      birthDate: null,
      bloodType: "",
      notes: "",
    } as PatientFormState,
    onSubmit: async ({ value }) => {
      if (!validateRut(value.rut)) {
        toastError("El RUT ingresado no es válido");
        return;
      }
      await createPatientMutation.mutateAsync({
        ...value,
        birthDate: value.birthDate?.toString() ?? undefined,
      });
    },
  });

  const handleClose = () => {
    if (createPatientMutation.isPending) {
      return;
    }
    form.reset();
    onClose();
  };

  // Dedup: debounced RUT + name for similar patient search
  const rutValue = useStore(form.store, (s) => s.values.rut);
  const nameValue = useStore(form.store, (s) => s.values.names);
  const [debouncedRut, setDebouncedRut] = useState("");
  const [debouncedName, setDebouncedName] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedRut(rutValue), 400);
    return () => clearTimeout(t);
  }, [rutValue]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedName(nameValue), 500);
    return () => clearTimeout(t);
  }, [nameValue]);

  const normalizedRut = debouncedRut.replace(/\./g, "").replace(/-/g, "").toUpperCase();
  const { data: rutMatches } = useQuery({
    queryKey: ["patients", debouncedRut],
    queryFn: () => fetchPatients(debouncedRut),
    enabled: normalizedRut.length >= 7,
    staleTime: 1000 * 30,
  });

  const { data: nameMatches } = useQuery({
    queryKey: ["patients", debouncedName],
    queryFn: () => fetchPatients(debouncedName),
    enabled: debouncedName.trim().length >= 3,
    staleTime: 1000 * 30,
  });

  // Look up existing Person by RUT (canonical normalized server-side).
  // The patients-list search uses contains and misses RUTs whose stored
  // format differs from the typed format (dots vs no dots), so the Person
  // lookup is the authoritative dedup signal.
  const { data: existingPerson } = useQuery({
    queryKey: ["person-by-rut", debouncedRut],
    queryFn: () => findPersonByRut(debouncedRut),
    enabled: normalizedRut.length >= 7 && validateRut(debouncedRut),
    staleTime: 1000 * 30,
  });

  const personWithPatient = existingPerson as
    | (NonNullable<typeof existingPerson> & { patient?: unknown })
    | null
    | undefined;
  const hasExistingPatient = Boolean(personWithPatient?.patient);

  const exactDuplicate =
    rutMatches?.find((p) => {
      const pRut = (p.person.rut ?? "").replace(/\./g, "").replace(/-/g, "").toUpperCase();
      return pRut === normalizedRut;
    }) ?? (hasExistingPatient && existingPerson ? { person: existingPerson } : undefined);

  const similarByName = nameMatches?.filter((p) => !rutMatches?.some((r) => r.id === p.id)) ?? [];

  const linkExistingPerson = () => {
    if (!existingPerson) return;
    if (existingPerson.names) form.setFieldValue("names", existingPerson.names);
    if (existingPerson.fatherName) form.setFieldValue("fatherName", existingPerson.fatherName);
    if (existingPerson.motherName) form.setFieldValue("motherName", existingPerson.motherName);
    if (existingPerson.email) form.setFieldValue("email", existingPerson.email);
    if (existingPerson.phone) form.setFieldValue("phone", existingPerson.phone);
  };

  return (
    <Modal>
      <Modal.Backdrop
        className="bg-black/40 backdrop-blur-[2px]"
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleClose();
          }
        }}
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-2xl rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4 font-bold text-primary text-xl">
              <Modal.Heading>Registrar Nuevo Paciente</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="mt-2 max-h-[80vh] overflow-y-auto overscroll-contain text-foreground">
              <Form
                className="space-y-6 pb-2"
                onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void form.handleSubmit();
                }}
                validationBehavior="aria"
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-default-100 border-b pb-2 font-semibold text-primary">
                    <UserPlus size={18} />
                    <h3>Informacion Personal</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <form.Field
                      name="rut"
                      validators={{
                        onBlur: ({ value }) =>
                          value && !validateRut(value) ? "RUT inválido" : undefined,
                      }}
                    >
                      {(field) => (
                        <TanStackInputField
                          field={field}
                          label="RUT"
                          placeholder="12.345.678-9"
                          required
                          transformOnChange={formatRut}
                        />
                      )}
                    </form.Field>

                    <form.Field name="names">
                      {(field) => (
                        <TanStackInputField
                          field={field}
                          label="Nombres"
                          placeholder="Ej: Juan Andres"
                          required
                        />
                      )}
                    </form.Field>

                    <form.Field name="fatherName">
                      {(field) => (
                        <TanStackInputField
                          field={field}
                          label="Primer apellido"
                          placeholder="Ej: Perez"
                          required
                        />
                      )}
                    </form.Field>

                    <form.Field name="motherName">
                      {(field) => (
                        <TanStackInputField
                          field={field}
                          label="Segundo apellido"
                          placeholder="Ej: Gonzalez"
                          required
                        />
                      )}
                    </form.Field>

                    <form.Field name="birthDate">
                      {(field) => (
                        <DatePicker
                          onChange={(value) => field.handleChange(value)}
                          value={field.state.value}
                        >
                          <Label>Fecha de Nacimiento</Label>
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
                            <Calendar aria-label="Fecha de nacimiento">
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
                                  {(date) => <Calendar.Cell date={date} />}
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
                      )}
                    </form.Field>

                    <form.Field name="bloodType">
                      {(field) => (
                        <Select
                          onChange={(val) =>
                            field.handleChange(
                              val === "__unknown_blood_type__" ? "" : (val as string)
                            )
                          }
                          value={field.state.value || "__unknown_blood_type__"}
                        >
                          <Label>Grupo Sanguineo</Label>
                          <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                          </Select.Trigger>
                          <Select.Popover>
                            <ListBox>
                              <ListBox.Item
                                id="__unknown_blood_type__"
                                key="__unknown_blood_type__"
                              >
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
                      )}
                    </form.Field>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-default-100 border-b pb-2 font-semibold text-primary">
                    <User size={18} />
                    <h3>Contacto y Ubicacion</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <form.Field name="email">
                      {(field) => (
                        <TanStackInputField
                          field={field}
                          label="Correo Electronico"
                          placeholder="paciente@ejemplo.com"
                          type="email"
                        />
                      )}
                    </form.Field>

                    <form.Field name="phone">
                      {(field) => (
                        <TanStackInputField
                          field={field}
                          label="Telefono"
                          placeholder="+56 9 1234 5678"
                        />
                      )}
                    </form.Field>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-default-100 border-b pb-2 font-semibold text-primary">
                    <Save size={18} />
                    <h3>Informacion Adicional</h3>
                  </div>
                  <form.Field name="notes">
                    {(field) => (
                      <TanStackTextAreaField
                        field={field}
                        className="h-28"
                        label="Notas clinicas / Antecedentes"
                        placeholder="Ingrese cualquier antecedente relevante o notas generales..."
                      />
                    )}
                  </form.Field>
                </div>

                {exactDuplicate && (
                  <div className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-danger text-sm">
                    <OctagonX size={16} className="mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold">RUT duplicado</p>
                      <p className="text-xs">
                        Ya existe:{" "}
                        <span className="font-medium">
                          {exactDuplicate.person.names} {exactDuplicate.person.fatherName}
                        </span>{" "}
                        — {exactDuplicate.person.rut}
                      </p>
                    </div>
                  </div>
                )}

                {!exactDuplicate && existingPerson && (
                  <div className="flex items-start justify-between gap-3 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm">
                    <div className="flex items-start gap-2">
                      <User size={16} className="mt-0.5 shrink-0 text-accent" />
                      <div>
                        <p className="font-semibold text-accent">
                          Esta persona ya existe en el sistema
                        </p>
                        <p className="text-default-600 text-xs">
                          {existingPerson.names} {existingPerson.fatherName ?? ""}{" "}
                          {existingPerson.motherName ?? ""}
                          {existingPerson.hasEmployee ? " · empleado" : ""}
                          {existingPerson.hasUser ? " · usuario" : ""}. Se enlazará el perfil de
                          paciente a este registro existente.
                        </p>
                      </div>
                    </div>
                    <Button onPress={linkExistingPerson} size="sm" variant="secondary">
                      Rellenar datos
                    </Button>
                  </div>
                )}

                {!exactDuplicate && similarByName.length > 0 && (
                  <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning-700 dark:text-warning-300">
                    <div className="mb-2 flex items-center gap-2 font-semibold">
                      <AlertTriangle size={15} />
                      Pacientes similares encontrados
                    </div>
                    <ul className="space-y-1">
                      {similarByName.slice(0, 3).map((p) => (
                        <li key={p.id} className="flex items-center gap-2 text-xs">
                          <Chip size="sm" variant="soft" color="warning">
                            {p.person.rut}
                          </Chip>
                          {p.person.names} {p.person.fatherName}
                          {p.person.phone && (
                            <span className="text-default-500">· {p.person.phone}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    isDisabled={createPatientMutation.isPending}
                    onPress={handleClose}
                    type="button"
                    variant="ghost"
                  >
                    Cancelar
                  </Button>
                  <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
                    {([canSubmit, isSubmitting]) => (
                      <Button
                        className="min-w-37.5"
                        isDisabled={
                          !canSubmit || createPatientMutation.isPending || Boolean(exactDuplicate)
                        }
                        isPending={isSubmitting || createPatientMutation.isPending}
                        type="submit"
                        variant="primary"
                      >
                        Registrar Paciente
                      </Button>
                    )}
                  </form.Subscribe>
                </div>
              </Form>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

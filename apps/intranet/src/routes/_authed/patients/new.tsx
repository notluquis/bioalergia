import { Button, Calendar, Card, DateField, DatePicker, Label } from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Save, User, UserPlus, X } from "lucide-react";
import {
  TanStackInputField,
  TanStackSelectField,
  TanStackTextAreaField,
} from "@/components/forms/TanStackFieldControls";
import { useToast } from "@/context/ToastContext";
import { createPatient } from "@/features/patients/api";
import { formatRut, validateRut } from "@/lib/rut";

export const Route = createFileRoute("/_authed/patients/new")({
  staticData: {
    permission: { action: "create", subject: "Patient" },
    hideFromNav: true,
  },
  component: AddPatientPage,
});

const BLOOD_TYPES = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

interface PatientFormState {
  rut: string;
  names: string;
  fatherName: string;
  motherName: string;
  email: string;
  phone: string;
  address: string;
  birthDate: string;
  bloodType: string;
  notes: string;
}

type PatientPayload = Omit<PatientFormState, "birthDate"> & { birthDate?: string };

function AddPatientPage() {
  const navigate = useNavigate();
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
      void navigate({ to: "/patients" });
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
      address: "",
      birthDate: "",
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
        birthDate: value.birthDate || undefined,
      });
    },
  });

  return (
    <section className="mx-auto max-w-4xl space-y-8">
      <div className="flex justify-end">
        <Button variant="ghost" onPress={() => navigate({ to: "/patients" })} className="gap-2">
          <X size={18} />
          Cancelar
        </Button>
      </div>

      <form
        onSubmit={() => {
          void form.handleSubmit();
        }}
        className="space-y-6"
      >
        <Card className="overflow-visible border-none bg-background shadow-sm">
          <Card.Content className="space-y-8 p-6">
            {/* Sección: Datos Personales */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-default-100 border-b pb-2 font-semibold text-primary">
                <UserPlus size={18} />
                <h3>Información Personal</h3>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <form.Field
                  name="rut"
                  validators={{
                    onBlur: ({ value }) => (!validateRut(value) ? "RUT inválido" : undefined),
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
                      placeholder="Ej: Juan Andrés"
                      required
                    />
                  )}
                </form.Field>

                <form.Field name="fatherName">
                  {(field) => (
                    <TanStackInputField
                      field={field}
                      label="Primer apellido"
                      placeholder="Ej: Pérez"
                      required
                    />
                  )}
                </form.Field>

                <form.Field name="motherName">
                  {(field) => (
                    <TanStackInputField
                      field={field}
                      label="Segundo apellido"
                      placeholder="Ej: González"
                      required
                    />
                  )}
                </form.Field>

                <form.Field name="birthDate">
                  {(field) => (
                    <DatePicker
                      onChange={(value) => {
                        field.handleChange(value?.toString() ?? "");
                      }}
                      value={field.state.value ? parseDate(field.state.value) : undefined}
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
                    <TanStackSelectField
                      emptyOption={{ label: "Desconocido", value: "__unknown_blood_type__" }}
                      field={field}
                      label="Grupo Sanguíneo"
                      options={BLOOD_TYPES.map((type) => ({ label: type, value: type }))}
                    />
                  )}
                </form.Field>
              </div>
            </div>

            {/* Sección: Contacto y Ubicación */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-default-100 border-b pb-2 font-semibold text-primary">
                <User size={18} />
                <h3>Contacto y Ubicación</h3>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <form.Field name="email">
                  {(field) => (
                    <TanStackInputField
                      field={field}
                      label="Correo Electrónico"
                      placeholder="paciente@ejemplo.com"
                      type="email"
                    />
                  )}
                </form.Field>

                <form.Field name="phone">
                  {(field) => (
                    <TanStackInputField
                      field={field}
                      label="Teléfono"
                      placeholder="+56 9 1234 5678"
                    />
                  )}
                </form.Field>

                <div className="md:col-span-2">
                  <form.Field name="address">
                    {(field) => (
                      <TanStackInputField
                        field={field}
                        label="Dirección"
                        placeholder="Calle, Número, Depto, Comuna"
                      />
                    )}
                  </form.Field>
                </div>
              </div>
            </div>

            {/* Sección: Notas Clínicas */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-default-100 border-b pb-2 font-semibold text-primary">
                <Save size={18} />
                <h3>Información Adicional</h3>
              </div>

              <form.Field name="notes">
                {(field) => (
                  <TanStackTextAreaField
                    className="h-32"
                    field={field}
                    label="Notas clínicas / Antecedentes"
                    placeholder="Ingrese cualquier antecedente relevante o notas generales..."
                    rows={4}
                  />
                )}
              </form.Field>
            </div>
          </Card.Content>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onPress={() => navigate({ to: "/patients" })}>
            Cancelar
          </Button>
          <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
            {([canSubmit, isSubmitting]) => (
              <Button
                type="submit"
                variant="primary"
                className="min-w-37.5 shadow-md"
                isDisabled={!canSubmit || createPatientMutation.isPending}
                isPending={isSubmitting || createPatientMutation.isPending}
              >
                Registrar Paciente
              </Button>
            )}
          </form.Subscribe>
        </div>
      </form>
    </section>
  );
}

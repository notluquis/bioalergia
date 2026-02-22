import { Calendar, DateField, DatePicker, Label, ListBox, Modal, Select } from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, User, UserPlus } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/context/ToastContext";
import { apiClient } from "@/lib/api-client";
import { formatRut, validateRut } from "@/lib/rut";

const BLOOD_TYPES = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];
const StatusResponseSchema = z.looseObject({ status: z.string().optional() });

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

interface CreatePatientModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreatePatientModal({ isOpen, onClose }: Readonly<CreatePatientModalProps>) {
  const queryClient = useQueryClient();
  const { error: toastError, success } = useToast();

  const createPatientMutation = useMutation({
    mutationFn: async (payload: PatientPayload) => {
      return await apiClient.post("/api/patients", payload, {
        responseSchema: StatusResponseSchema,
      });
    },
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

  const handleClose = () => {
    if (createPatientMutation.isPending) {
      return;
    }
    form.reset();
    onClose();
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
              <form
                className="space-y-6 pb-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void form.handleSubmit();
                }}
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
                        onBlur: ({ value }) => (!validateRut(value) ? "RUT inválido" : undefined),
                      }}
                    >
                      {(field) => (
                        <Input
                          error={field.state.meta.errors.join(", ")}
                          label="RUT"
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(formatRut(e.target.value))}
                          placeholder="12.345.678-9"
                          required
                          value={field.state.value}
                        />
                      )}
                    </form.Field>

                    <form.Field name="names">
                      {(field) => (
                        <Input
                          label="Nombres"
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="Ej: Juan Andres"
                          required
                          value={field.state.value}
                        />
                      )}
                    </form.Field>

                    <form.Field name="fatherName">
                      {(field) => (
                        <Input
                          label="Primer apellido"
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="Ej: Perez"
                          required
                          value={field.state.value}
                        />
                      )}
                    </form.Field>

                    <form.Field name="motherName">
                      {(field) => (
                        <Input
                          label="Segundo apellido"
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="Ej: Gonzalez"
                          required
                          value={field.state.value}
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
                            <DateField.Input>
                              {(segment) => <DateField.Segment segment={segment} />}
                            </DateField.Input>
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
                              val === "__unknown_blood_type__" ? "" : (val as string),
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
                        <Input
                          label="Correo Electronico"
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="paciente@ejemplo.com"
                          type="email"
                          value={field.state.value}
                        />
                      )}
                    </form.Field>

                    <form.Field name="phone">
                      {(field) => (
                        <Input
                          label="Telefono"
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="+56 9 1234 5678"
                          value={field.state.value}
                        />
                      )}
                    </form.Field>

                    <div className="md:col-span-2">
                      <form.Field name="address">
                        {(field) => (
                          <Input
                            label="Direccion"
                            onChange={(e) => field.handleChange(e.target.value)}
                            placeholder="Calle, Numero, Depto, Comuna"
                            value={field.state.value}
                          />
                        )}
                      </form.Field>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-default-100 border-b pb-2 font-semibold text-primary">
                    <Save size={18} />
                    <h3>Informacion Adicional</h3>
                  </div>
                  <form.Field name="notes">
                    {(field) => (
                      <Input
                        as="textarea"
                        className="h-28"
                        label="Notas clinicas / Antecedentes"
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="Ingrese cualquier antecedente relevante o notas generales..."
                        value={field.state.value}
                      />
                    )}
                  </form.Field>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    disabled={createPatientMutation.isPending}
                    onClick={handleClose}
                    type="button"
                    variant="ghost"
                  >
                    Cancelar
                  </Button>
                  <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
                    {([canSubmit, isSubmitting]) => (
                      <Button
                        className="min-w-37.5"
                        disabled={!canSubmit || createPatientMutation.isPending}
                        isLoading={isSubmitting || createPatientMutation.isPending}
                        type="submit"
                        variant="primary"
                      >
                        Registrar Paciente
                      </Button>
                    )}
                  </form.Subscribe>
                </div>
              </form>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

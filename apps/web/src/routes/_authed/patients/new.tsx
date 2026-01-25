import { Card } from "@heroui/react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Save, User, UserPlus, X } from "lucide-react";
import Button from "@/components/ui/Button";
import { CardContent } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { Select, SelectItem } from "@/components/ui/Select";
import { useToast } from "@/context/ToastContext";
import { apiClient } from "@/lib/api-client";
import { formatRut, validateRut } from "@/lib/rut";
import { TITLE_LG } from "@/lib/styles";

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

function AddPatientPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { error: toastError, success } = useToast();

  const createPatientMutation = useMutation({
    mutationFn: async (payload: PatientFormState) => {
      return await apiClient.post("/api/patients", payload);
    },
    onError: (err) => {
      toastError(err instanceof Error ? err.message : "Error al registrar paciente");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
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
      await createPatientMutation.mutateAsync(value);
    },
  });

  return (
    <section className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className={TITLE_LG}>Registrar Nuevo Paciente</h1>
          <p className="text-default-500 text-sm">Crea un perfil clínico para un nuevo paciente</p>
        </div>
        <Button
          variant="ghost"
          onClick={() => navigate({ to: "/patients" as any })}
          className="gap-2"
        >
          <X size={18} />
          Cancelar
        </Button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
        className="space-y-6"
      >
        <Card className="border-none bg-background shadow-sm overflow-visible">
          <CardContent className="p-6 space-y-8">
            {/* Sección: Datos Personales */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-primary font-semibold border-b border-default-100 pb-2">
                <UserPlus size={18} />
                <h3>Información Personal</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <form.Field
                  name="rut"
                  validators={{
                    onBlur: ({ value }) => (!validateRut(value) ? "RUT inválido" : undefined),
                  }}
                >
                  {(field) => (
                    <Input
                      label="RUT"
                      placeholder="12.345.678-9"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(formatRut(e.target.value))}
                      onBlur={field.handleBlur}
                      error={field.state.meta.errors.join(", ")}
                      required
                    />
                  )}
                </form.Field>

                <form.Field name="names">
                  {(field) => (
                    <Input
                      label="Nombres"
                      placeholder="Ej: Juan Andrés"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      required
                    />
                  )}
                </form.Field>

                <form.Field name="fatherName">
                  {(field) => (
                    <Input
                      label="Apellido Paterno"
                      placeholder="Ej: Pérez"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      required
                    />
                  )}
                </form.Field>

                <form.Field name="motherName">
                  {(field) => (
                    <Input
                      label="Apellido Materno"
                      placeholder="Ej: González"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      required
                    />
                  )}
                </form.Field>

                <form.Field name="birthDate">
                  {(field) => (
                    <Input
                      label="Fecha de Nacimiento"
                      type="date"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      required
                    />
                  )}
                </form.Field>

                <form.Field name="bloodType">
                  {(field) => (
                    <Select
                      label="Grupo Sanguíneo"
                      value={field.state.value}
                      onChange={(val) => field.handleChange(val as string)}
                    >
                      <SelectItem key="">Desconocido</SelectItem>
                      {BLOOD_TYPES.map((type) => (
                        <SelectItem key={type}>{type}</SelectItem>
                      ))}
                    </Select>
                  )}
                </form.Field>
              </div>
            </div>

            {/* Sección: Contacto y Ubicación */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-primary font-semibold border-b border-default-100 pb-2">
                <User size={18} />
                <h3>Contacto y Ubicación</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <form.Field name="email">
                  {(field) => (
                    <Input
                      label="Correo Electrónico"
                      type="email"
                      placeholder="paciente@ejemplo.com"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  )}
                </form.Field>

                <form.Field name="phone">
                  {(field) => (
                    <Input
                      label="Teléfono"
                      placeholder="+56 9 1234 5678"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  )}
                </form.Field>

                <div className="md:col-span-2">
                  <form.Field name="address">
                    {(field) => (
                      <Input
                        label="Dirección"
                        placeholder="Calle, Número, Depto, Comuna"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    )}
                  </form.Field>
                </div>
              </div>
            </div>

            {/* Sección: Notas Clínicas */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-primary font-semibold border-b border-default-100 pb-2">
                <Save size={18} />
                <h3>Información Adicional</h3>
              </div>

              <form.Field name="notes">
                {(field) => (
                  <Input
                    as="textarea"
                    label="Notas clínicas / Antecedentes"
                    placeholder="Ingrese cualquier antecedente relevante o notas generales..."
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="h-32"
                  />
                )}
              </form.Field>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate({ to: "/patients" as never })}
          >
            Cancelar
          </Button>
          <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
            {([canSubmit, isSubmitting]) => (
              <Button
                type="submit"
                variant="primary"
                className="shadow-md min-w-37.5"
                disabled={!canSubmit || createPatientMutation.isPending}
                isLoading={isSubmitting || createPatientMutation.isPending}
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

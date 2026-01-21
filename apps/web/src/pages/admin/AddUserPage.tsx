import { useFindManyRole } from "@finanzas/db/hooks";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Shield, UserPlus, Users } from "lucide-react";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import Input from "@/components/ui/Input";
import { Select, SelectItem } from "@/components/ui/Select";
import { useToast } from "@/context/ToastContext";
import { fetchPeople } from "@/features/people/api";
import { inviteUser } from "@/features/users/api";
import { getPersonFullName } from "@/lib/person";

interface AddUserFormState {
  email: string;
  fatherName: string;
  linkToPerson: boolean;
  mfaEnforced: boolean;
  motherName: string;
  names: string;
  passkeyOnly: boolean;
  personId: number | undefined;
  position: string;
  role: string;
  rut: string;
}

export default function AddUserPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { error: toastError, success } = useToast();

  // Fetch available roles
  const { data: rolesData } = useFindManyRole({
    orderBy: { name: "asc" },
  });
  const roles = rolesData || [];

  // Fetch people without users
  const { data: peopleData } = useSuspenseQuery({
    queryFn: fetchPeople,
    queryKey: ["people"],
  });

  // Filter people who don't have a user yet and exclude test users
  const availablePeople =
    peopleData?.filter(
      (p) =>
        !p.user &&
        !p.hasUser &&
        !p.names.toLowerCase().includes("test") &&
        !p.names.toLowerCase().includes("usuario prueba"),
    ) || [];

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: inviteUser,
    onError: (err) => {
      toastError(err instanceof Error ? err.message : "Error al crear usuario");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["people"] });
      success("Usuario creado exitosamente");
      navigate({ to: "/settings/users" });
    },
  });

  const form = useForm({
    defaultValues: {
      email: "",
      fatherName: "",
      linkToPerson: false,
      mfaEnforced: true,
      motherName: "",
      names: "",
      passkeyOnly: false,
      personId: undefined,
      position: "",
      role: "VIEWER",
      rut: "",
    } as AddUserFormState,
    onSubmit: async ({ value }) => {
      const payload: Record<string, unknown> = {
        email: value.email,
        mfaEnforced: value.mfaEnforced,
        passkeyOnly: value.passkeyOnly,
        position: value.position,
        role: value.role,
      };

      if (value.linkToPerson && value.personId) {
        payload.personId = value.personId;
      } else {
        payload.names = value.names;
        payload.fatherName = value.fatherName;
        payload.motherName = value.motherName;
        payload.rut = value.rut;
      }

      await createUserMutation.mutateAsync(payload);
    },
  });

  const handleLinkPerson = (pid: number | undefined) => {
    const person = availablePeople.find((p) => p.id === pid);

    // Batch updates using setFieldValue for each field
    // Logic: If linking (pid exists), clear manual fields and set email/position from person
    // If unlinking (pid undefined), keep current values (or clear if desired, but keeping is safer UX)

    if (person) {
      form.setFieldValue("email", person.email ?? form.getFieldValue("email"));
      form.setFieldValue("fatherName", "");
      form.setFieldValue("linkToPerson", true);
      form.setFieldValue("motherName", "");
      form.setFieldValue("names", "");
      form.setFieldValue("personId", pid);
      form.setFieldValue("position", person.employee?.position ?? form.getFieldValue("position"));
      form.setFieldValue("rut", "");
    } else {
      form.setFieldValue("linkToPerson", false);
      form.setFieldValue("personId", undefined);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-primary text-3xl font-bold">Agregar usuario</h1>
        <p className="text-base-content/70">
          Crea un nuevo usuario en el sistema. Se generará una contraseña temporal y el usuario
          deberá completar su configuración de seguridad al iniciar sesión.
        </p>
      </div>

      <form
        className="surface-elevated space-y-6 rounded-3xl p-6 shadow-lg"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
      >
        {/* Opción de vincular a persona existente */}
        {availablePeople.length > 0 && (
          <div className="border-info/20 bg-info/5 rounded-xl border p-4">
            <div className="flex items-start gap-3">
              <Users className="text-info mt-0.5 h-5 w-5" />
              <div className="flex-1 space-y-3">
                <div>
                  <p className="text-info font-medium">Vincular a persona existente</p>
                  <p className="text-base-content/70 text-xs">
                    Si esta persona ya existe en el sistema, puedes vincular el usuario
                    directamente.
                  </p>
                </div>
                <div className="space-y-2">
                  <form.Field name="personId">
                    {(field) => (
                      <Select
                        label="Vincular con persona (opcional)"
                        onChange={(val) => {
                          const pid = val ? Number(val) : undefined;
                          handleLinkPerson(pid);
                        }}
                        value={field.state.value ? String(field.state.value) : ""}
                      >
                        <SelectItem key="">No vincular (Crear usuario nuevo)</SelectItem>
                        {availablePeople.map((person) => (
                          <SelectItem key={String(person.id)}>
                            {getPersonFullName(person)} - {person.rut}
                          </SelectItem>
                        ))}
                      </Select>
                    )}
                  </form.Field>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <form.Subscribe selector={(state) => [state.values.personId]}>
            {([personId]) => {
              if (personId) return null;
              return (
                <>
                  <div className="md:col-span-2">
                    <h3 className="text-base-content mb-4 font-semibold">Datos personales</h3>
                  </div>
                  <form.Field name="names">
                    {(field) => (
                      <Input
                        label="Nombres"
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="Ej: Juan Andrés"
                        required
                        value={field.state.value}
                      />
                    )}
                  </form.Field>
                  <form.Field name="fatherName">
                    {(field) => (
                      <Input
                        label="Apellido Paterno"
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="Ej: Pérez"
                        required
                        value={field.state.value}
                      />
                    )}
                  </form.Field>
                  <form.Field name="motherName">
                    {(field) => (
                      <Input
                        label="Apellido Materno"
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="Ej: González"
                        required
                        value={field.state.value}
                      />
                    )}
                  </form.Field>
                  <form.Field name="rut">
                    {(field) => (
                      <Input
                        label="RUT"
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="12.345.678-9"
                        required
                        value={field.state.value}
                      />
                    )}
                  </form.Field>
                  <div className="md:col-span-1">{/* Spacer */}</div>
                </>
              );
            }}
          </form.Subscribe>

          <div className="md:col-span-2">
            <h3 className="text-base-content mt-2 mb-4 font-semibold">Datos de cuenta</h3>
          </div>

          <div className="md:col-span-2">
            <form.Field name="email">
              {(field) => (
                <form.Subscribe selector={(state) => [state.values.personId]}>
                  {([personId]) => (
                    <Input
                      helper={personId ? "Verifica o actualiza el correo asociado" : undefined}
                      label="Correo electrónico"
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="usuario@bioalergia.cl"
                      required
                      type="email"
                      value={field.state.value}
                    />
                  )}
                </form.Subscribe>
              )}
            </form.Field>
          </div>

          <form.Field name="position">
            {(field) => (
              <Input
                label="Cargo / posición"
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Ej: Enfermera, Administrativo"
                required
                value={field.state.value}
              />
            )}
          </form.Field>

          <form.Subscribe selector={(state) => [state.values.personId]}>
            {([personId]) => (
              <div className={personId ? "md:col-span-2" : ""}>
                <form.Field name="role">
                  {(field) => (
                    <Select
                      errorMessage={field.state.meta.errors.join(", ")}
                      isInvalid={field.state.meta.errors.length > 0}
                      label="Rol del sistema"
                      onChange={(val) => field.handleChange(val as string)}
                      value={field.state.value}
                    >
                      {roles.map((r) => (
                        <SelectItem key={r.name}>
                          {r.name} ({r.description || "Sin descripción"})
                        </SelectItem>
                      ))}
                    </Select>
                  )}
                </form.Field>
              </div>
            )}
          </form.Subscribe>
        </div>

        <div className="border-primary/20 bg-primary/5 rounded-xl border p-4">
          <div className="flex items-start gap-3">
            <Shield className="text-primary mt-0.5 h-5 w-5" />
            <div className="space-y-1">
              <p className="text-primary font-medium">Seguridad reforzada</p>
              <p className="text-base-content/70 text-xs">
                Si activas esta opción, el usuario estará <strong>obligado</strong> a configurar
                Passkey o MFA (Google Authenticator) antes de poder usar el sistema.
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-3 pl-8">
            <form.Field name="mfaEnforced">
              {(field) => (
                <Checkbox
                  checked={field.state.value}
                  label="Forzar passkey o MFA"
                  onChange={(e) => field.handleChange(e.target.checked)}
                />
              )}
            </form.Field>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button
            onClick={() => navigate({ to: "/settings/users" })}
            type="button"
            variant="secondary"
          >
            Cancelar
          </Button>
          <form.Subscribe selector={(state) => [state.isSubmitting]}>
            {([isSubmitting]) => (
              <Button
                className="gap-2"
                disabled={isSubmitting || createUserMutation.isPending}
                type="submit"
              >
                <UserPlus size={18} />
                {isSubmitting || createUserMutation.isPending ? "Creando..." : "Crear usuario"}
              </Button>
            )}
          </form.Subscribe>
        </div>
      </form>
    </div>
  );
}

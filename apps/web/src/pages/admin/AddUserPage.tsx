import { useFindManyRole } from "@finanzas/db/hooks";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Shield, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import Input from "@/components/ui/Input";
import { Select, SelectItem } from "@/components/ui/Select";
import { useToast } from "@/context/ToastContext";
import { fetchPeople } from "@/features/people/api";
import { inviteUser } from "@/features/users/api";
import { getPersonFullName } from "@/lib/person";

export default function AddUserPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { error: toastError, success } = useToast();
  const [form, setForm] = useState({
    email: "",
    fatherName: "",
    linkToPerson: false,
    mfaEnforced: true,
    motherName: "",
    names: "",
    passkeyOnly: false,
    personId: undefined as number | undefined,
    position: "",
    // role: "VIEWER", // This will now be managed by react-hook-form
    rut: "",
  });

  // Fetch available roles
  const { data: rolesData } = useFindManyRole({
    orderBy: { name: "asc" },
  });
  const roles = rolesData || [];

  const {
    handleSubmit: rhfHandleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm({
    defaultValues: {
      role: "VIEWER", // Set initial role for RHF
    },
  });

  const role = watch("role"); // Watch the role field from RHF

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

  const handleSubmit = rhfHandleSubmit((data) => {
    const payload: Record<string, unknown> = {
      email: form.email,
      mfaEnforced: form.mfaEnforced,
      passkeyOnly: form.passkeyOnly,
      position: form.position,
      role: data.role, // Use role from RHF data
    };

    if (form.linkToPerson && form.personId) {
      payload.personId = form.personId;
    } else {
      payload.names = form.names;
      payload.fatherName = form.fatherName;
      payload.motherName = form.motherName;
      payload.rut = form.rut;
    }

    createUserMutation.mutate(payload);
  });

  const loading = createUserMutation.isPending;

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
          void handleSubmit(e);
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
                  <Select
                    label="Vincular con persona (opcional)"
                    onChange={(val) => {
                      const pid = val ? Number(val) : undefined;
                      const person = availablePeople.find((p) => p.id === pid);
                      setForm({
                        ...form,
                        email: person?.email ?? form.email,
                        fatherName: pid ? "" : form.fatherName,
                        linkToPerson: !!pid,
                        motherName: pid ? "" : form.motherName,
                        names: pid ? "" : form.names,
                        personId: pid,
                        position: person?.employee?.position ?? form.position,
                        rut: pid ? "" : form.rut,
                      });
                    }}
                    value={form.personId ? String(form.personId) : ""}
                  >
                    <SelectItem key="">No vincular (Crear usuario nuevo)</SelectItem>
                    {availablePeople.map((person) => (
                      <SelectItem key={String(person.id)}>
                        {getPersonFullName(person)} - {person.rut}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {!form.personId && (
            <>
              <div className="md:col-span-2">
                <h3 className="text-base-content mb-4 font-semibold">Datos personales</h3>
              </div>
              <Input
                label="Nombres"
                onChange={(e) => {
                  setForm({ ...form, names: e.target.value });
                }}
                placeholder="Ej: Juan Andrés"
                required={!form.personId}
                value={form.names}
              />
              <Input
                label="Apellido Paterno"
                onChange={(e) => {
                  setForm({ ...form, fatherName: e.target.value });
                }}
                placeholder="Ej: Pérez"
                required={!form.personId}
                value={form.fatherName}
              />
              <Input
                label="Apellido Materno"
                onChange={(e) => {
                  setForm({ ...form, motherName: e.target.value });
                }}
                placeholder="Ej: González"
                required={!form.personId}
                value={form.motherName}
              />
              <Input
                label="RUT"
                onChange={(e) => {
                  setForm({ ...form, rut: e.target.value });
                }}
                placeholder="12.345.678-9"
                required={!form.personId}
                value={form.rut}
              />
              <div className="md:col-span-1">{/* Spacer */}</div>
            </>
          )}

          <div className="md:col-span-2">
            <h3 className="text-base-content mt-2 mb-4 font-semibold">Datos de cuenta</h3>
          </div>

          <div className="md:col-span-2">
            <Input
              helper={form.personId ? "Verifica o actualiza el correo asociado" : undefined}
              label="Correo electrónico"
              onChange={(e) => {
                setForm({ ...form, email: e.target.value });
              }}
              placeholder="usuario@bioalergia.cl"
              required
              type="email"
              value={form.email}
            />
          </div>

          <Input
            label="Cargo / posición"
            onChange={(e) => {
              setForm({ ...form, position: e.target.value });
            }}
            placeholder="Ej: Enfermera, Administrativo"
            required
            value={form.position}
          />

          <div className={form.personId ? "md:col-span-2" : ""}>
            <Select
              errorMessage={errors.role?.message}
              isInvalid={!!errors.role}
              label="Rol del sistema"
              onChange={(val) => setValue("role", val as string)}
              value={role}
            >
              {roles.map((r) => (
                <SelectItem key={r.name}>
                  {r.name} ({r.description || "Sin descripción"})
                </SelectItem>
              ))}
            </Select>
          </div>
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
            <Checkbox
              checked={form.mfaEnforced}
              label="Forzar passkey o MFA"
              onChange={(e) => {
                setForm({ ...form, mfaEnforced: e.target.checked });
              }}
            />
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
          <Button className="gap-2" disabled={loading} type="submit">
            <UserPlus size={18} />
            {loading ? "Creando..." : "Crear usuario"}
          </Button>
        </div>
      </form>
    </div>
  );
}

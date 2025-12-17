import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/context/ToastContext";
import { apiClient } from "@/lib/apiClient";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Checkbox from "@/components/ui/Checkbox";
import { Shield, UserPlus, Users } from "lucide-react";
import { getPersonFullName } from "@/lib/person";

type Person = {
  id: number;
  names: string;
  fatherName: string | null;
  motherName: string | null;
  rut: string;
  email: string | null;
  hasUser: boolean;
  hasEmployee: boolean;
};

export default function AddUserPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: "",
    names: "",
    fatherName: "",
    rut: "",
    role: "VIEWER",
    position: "",
    mfaEnforced: true,
    passkeyOnly: false,
    personId: undefined as number | undefined,
    linkToPerson: false,
  });

  const [availableRoles, setAvailableRoles] = useState<{ name: string; description: string }[]>([]);

  useEffect(() => {
    // Fetch available roles
    apiClient
      .get<{ roles: { name: string; description: string }[] }>("/api/roles")
      .then((res) => setAvailableRoles(res.roles))
      .catch(console.error);
  }, []);

  // Fetch people without users
  const { data: peopleData } = useQuery({
    queryKey: ["people"],
    queryFn: async () => {
      const res = await apiClient.get<{ status: string; people: Person[] }>("/api/people");
      return res.people;
    },
  });

  // Filter people who don't have a user yet
  const availablePeople = peopleData?.filter((p) => !p.hasUser) || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        email: form.email,
        role: form.role,
        position: form.position,
        mfaEnforced: form.mfaEnforced,
        passkeyOnly: form.passkeyOnly,
      };

      if (form.linkToPerson && form.personId) {
        payload.personId = form.personId;
      } else {
        // If creating new person, include person details
        payload.names = form.names;
        payload.fatherName = form.fatherName;
        // payload.motherName = ""; // Optional/omitted
        payload.rut = form.rut;
      }

      await apiClient.post("/api/users/invite", payload);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      // Also invalidate people list as one person now has a user
      await queryClient.invalidateQueries({ queryKey: ["people"] });

      success("Usuario creado exitosamente");
      navigate("/settings/users");
    } catch (err) {
      error(err instanceof Error ? err.message : "Error al crear usuario");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-primary text-3xl font-bold">Agregar usuario</h1>
        <p className="text-base-content/70">
          Crea un nuevo usuario en el sistema. Se generará una contraseña temporal y el usuario deberá completar su
          configuración de seguridad al iniciar sesión.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="surface-elevated space-y-6 rounded-3xl p-6 shadow-lg">
        {/* Opción de vincular a persona existente */}
        {availablePeople.length > 0 && (
          <div className="border-info/20 bg-info/5 rounded-xl border p-4">
            <div className="flex items-start gap-3">
              <Users className="text-info mt-0.5 h-5 w-5" />
              <div className="flex-1 space-y-3">
                <div>
                  <p className="text-info font-medium">Vincular a persona existente</p>
                  <p className="text-base-content/70 text-xs">
                    Si esta persona ya existe en el sistema, puedes vincular el usuario directamente.
                  </p>
                </div>
                <div className="space-y-2">
                  <Input
                    label="Vincular con persona (opcional)"
                    as="select"
                    id="personId"
                    value={form.personId ?? ""}
                    onChange={(e) => {
                      const pid = e.target.value ? Number(e.target.value) : undefined;
                      const person = availablePeople.find((p) => p.id === pid);
                      setForm({
                        ...form,
                        personId: pid,
                        linkToPerson: !!pid,
                        email: person?.email ?? form.email,
                        names: pid ? "" : form.names, // Clear manual fields if linking
                        fatherName: pid ? "" : form.fatherName,
                        rut: pid ? "" : form.rut,
                      });
                    }}
                  >
                    <option value="">No vincular (Crear usuario nuevo)</option>
                    {availablePeople.map((person) => (
                      <option key={person.id} value={person.id}>
                        {getPersonFullName(person)} - {person.rut}
                      </option>
                    ))}
                  </Input>
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
                value={form.names}
                onChange={(e) => setForm({ ...form, names: e.target.value })}
                required={!form.personId}
                placeholder="Ej: Juan Andrés"
              />
              <Input
                label="Apellido Paterno"
                value={form.fatherName}
                onChange={(e) => setForm({ ...form, fatherName: e.target.value })}
                required={!form.personId}
                placeholder="Ej: Pérez"
              />
              <Input
                label="RUT"
                value={form.rut}
                onChange={(e) => setForm({ ...form, rut: e.target.value })}
                required={!form.personId}
                placeholder="12.345.678-9"
              />
              <div className="md:col-span-1">{/* Spacer to align grid if needed, or just let email flow */}</div>

              <div className="md:col-span-2">
                <h3 className="text-base-content mt-2 mb-4 font-semibold">Datos de cuenta</h3>
              </div>

              <div className="md:col-span-2">
                <Input
                  label="Correo electrónico"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required={!form.personId}
                  placeholder="usuario@bioalergia.cl"
                />
              </div>

              <Input
                label="Cargo / posición"
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
                required={!form.personId}
                placeholder="Ej: Enfermera, Administrativo"
              />
            </>
          )}

          <div className={form.personId ? "md:col-span-2" : ""}>
            <label htmlFor="role" className="label">
              <span className="label-text">Rol</span>
            </label>
            <select
              id="role"
              className="select select-bordered w-full"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              required
            >
              {availableRoles.length === 0 && <option value="VIEWER">VIEWER (Fallback)</option>}
              {availableRoles.map((role) => (
                <option key={role.name} value={role.name}>
                  {role.name} {role.description ? `- ${role.description}` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="border-primary/20 bg-primary/5 rounded-xl border p-4">
          <div className="flex items-start gap-3">
            <Shield className="text-primary mt-0.5 h-5 w-5" />
            <div className="space-y-1">
              <p className="text-primary font-medium">Seguridad reforzada</p>
              <p className="text-base-content/70 text-xs">
                Si activas esta opción, el usuario estará <strong>obligado</strong> a configurar Passkey o MFA (Google
                Authenticator) antes de poder usar el sistema.
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-3 pl-8">
            <Checkbox
              label="Forzar passkey o MFA"
              checked={form.mfaEnforced}
              onChange={(e) => setForm({ ...form, mfaEnforced: e.target.checked })}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={() => navigate("/settings/users")}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading} className="gap-2">
            <UserPlus size={18} />
            {loading ? "Creando..." : "Crear usuario"}
          </Button>
        </div>
      </form>
    </div>
  );
}

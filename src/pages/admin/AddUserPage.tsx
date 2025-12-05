import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/context/ToastContext";
import { apiClient } from "@/lib/apiClient";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Checkbox from "@/components/ui/Checkbox";
import { Shield, UserPlus } from "lucide-react";

export default function AddUserPage() {
  const navigate = useNavigate();
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: "",
    role: "VIEWER",
    position: "Por definir",
    mfaEnforced: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiClient.post("/api/users/invite", form);
      success("Usuario creado exitosamente");
      navigate("/admin/users");
    } catch (err) {
      error(err instanceof Error ? err.message : "Error al crear usuario");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-primary">Agregar Usuario</h1>
        <p className="text-base-content/70">
          Crea un nuevo usuario en el sistema. Se generar? una contrase?a temporal y el usuario deber? completar su
          configuraci?n de seguridad al iniciar sesi?n.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="surface-elevated space-y-6 rounded-3xl p-8 shadow-lg">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="md:col-span-2">
            <Input
              label="Correo Electr?nico"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              placeholder="usuario@bioalergia.cl"
            />
          </div>

          <Input
            label="Rol"
            as="select"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            required
          >
            <option value="VIEWER">Viewer (Solo lectura)</option>
            <option value="ANALYST">Analyst (Gesti?n b?sica)</option>
            <option value="ADMIN">Admin (Gesti?n total)</option>
            <option value="GOD">God (Acceso total)</option>
          </Input>

          <Input
            label="Cargo / Posici?n"
            value={form.position}
            onChange={(e) => setForm({ ...form, position: e.target.value })}
            required
            placeholder="Ej: Enfermera, Administrativo"
          />
        </div>

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-5 w-5 text-primary" />
            <div className="space-y-1">
              <p className="font-medium text-primary">Seguridad Reforzada</p>
              <p className="text-xs text-base-content/70">
                Si activas esta opci?n, el usuario estar? <strong>obligado</strong> a configurar Passkey o MFA (Google
                Authenticator) antes de poder usar el sistema.
              </p>
            </div>
          </div>
          <div className="mt-4 pl-8">
            <Checkbox
              label="Forzar Passkey o MFA"
              checked={form.mfaEnforced}
              onChange={(e) => setForm({ ...form, mfaEnforced: e.target.checked })}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={() => navigate("/admin/users")}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading} className="gap-2">
            <UserPlus size={18} />
            {loading ? "Creando..." : "Crear Usuario"}
          </Button>
        </div>
      </form>
    </div>
  );
}

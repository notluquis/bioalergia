import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Loader2, Server, Globe, Database } from "lucide-react";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { useSettings, type AppSettings } from "../../context/settings-context";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

function normalizeExternalUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

type AccessForm = Pick<AppSettings, "dbDisplayHost" | "dbDisplayName" | "dbConsoleUrl" | "cpanelUrl">;

export default function AccessSettingsPage() {
  const { settings, updateSettings } = useSettings();
  const { hasRole } = useAuth();
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = hasRole("GOD", "ADMIN");

  // --- Settings Form State ---
  const [form, setForm] = useState<AccessForm>(() => ({
    dbDisplayHost: settings.dbDisplayHost,
    dbDisplayName: settings.dbDisplayName,
    dbConsoleUrl: settings.dbConsoleUrl,
    cpanelUrl: settings.cpanelUrl,
  }));
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      dbDisplayHost: settings.dbDisplayHost,
      dbDisplayName: settings.dbDisplayName,
      dbConsoleUrl: settings.dbConsoleUrl,
      cpanelUrl: settings.cpanelUrl,
    });
  }, [settings]);

  // --- Users Query (for Admin MFA Control) ---
  const { data: usersData, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["users", "admin-list"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Error cargando usuarios");
      return res.json();
    },
    enabled: isAdmin,
  });

  const toggleMfaMutation = useMutation({
    mutationFn: async ({ userId, enabled }: { userId: number; enabled: boolean }) => {
      const res = await fetch(`/api/users/${userId}/mfa/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json();
      if (data.status !== "ok") throw new Error(data.message || "Error al cambiar estado MFA");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users", "admin-list"] });
      success("Estado MFA actualizado");
    },
    onError: (err) => {
      toastError(err instanceof Error ? err.message : "Error desconocido");
    },
  });

  // --- Handlers ---
  const handleChange = (key: keyof AccessForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setStatus("idle");
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("saving");
    setError(null);
    try {
      await updateSettings({
        ...settings,
        ...form,
        dbConsoleUrl: normalizeExternalUrl(form.dbConsoleUrl),
        cpanelUrl: normalizeExternalUrl(form.cpanelUrl),
      });
      setStatus("success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo guardar la configuración";
      setError(message);
      setStatus("error");
    }
  };

  const quickLinks = useMemo(
    () => [
      {
        label: "Abrir cPanel",
        href: normalizeExternalUrl(settings.cpanelUrl),
        description: settings.cpanelUrl ? settings.cpanelUrl : "Configura el enlace directo al cPanel.",
        icon: Server,
      },
      {
        label: "Abrir consola DB",
        href: normalizeExternalUrl(settings.dbConsoleUrl),
        description: settings.dbConsoleUrl
          ? settings.dbConsoleUrl
          : "Configura el acceso a la consola de la base de datos.",
        icon: Database,
      },
    ],
    [settings.cpanelUrl, settings.dbConsoleUrl]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-base-content">Accesos y Seguridad</h1>
        <p className="text-sm text-base-content/60">Gestiona accesos técnicos y seguridad de usuarios.</p>
      </div>

      {/* Admin User Management Section */}
      {isAdmin && (
        <div className="surface-elevated rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center text-warning">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 className="font-bold text-lg">Seguridad de Usuarios</h2>
              <p className="text-xs text-base-content/60">Control de MFA y accesos.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th className="text-center">MFA</th>
                  <th className="text-center">Passkey</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingUsers ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-base-content/50">
                      <Loader2 className="mx-auto size-6 animate-spin" />
                    </td>
                  </tr>
                ) : (
                  usersData?.users?.map(
                    (u: {
                      id: number;
                      email: string;
                      role: string;
                      mfaEnabled: boolean;
                      passkeysCount: number;
                      hasPasskey: boolean;
                    }) => (
                      <tr key={u.id} className="hover:bg-base-200/50">
                        <td className="font-medium">{u.email}</td>
                        <td className="text-xs opacity-70">{u.role}</td>
                        <td className="text-center">
                          {u.mfaEnabled ? (
                            <span className="badge badge-success badge-sm gap-1">
                              <ShieldCheck className="size-3" /> Activo
                            </span>
                          ) : (
                            <span className="badge badge-ghost badge-sm">Inactivo</span>
                          )}
                        </td>
                        <td className="text-center">
                          {u.hasPasskey ? (
                            <span className="text-xs text-success">Sí</span>
                          ) : (
                            <span className="text-xs text-base-content/30">-</span>
                          )}
                        </td>
                        <td className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className={
                              u.mfaEnabled ? "text-error hover:bg-error/10" : "text-primary hover:bg-primary/10"
                            }
                            onClick={() => toggleMfaMutation.mutate({ userId: u.id, enabled: !u.mfaEnabled })}
                            disabled={toggleMfaMutation.isPending}
                          >
                            {u.mfaEnabled ? "Desactivar MFA" : "Activar MFA"}
                          </Button>
                        </td>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Quick Links */}
        <div className="surface-elevated rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-info/10 flex items-center justify-center text-info">
              <Globe size={20} />
            </div>
            <div>
              <h2 className="font-bold text-lg">Accesos Rápidos</h2>
              <p className="text-xs text-base-content/60">Enlaces a paneles externos.</p>
            </div>
          </div>
          <div className="space-y-3">
            {quickLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => link.href && window.open(link.href, "_blank", "noopener,noreferrer")}
                disabled={!link.href}
                className="flex items-center gap-3 w-full p-3 rounded-xl border border-base-200 hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
              >
                <div className="w-8 h-8 rounded-lg bg-base-200 flex items-center justify-center group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                  <link.icon size={16} />
                </div>
                <div>
                  <div className="font-medium text-sm">{link.label}</div>
                  <div className="text-xs text-base-content/50 truncate max-w-[200px]">{link.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Connection Details Form */}
        <div className="surface-elevated rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
              <Database size={20} />
            </div>
            <div>
              <h2 className="font-bold text-lg">Conexiones</h2>
              <p className="text-xs text-base-content/60">Configuración de acceso a DB.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Servidor Visible</span>
              </label>
              <Input
                value={form.dbDisplayHost}
                onChange={(e) => handleChange("dbDisplayHost", e.target.value)}
                placeholder="Ej: db.bioalergia.cl"
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Nombre Base de Datos</span>
              </label>
              <Input
                value={form.dbDisplayName}
                onChange={(e) => handleChange("dbDisplayName", e.target.value)}
                placeholder="Ej: bio_finanzas"
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">URL Consola DB</span>
              </label>
              <Input
                value={form.dbConsoleUrl}
                onChange={(e) => handleChange("dbConsoleUrl", e.target.value)}
                placeholder="https://"
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">URL cPanel</span>
              </label>
              <Input
                value={form.cpanelUrl}
                onChange={(e) => handleChange("cpanelUrl", e.target.value)}
                placeholder="https://"
              />
            </div>

            {error && <div className="text-error text-sm">{error}</div>}
            {status === "success" && <div className="text-success text-sm">Guardado correctamente</div>}

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={status === "saving"}>
                {status === "saving" ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

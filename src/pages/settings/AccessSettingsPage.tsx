import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Loader2 } from "lucide-react";
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
      },
      {
        label: "Abrir consola DB",
        href: normalizeExternalUrl(settings.dbConsoleUrl),
        description: settings.dbConsoleUrl
          ? settings.dbConsoleUrl
          : "Configura el acceso a la consola de la base de datos.",
      },
    ],
    [settings.cpanelUrl, settings.dbConsoleUrl]
  );

  return (
    <div className="space-y-8">
      {/* Admin User Management Section */}
      {isAdmin && (
        <section className="bg-base-100 space-y-4 p-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-primary drop-shadow-sm">Gestión de Usuarios y Seguridad</h2>
            <p className="text-sm text-base-content/70">
              Controla el acceso y la autenticación de dos factores (MFA) para los usuarios.
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border border-base-300">
            <table className="table w-full">
              <thead>
                <tr className="bg-base-200/50 text-left text-xs uppercase text-base-content/60">
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3 text-center">MFA</th>
                  <th className="px-4 py-3 text-center">Passkey</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
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
                      <tr key={u.id} className="border-b border-base-200 last:border-0 hover:bg-base-200/30">
                        <td className="px-4 py-3 font-medium">{u.email}</td>
                        <td className="px-4 py-3 text-xs opacity-70">{u.role}</td>
                        <td className="px-4 py-3 text-center">
                          {u.mfaEnabled ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-xs font-medium text-success">
                              <ShieldCheck className="size-3" /> Activo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-base-300/50 px-2 py-1 text-xs font-medium text-base-content/50">
                              Inactivo
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {u.hasPasskey ? (
                            <span className="text-xs text-success">Sí</span>
                          ) : (
                            <span className="text-xs text-base-content/30">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
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
        </section>
      )}

      <section className="bg-base-100 space-y-4 p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-primary drop-shadow-sm">Accesos rápidos</h2>
          <p className="text-sm text-base-content/70">
            Lanza los paneles que usas con frecuencia y mantén visible la información clave de la base de datos.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {quickLinks.map((link) => (
            <button
              key={link.label}
              onClick={() => link.href && window.open(link.href, "_blank", "noopener,noreferrer")}
              disabled={!link.href}
              className="flex flex-col rounded-2xl border border-base-300 bg-base-100 px-4 py-3 text-left text-sm text-base-content/70 transition hover:border-primary/35 hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="font-semibold text-base-content">{link.label}</span>
              <span className="text-xs text-base-content/60">{link.description}</span>
            </button>
          ))}
        </div>
      </section>

      <form onSubmit={handleSubmit} className="bg-base-100 space-y-5 p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-secondary drop-shadow-sm">Detalle de conexiones</h2>
          <p className="text-sm text-base-content/70">
            Documenta cómo acceder a los paneles y la base de datos para el equipo técnico.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm text-base-content/70">
            <span className="text-xs font-semibold uppercase tracking-wide text-base-content/60">Servidor visible</span>
            <Input
              type="text"
              value={form.dbDisplayHost}
              onChange={(event) => handleChange("dbDisplayHost", event.target.value)}
              placeholder="Ej: db.bioalergia.cl"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-base-content/70">
            <span className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
              Nombre de la base
            </span>
            <Input
              type="text"
              value={form.dbDisplayName}
              onChange={(event) => handleChange("dbDisplayName", event.target.value)}
              placeholder="Ej: bio_finanzas"
            />
          </label>
          <label className="md:col-span-2 flex flex-col gap-2 text-sm text-base-content/70">
            <span className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
              URL consola DB (https)
            </span>
            <Input
              type="url"
              value={form.dbConsoleUrl}
              onChange={(event) => handleChange("dbConsoleUrl", event.target.value)}
              placeholder="https://"
            />
            <span className="text-xs text-base-content/50">Se normaliza automáticamente para incluir https://</span>
          </label>
          <label className="md:col-span-2 flex flex-col gap-2 text-sm text-base-content/70">
            <span className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
              URL cPanel (https)
            </span>
            <Input
              type="url"
              value={form.cpanelUrl}
              onChange={(event) => handleChange("cpanelUrl", event.target.value)}
              placeholder="https://"
            />
          </label>
        </div>

        {error && (
          <p className="border-l-4 border-error/70 bg-linear-to-r from-error/10 via-base-100/70 to-base-100/55 px-4 py-3 text-sm text-error">
            {error}
          </p>
        )}
        {status === "success" && !error && (
          <p className="border-l-4 border-success/70 bg-linear-to-r from-success/10 via-base-100/70 to-base-100/55 px-4 py-3 text-sm text-success">
            Accesos actualizados correctamente.
          </p>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={status === "saving"}>
            {status === "saving" ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </form>
    </div>
  );
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Loader2, UserCog, Key, Shield, Lock } from "lucide-react";
import Button from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { apiClient } from "@/lib/apiClient";
import { BADGE_SM } from "@/lib/styles";

export default function AccessSettingsPage() {
  const { hasRole } = useAuth();
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = hasRole("GOD", "ADMIN");

  // --- Users Query (for Admin MFA Control) ---
  interface User {
    id: number;
    email: string;
    role: string;
    mfaEnabled: boolean;
    passkeysCount: number;
    hasPasskey: boolean;
  }

  const { data: usersData, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["users", "admin-list"],
    queryFn: async () => {
      return apiClient.get<{ users: User[] }>("/api/users");
    },
    enabled: isAdmin,
  });

  const toggleMfaMutation = useMutation({
    mutationFn: async ({ userId, enabled }: { userId: number; enabled: boolean }) => {
      const data = await apiClient.post<{ status: string; message?: string }>(`/api/users/${userId}/mfa/toggle`, {
        enabled,
      });
      if (data.status !== "ok") throw new Error(data.message || "Error al cambiar estado MFA");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users", "admin-list"] });
      success("Estado MFA actualizado correctamente");
    },
    onError: (err) => {
      toastError(err instanceof Error ? err.message : "Error desconocido");
    },
  });

  const getSecurityScore = (user: User) => {
    let score = 0;
    if (user.mfaEnabled) score += 50;
    if (user.hasPasskey) score += 50;
    return score;
  };

  const getSecurityBadge = (score: number) => {
    if (score === 100) return { label: "Óptima", color: "badge-success", icon: Shield };
    if (score >= 50) return { label: "Buena", color: "badge-warning", icon: ShieldCheck };
    return { label: "Básica", color: "badge-error", icon: Lock };
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-base-content text-2xl font-bold">Accesos y conexiones</h1>
        <p className="text-base-content/60 text-sm">
          Administra la seguridad de las cuentas de usuario con autenticación de múltiples factores y passkeys.
        </p>
      </div>

      {/* Security Overview Cards */}
      {isAdmin && usersData?.users && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-full">
                  <UserCog size={24} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{usersData.users.length}</p>
                  <p className="text-base-content/60 text-sm">Usuarios totales</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card bg-base-100 shadow-sm">
            <div className="card-body">
              <div className="flex items-center gap-3">
                <div className="bg-success/10 text-success flex h-12 w-12 items-center justify-center rounded-full">
                  <Shield size={24} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{usersData.users.filter((u) => u.mfaEnabled).length}</p>
                  <p className="text-base-content/60 text-sm">Con MFA activo</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card bg-base-100 shadow-sm">
            <div className="card-body">
              <div className="flex items-center gap-3">
                <div className="bg-info/10 text-info flex h-12 w-12 items-center justify-center rounded-full">
                  <Key size={24} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{usersData.users.filter((u) => u.hasPasskey).length}</p>
                  <p className="text-base-content/60 text-sm">Con Passkey</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Management Section */}
      {isAdmin && (
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Gestión de Usuarios</h2>
                <p className="text-base-content/60 text-sm">
                  Administra el nivel de seguridad de cada cuenta de usuario
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Rol</th>
                    <th className="text-center">Seguridad</th>
                    <th className="text-center">MFA</th>
                    <th className="text-center">Passkey</th>
                    <th className="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingUsers ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <Loader2 className="text-base-content/30 mx-auto size-8 animate-spin" />
                      </td>
                    </tr>
                  ) : (
                    usersData?.users?.map((user: User) => {
                      const securityScore = getSecurityScore(user);
                      const badge = getSecurityBadge(securityScore);
                      const BadgeIcon = badge.icon;

                      return (
                        <tr key={user.id} className="hover">
                          <td>
                            <div className="flex items-center gap-3">
                              <div className="avatar placeholder">
                                <div className="bg-neutral text-neutral-content flex h-10 w-10 items-center justify-center rounded-full">
                                  <span className="text-xs">
                                    {user.email?.split("@")[0]?.substring(0, 2)?.toUpperCase() || "??"}
                                  </span>
                                </div>
                              </div>
                              <div>
                                <div className="font-medium">{user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`${BADGE_SM} badge-ghost`}>{user.role}</span>
                          </td>
                          <td className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className={`${BADGE_SM} ${badge.color} gap-1`}>
                                <BadgeIcon className="size-3" />
                                {badge.label}
                              </span>
                              <span className="text-base-content/50 text-xs">{securityScore}%</span>
                            </div>
                          </td>
                          <td className="text-center">
                            {user.mfaEnabled ? (
                              <div className="flex items-center justify-center gap-1">
                                <ShieldCheck className="text-success size-4" />
                                <span className="text-success text-xs font-medium">Activo</span>
                              </div>
                            ) : (
                              <span className="text-base-content/30 text-xs">Inactivo</span>
                            )}
                          </td>
                          <td className="text-center">
                            {user.hasPasskey ? (
                              <div className="flex items-center justify-center gap-1">
                                <Key className="text-info size-4" />
                                <span className="text-info text-xs font-medium">Sí</span>
                              </div>
                            ) : (
                              <span className="text-base-content/30 text-xs">No</span>
                            )}
                          </td>
                          <td className="text-right">
                            <Button
                              size="sm"
                              variant={user.mfaEnabled ? "ghost" : "primary"}
                              onClick={() =>
                                toggleMfaMutation.mutate({
                                  userId: user.id,
                                  enabled: !user.mfaEnabled,
                                })
                              }
                              disabled={toggleMfaMutation.isPending}
                            >
                              {user.mfaEnabled ? "Desactivar MFA" : "Activar MFA"}
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Security Recommendations */}
            {usersData?.users && (
              <div className="bg-info/10 mt-6 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="text-info mt-0.5 size-5" />
                  <div className="flex-1">
                    <h3 className="text-info font-semibold">Recomendaciones de Seguridad</h3>
                    <ul className="text-base-content/70 mt-2 space-y-1 text-sm">
                      <li>
                        • <strong>MFA (Autenticación Multifactor):</strong> Añade una capa extra de seguridad
                        solicitando un código de verificación además de la contraseña.
                      </li>
                      <li>
                        • <strong>Passkey (Biometría):</strong> Permite iniciar sesión de forma segura usando huella
                        digital, reconocimiento facial o clave de dispositivo.
                      </li>
                      <li>• Se recomienda que todos los usuarios activen ambas opciones para máxima seguridad.</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Non-admin message */}
      {!isAdmin && (
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body text-center">
            <Lock className="text-base-content/30 mx-auto size-12" />
            <h3 className="text-lg font-semibold">Acceso Restringido</h3>
            <p className="text-base-content/60 text-sm">
              Solo los administradores pueden gestionar la seguridad de usuarios.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

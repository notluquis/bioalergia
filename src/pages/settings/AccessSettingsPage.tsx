import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, UserCog, Key, ShieldCheck, Lock } from "lucide-react";
import Button from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { fetchUsers, toggleUserMfa } from "@/features/users/api";
import type { User } from "@/features/users/types";
import { BADGE_SM } from "@/lib/styles";

export default function AccessSettingsPage() {
  const { success, error: toastError } = useToast();
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = can("update", "User");

  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ["users", "admin-list"],
    queryFn: fetchUsers,
    enabled: isAdmin,
  });

  const toggleMfaMutation = useMutation({
    mutationFn: ({ userId, enabled }: { userId: number; enabled: boolean }) => toggleUserMfa(userId, enabled),
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

  const tableColumns = [
    { key: "user", label: "Usuario" },
    { key: "role", label: "Rol" },
    { key: "security", label: "Seguridad", align: "center" as const },
    { key: "mfa", label: "MFA", align: "center" as const },
    { key: "passkey", label: "Passkey", align: "center" as const },
    { key: "actions", label: "Acciones", align: "right" as const },
  ];

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
      {isAdmin && users && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-full">
                  <UserCog size={24} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{users.length}</p>
                  <p className="text-base-content/60 text-sm">Usuarios totales</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="bg-success/10 text-success flex h-12 w-12 items-center justify-center rounded-full">
                  <Shield size={24} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{users.filter((u) => u.mfaEnabled).length}</p>
                  <p className="text-base-content/60 text-sm">Con MFA activo</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="bg-info/10 text-info flex h-12 w-12 items-center justify-center rounded-full">
                  <Key size={24} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{users.filter((u) => u.hasPasskey).length}</p>
                  <p className="text-base-content/60 text-sm">Con passkey</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* User Management Section */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">Gestión de usuarios</CardTitle>
                <CardDescription>Administra el nivel de seguridad de cada cuenta de usuario</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table columns={tableColumns}>
              <Table.Body loading={isLoadingUsers} columnsCount={6}>
                {users.map((user: User) => {
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
                })}
              </Table.Body>
            </Table>

            {/* Security Recommendations */}
            {users && (
              <div className="bg-info/10 mt-6 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="text-info mt-0.5 size-5" />
                  <div className="flex-1">
                    <h3 className="text-info font-semibold">Recomendaciones de seguridad</h3>
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
          </CardContent>
        </Card>
      )}

      {/* Non-admin message */}
      {!isAdmin && (
        <Card>
          <CardContent className="p-8 text-center">
            <Lock className="text-base-content/30 mx-auto size-12" />
            <h3 className="mt-4 text-lg font-semibold">Acceso restringido</h3>
            <p className="text-base-content/60 text-sm">
              Solo los administradores pueden gestionar la seguridad de usuarios.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

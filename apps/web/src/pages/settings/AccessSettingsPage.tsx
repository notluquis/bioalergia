import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Key, Lock, Shield, ShieldCheck, UserCog } from "lucide-react";

import { DataTable } from "@/components/data-table/DataTable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { toggleUserMfa } from "@/features/users/api";
import { getUserAccessColumns } from "@/features/users/components/UserAccessColumns";
import { userKeys } from "@/features/users/queries";

export default function AccessSettingsPage() {
  const { error: toastError, success } = useToast();
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = can("update", "User");

  const { data: users } = useSuspenseQuery(userKeys.adminList());

  const toggleMfaMutation = useMutation({
    mutationFn: ({ enabled, userId }: { enabled: boolean; userId: number }) =>
      toggleUserMfa(userId, enabled),
    onError: (err) => {
      toastError(err instanceof Error ? err.message : "Error desconocido");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users", "admin-list"] });
      success("Estado MFA actualizado correctamente");
    },
  });

  const columns = getUserAccessColumns((userId, enabled) => {
    toggleMfaMutation.mutate({ enabled, userId });
  }, toggleMfaMutation.isPending);

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Lock className="text-base-content/30 mx-auto size-12" />
          <h3 className="mt-4 text-lg font-semibold">Acceso restringido</h3>
          <p className="text-base-content/60 text-sm">
            Solo los administradores pueden gestionar la seguridad de usuarios.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* Security Overview Cards */}
      {users && (
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Gestión de usuarios</CardTitle>
              <CardDescription>
                Administra el nivel de seguridad de cada cuenta de usuario
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={users} noDataMessage="No se encontraron usuarios." />

          {/* Security Recommendations */}
          {users && (
            <div className="bg-info/10 mt-6 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="text-info mt-0.5 size-5" />
                <div className="flex-1">
                  <h3 className="text-info font-semibold">Recomendaciones de seguridad</h3>
                  <ul className="text-base-content/70 mt-2 space-y-1 text-sm">
                    <li>
                      • <strong>MFA (Autenticación Multifactor):</strong> Añade una capa extra de
                      seguridad solicitando un código de verificación además de la contraseña.
                    </li>
                    <li>
                      • <strong>Passkey (Biometría):</strong> Permite iniciar sesión de forma segura
                      usando huella digital, reconocimiento facial o clave de dispositivo.
                    </li>
                    <li>
                      • Se recomienda que todos los usuarios activen ambas opciones para máxima
                      seguridad.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

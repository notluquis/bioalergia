import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Shield,
  MoreVertical,
  Key,
  Lock,
  Fingerprint,
  Trash2,
  UserPlus,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import dayjs from "dayjs";
import "dayjs/locale/es";
import relativeTime from "dayjs/plugin/relativeTime";

import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import Input from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/apiClient";
import { getPersonInitials, getPersonFullName } from "@/lib/person";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/Tooltip";
import { PAGE_CONTAINER, TITLE_LG, BADGE_SM } from "@/lib/styles";

dayjs.extend(relativeTime);
dayjs.locale("es");

type User = {
  id: number;
  email: string;
  role: "GOD" | "ADMIN" | "ANALYST" | "VIEWER";
  status: "ACTIVE" | "INACTIVE" | "PENDING_SETUP" | "SUSPENDED";
  createdAt: string;
  hasPasskey: boolean;
  mfaEnabled: boolean;
  person: {
    names: string;
    fatherName: string | null;
    rut: string;
  };
};

export default function UserManagementPage() {
  useAuth();
  const { success, error } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");

  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const payload = await apiClient.get<{ users: User[] }>("/api/users");
      return payload.users || [];
    },
  });

  const deletePasskeyMutation = useMutation({
    mutationFn: async (userId: number) => {
      return apiClient.delete(`/api/users/${userId}/passkey`);
    },
    onSuccess: () => {
      success("Passkey eliminado");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: () => {
      error("Error al eliminar Passkey");
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: number) => {
      return apiClient.post<{ tempPassword: string }>(`/api/users/${userId}/reset-password`, {});
    },
    onSuccess: (data) => {
      success(`Contraseña restablecida. Temporal: ${data.tempPassword}`);
      queryClient.invalidateQueries({ queryKey: ["users"] });
      alert(`Contraseña temporal: ${data.tempPassword}\n\nPor favor compártela con el usuario de forma segura.`);
    },
    onError: (err: Error) => {
      error(err.message || "Error al restablecer contraseña");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: number; status: "ACTIVE" | "SUSPENDED" }) => {
      return apiClient.put(`/api/users/${userId}/status`, { status });
    },
    onSuccess: (_, variables) => {
      success(`Usuario ${variables.status === "ACTIVE" ? "reactivado" : "suspendido"}`);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: Error) => {
      error(err.message || "Error al actualizar estado");
    },
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
      queryClient.invalidateQueries({ queryKey: ["users"] });
      success("Estado MFA actualizado correctamente");
    },
    onError: (err) => {
      error(err instanceof Error ? err.message : "Error desconocido");
    },
  });

  const handleDeletePasskey = (userId: number) => {
    if (confirm("¿Estás seguro de eliminar el Passkey de este usuario?")) {
      deletePasskeyMutation.mutate(userId, {});
    }
  };

  const handleResetPassword = (userId: number) => {
    if (confirm("¿Restablecer contraseña? Esto generará una clave temporal y requerirá configuración nueva.")) {
      resetPasswordMutation.mutate(userId);
    }
  };

  const handleToggleStatus = (userId: number, currentStatus: string) => {
    const newStatus = currentStatus === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
    const action = newStatus === "ACTIVE" ? "reactivar" : "suspender";
    if (confirm(`¿Estás seguro de ${action} a este usuario?`)) {
      updateStatusMutation.mutate({ userId, status: newStatus });
    }
  };

  const handleToggleMfa = (userId: number, currentMfa: boolean) => {
    const action = currentMfa ? "desactivar" : "activar";
    if (confirm(`¿Estás seguro de ${action} MFA para este usuario?`)) {
      toggleMfaMutation.mutate({ userId, enabled: !currentMfa });
    }
  };

  const filteredUsers = users?.filter((user) => {
    const matchesSearch =
      user.email.toLowerCase().includes(search.toLowerCase()) ||
      (user.person?.names?.toLowerCase() ?? "").includes(search.toLowerCase()) ||
      (user.person?.rut ?? "").includes(search);
    const matchesRole = roleFilter === "ALL" || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "badge-success";
      case "PENDING_SETUP":
        return "badge-warning";
      case "SUSPENDED":
        return "badge-error";
      default:
        return "badge-ghost";
    }
  };

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
    <div className={PAGE_CONTAINER}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className={TITLE_LG}>Usuarios y Seguridad</h1>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-info hover:text-info/80 transition-colors">
                    <ShieldCheck size={18} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <div className="space-y-1.5 text-xs">
                    <p className="font-semibold">Recomendaciones de Seguridad</p>
                    <p>
                      <strong>MFA:</strong> Código de verificación adicional.
                    </p>
                    <p>
                      <strong>Passkey:</strong> Huella digital o Face ID.
                    </p>
                    <p className="text-xs opacity-75">Se recomienda activar ambas.</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-base-content/60 text-sm">
            Gestiona el acceso, roles y seguridad de las cuentas del sistema.
          </p>
        </div>
        <Link to="/settings/users/add" className="btn btn-primary gap-2">
          <UserPlus size={20} />
          Agregar Usuario
        </Link>
      </div>

      {/* Security Overview Cards */}
      {users && users.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-full">
                  <UserCog size={24} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{users.length}</p>
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
                  <p className="text-2xl font-bold">{users.filter((u) => u.mfaEnabled).length}</p>
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
                  <p className="text-2xl font-bold">{users.filter((u) => u.hasPasskey).length}</p>
                  <p className="text-base-content/60 text-sm">Con Passkey</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Management Table */}
      <div className="surface-elevated rounded-2xl p-4">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="text-base-content/40 absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              placeholder="Buscar por nombre, email o RUT..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="select select-bordered w-full sm:w-48"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="ALL">Todos los roles</option>
            <option value="ADMIN">Admin</option>
            <option value="ANALYST">Analista</option>
            <option value="VIEWER">Visualizador</option>
          </select>
        </div>

        <div className="min-h-96 overflow-x-auto pb-32">
          <table className="table w-full">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
                <th className="text-center">Seguridad</th>
                <th className="text-center">MFA</th>
                <th className="text-center">Passkey</th>
                <th>Creado</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="text-base-content/60 py-8 text-center">
                    Cargando usuarios...
                  </td>
                </tr>
              ) : filteredUsers?.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-base-content/60 py-8 text-center">
                    No se encontraron usuarios
                  </td>
                </tr>
              ) : (
                filteredUsers?.map((user) => {
                  const securityScore = getSecurityScore(user);
                  const badge = getSecurityBadge(securityScore);
                  const BadgeIcon = badge.icon;

                  return (
                    <tr key={user.id} className="hover:bg-base-200/50">
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="avatar placeholder">
                            <div className="bg-neutral text-neutral-content flex h-10 w-10 items-center justify-center rounded-full">
                              <span className="text-xs font-bold">{getPersonInitials(user.person)}</span>
                            </div>
                          </div>
                          <div>
                            <div className="font-bold">{getPersonFullName(user.person)}</div>
                            <div className="text-xs opacity-50">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          {user.role === "GOD" && <Shield size={14} className="text-warning" />}
                          <span className="badge badge-ghost badge-sm font-medium">{user.role}</span>
                        </div>
                      </td>
                      <td>
                        <div className={cn(BADGE_SM, "gap-2", getStatusColor(user.status))}>
                          {user.status === "ACTIVE" && <div className="size-1.5 rounded-full bg-current" />}
                          {user.status}
                        </div>
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
                          <div className="tooltip" data-tip="Passkey Configurado">
                            <Fingerprint size={16} className="text-success" />
                          </div>
                        ) : (
                          <span className="text-base-content/30 text-xs">-</span>
                        )}
                      </td>
                      <td className="text-base-content/70 text-sm">{dayjs(user.createdAt).format("DD MMM YYYY")}</td>
                      <td>
                        <div className="dropdown dropdown-end">
                          <div tabIndex={0} role="button" className="btn btn-ghost btn-xs">
                            <MoreVertical size={16} />
                          </div>
                          <ul
                            tabIndex={0}
                            className="dropdown-content menu bg-base-100 rounded-box border-base-200 z-50 w-56 border p-2 shadow-lg"
                          >
                            <li>
                              <a onClick={() => handleToggleMfa(user.id, user.mfaEnabled)}>
                                <ShieldCheck size={14} />
                                {user.mfaEnabled ? "Desactivar" : "Activar"} MFA
                              </a>
                            </li>
                            <li>
                              <a onClick={() => handleResetPassword(user.id)}>
                                <Key size={14} />
                                Restablecer contraseña
                              </a>
                            </li>
                            {user.hasPasskey && (
                              <li>
                                <a onClick={() => handleDeletePasskey(user.id)} className="text-warning">
                                  <Trash2 size={14} />
                                  Eliminar Passkey
                                </a>
                              </li>
                            )}
                            {user.status !== "SUSPENDED" ? (
                              <li>
                                <a onClick={() => handleToggleStatus(user.id, user.status)} className="text-error">
                                  <Lock size={14} />
                                  Suspender acceso
                                </a>
                              </li>
                            ) : (
                              <li>
                                <a onClick={() => handleToggleStatus(user.id, user.status)} className="text-success">
                                  <Shield size={14} />
                                  Reactivar acceso
                                </a>
                              </li>
                            )}
                          </ul>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

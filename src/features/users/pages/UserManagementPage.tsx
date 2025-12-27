import {
  fetchUsers,
  toggleUserMfa,
  updateUserRole,
  deleteUserPasskey,
  resetUserPassword,
  updateUserStatus,
  deleteUser,
} from "@/features/users/api";
import { fetchRoles } from "@/features/roles/api";
import type { User } from "@/features/users/types";
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
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils";

import { getPersonInitials, getPersonFullName } from "@/lib/person";

import { PAGE_CONTAINER, TITLE_LG, BADGE_SM } from "@/lib/styles";

dayjs.extend(relativeTime);
dayjs.locale("es");

export default function UserManagementPage() {
  useAuth(); // Keep context mounted
  const { success, error } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState("");

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: string }) => updateUserRole(userId, role),
    onSuccess: () => {
      success("Rol actualizado correctamente");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditingUser(null);
    },
    onError: (err: Error) => {
      error(err.message || "Error al actualizar rol");
    },
  });

  const handleEditRoleClick = (user: User) => {
    setEditingUser(user);
    setSelectedRole(user.role);
  };

  const handleSaveRole = () => {
    if (editingUser) {
      updateRoleMutation.mutate({ userId: editingUser.id, role: selectedRole });
    }
  };

  // Fetch roles for filter
  const { data: roles } = useQuery({
    queryKey: ["roles"],
    queryFn: fetchRoles,
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
  });

  const deletePasskeyMutation = useMutation({
    mutationFn: deleteUserPasskey,
    onSuccess: () => {
      success("Passkey eliminado");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: () => {
      error("Error al eliminar Passkey");
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: resetUserPassword,
    onSuccess: (tempPassword) => {
      success(`Contraseña restablecida. Temporal: ${tempPassword}`);
      queryClient.invalidateQueries({ queryKey: ["users"] });
      alert(`Contraseña temporal: ${tempPassword}\n\nPor favor compártela con el usuario de forma segura.`);
    },
    onError: (err: Error) => {
      error(err.message || "Error al restablecer contraseña");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: number; status: string }) => updateUserStatus(userId, status),
    onSuccess: (_, variables) => {
      success(`Usuario ${variables.status === "ACTIVE" ? "reactivado" : "suspendido"}`);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: Error) => {
      error(err.message || "Error al actualizar estado");
    },
  });

  const toggleMfaMutation = useMutation({
    mutationFn: ({ userId, enabled }: { userId: number; enabled: boolean }) => toggleUserMfa(userId, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      success("Estado MFA actualizado correctamente");
    },
    onError: (err) => {
      error(err instanceof Error ? err.message : "Error desconocido");
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      success("Usuario eliminado correctamente");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: Error) => {
      error(err.message || "Error al eliminar usuario");
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

  const handleDeleteUser = (userId: number) => {
    if (
      confirm("¿Estás seguro de eliminar este usuario? Esta acción no se puede deshacer y borrará sus roles y accesos.")
    ) {
      deleteUserMutation.mutate(userId);
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

    const matchesRole =
      roleFilter === "ALL" ||
      user.role === roleFilter ||
      (user.role || "").toUpperCase() === (roleFilter || "").toUpperCase();

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

  return (
    <div className={PAGE_CONTAINER}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className={TITLE_LG}>Usuarios y seguridad</h1>
          </div>
          <p className="text-base-content/60 text-sm">
            Gestiona el acceso, roles y seguridad de las cuentas del sistema.
          </p>
        </div>
        <Link to="/settings/users/add" className="btn btn-primary gap-2">
          <UserPlus size={20} />
          Agregar usuario
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
                  <p className="text-base-content/60 text-sm">Con passkey</p>
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
            {roles?.map((role) => (
              <option key={role.name} value={role.name}>
                {role.name}
              </option>
            ))}
          </select>
        </div>

        <div className="min-h-96 overflow-x-auto pb-32">
          <table className="table w-full">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
                {/* Security column removed as per request */}
                <th className="w-16 text-center">MFA</th>
                <th className="w-16 text-center">Passkey</th>
                <th>Creado</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-base-content/60 py-8 text-center">
                    Cargando usuarios...
                  </td>
                </tr>
              ) : filteredUsers?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-base-content/60 py-8 text-center">
                    No se encontraron usuarios
                  </td>
                </tr>
              ) : (
                filteredUsers?.map((user) => {
                  return (
                    <tr key={user.id} className="hover:bg-base-200/50">
                      <td className="whitespace-nowrap">
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
                      <td className="whitespace-nowrap">
                        <span className="badge badge-ghost badge-sm font-medium whitespace-nowrap">{user.role}</span>
                      </td>
                      <td className="whitespace-nowrap">
                        <div className={cn(BADGE_SM, "w-fit gap-2 whitespace-nowrap", getStatusColor(user.status))}>
                          {user.status === "ACTIVE" && <div className="size-1.5 rounded-full bg-current" />}
                          {user.status}
                        </div>
                      </td>
                      {/* MFA Icon Only */}
                      <td className="text-center align-middle">
                        <div className="flex justify-center">
                          {user.mfaEnabled ? (
                            <div className="tooltip" data-tip="MFA activado">
                              <ShieldCheck className="text-success size-5" />
                            </div>
                          ) : (
                            <div className="tooltip" data-tip="MFA inactivo">
                              <ShieldCheck className="text-base-content/20 size-5" />
                            </div>
                          )}
                        </div>
                      </td>
                      {/* Passkey Icon Only */}
                      <td className="text-center align-middle">
                        <div className="flex justify-center">
                          {user.hasPasskey ? (
                            <div className="tooltip" data-tip="Passkey configurado">
                              <Fingerprint size={5} className="text-success size-5" />
                            </div>
                          ) : (
                            <div className="tooltip" data-tip="Sin passkey">
                              <Fingerprint className="text-base-content/20 size-5" />
                            </div>
                          )}
                        </div>
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
                              <a onClick={() => handleEditRoleClick(user)}>
                                <UserCog size={14} />
                                Editar rol
                              </a>
                            </li>
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
                                  Eliminar passkey
                                </a>
                              </li>
                            )}
                            {user.status !== "SUSPENDED" ? (
                              <li>
                                <a onClick={() => handleToggleStatus(user.id, user.status)} className="text-warning">
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
                            <li>
                              <a onClick={() => handleDeleteUser(user.id)} className="text-error">
                                <Trash2 size={14} />
                                Eliminar usuario
                              </a>
                            </li>
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

      <Modal
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        title={`Editar Rol: ${editingUser ? getPersonFullName(editingUser.person) : ""}`}
        boxClassName="max-w-md"
      >
        <div className="mt-4 flex flex-col gap-4">
          <p className="text-base-content/70 text-sm">
            Selecciona el nuevo rol para el usuario. Esto actualizará sus permisos inmediatamente.
          </p>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Rol asignado</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
            >
              <option value="" disabled>
                Seleccionar rol
              </option>
              {roles?.map((role) => (
                <option key={role.name} value={role.name}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>

          <div className="modal-action mt-6">
            <Button variant="ghost" onClick={() => setEditingUser(null)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveRole}
              isLoading={updateRoleMutation.isPending}
              disabled={!selectedRole || selectedRole === editingUser?.role}
            >
              Guardar cambios
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

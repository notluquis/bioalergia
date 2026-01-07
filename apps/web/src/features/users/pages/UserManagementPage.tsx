import "dayjs/locale/es";

import { useDeleteUser, useFindManyRole, useFindManyUser, useUpdateUser } from "@finanzas/db/hooks";
import { useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import {
  Fingerprint,
  Key,
  Lock,
  MoreVertical,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  UserCog,
  UserPlus,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import Button from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { deleteUserPasskey, resetUserPassword, toggleUserMfa } from "@/features/users/api";
import type { User } from "@/features/users/types";
import { getPersonFullName, getPersonInitials } from "@/lib/person";
import { BADGE_SM, PAGE_CONTAINER } from "@/lib/styles";
import { cn } from "@/lib/utils";

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

  // ZenStack hooks for users
  const { data: usersData, isLoading } = useFindManyUser({
    include: { person: true },
    orderBy: { createdAt: "desc" },
  });

  // Filter out test/debug emails client-side (ZenStack where has limited support)
  type UserWithPerson = (typeof usersData)[number];
  const users = (usersData ?? [])
    .filter((u: UserWithPerson) => !u.email?.includes("test") && !u.email?.includes("debug"))
    .map((u: UserWithPerson) => ({
      ...u,
      mfaEnabled: u.mfaEnabled ?? false,
      hasPasskey: u.hasPasskey ?? false,
    })) as User[];

  // ZenStack hooks for roles (for filter dropdown)
  const { data: rolesData } = useFindManyRole({
    orderBy: { name: "asc" },
  });
  const roles = rolesData ?? [];

  // ZenStack mutations
  // ZenStack mutations
  const updateUserMutation = useUpdateUser();
  const deleteUserMutation = useDeleteUser();

  const handleEditRoleClick = (user: User) => {
    setEditingUser(user);
    setSelectedRole(user.role);
  };

  const handleSaveRole = async () => {
    if (!editingUser) return;
    try {
      await updateUserMutation.mutateAsync({
        where: { id: editingUser.id },
        data: { role: selectedRole },
      });
      success("Rol actualizado correctamente");
      setEditingUser(null);
    } catch (err) {
      error(err instanceof Error ? err.message : "Error al actualizar rol");
    }
  };

  const handleDeletePasskey = async (userId: number) => {
    if (confirm("¿Estás seguro de eliminar el Passkey de este usuario?")) {
      try {
        await deleteUserPasskey(userId);
        success("Passkey eliminado");
        queryClient.invalidateQueries({ queryKey: ["user"] });
      } catch {
        error("Error al eliminar Passkey");
      }
    }
  };

  const handleResetPassword = async (userId: number) => {
    if (confirm("¿Restablecer contraseña? Esto generará una clave temporal y requerirá configuración nueva.")) {
      try {
        const tempPassword = await resetUserPassword(userId);
        success(`Contraseña restablecida. Temporal: ${tempPassword}`);
        queryClient.invalidateQueries({ queryKey: ["user"] });
        alert(`Contraseña temporal: ${tempPassword}\n\nPor favor compártela con el usuario de forma segura.`);
      } catch (err) {
        error(err instanceof Error ? err.message : "Error al restablecer contraseña");
      }
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (
      confirm("¿Estás seguro de eliminar este usuario? Esta acción no se puede deshacer y borrará sus roles y accesos.")
    ) {
      try {
        await deleteUserMutation.mutateAsync({
          where: { id: userId },
        });
        success("Usuario eliminado correctamente");
      } catch (err) {
        error(err instanceof Error ? err.message : "Error al eliminar usuario");
      }
    }
  };

  const handleToggleStatus = async (userId: number, currentStatus: string) => {
    const newStatus = currentStatus === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
    const action = newStatus === "ACTIVE" ? "reactivar" : "suspender";
    if (confirm(`¿Estás seguro de ${action} a este usuario?`)) {
      try {
        await updateUserMutation.mutateAsync({
          where: { id: userId },
          data: { status: newStatus },
        });
        success(`Usuario ${newStatus === "ACTIVE" ? "reactivado" : "suspendido"}`);
      } catch (err) {
        error(err instanceof Error ? err.message : "Error al actualizar estado");
      }
    }
  };

  const handleToggleMfa = async (userId: number, currentMfa: boolean) => {
    const action = currentMfa ? "desactivar" : "activar";
    if (confirm(`¿Estás seguro de ${action} MFA para este usuario?`)) {
      try {
        await toggleUserMfa(userId, !currentMfa);
        queryClient.invalidateQueries({ queryKey: ["user"] });
        success("Estado MFA actualizado correctamente");
      } catch (err) {
        error(err instanceof Error ? err.message : "Error desconocido");
      }
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
            {roles?.map((role: { name: string }) => (
              <option key={role.name} value={role.name}>
                {role.name}
              </option>
            ))}
          </select>
          <Link to="/settings/users/add" className="btn btn-primary gap-2">
            <UserPlus size={20} />
            Agregar usuario
          </Link>
        </div>

        <div className="min-h-96 overflow-x-auto pb-32">
          <table className="table w-full">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
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
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button type="button" className="btn btn-ghost btn-xs">
                              <MoreVertical size={16} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem onClick={() => handleEditRoleClick(user)}>
                              <UserCog className="mr-2 h-4 w-4" />
                              Editar rol
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleMfa(user.id, user.mfaEnabled)}>
                              <ShieldCheck className="mr-2 h-4 w-4" />
                              {user.mfaEnabled ? "Desactivar" : "Activar"} MFA
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleResetPassword(user.id)}>
                              <Key className="mr-2 h-4 w-4" />
                              Restablecer contraseña
                            </DropdownMenuItem>
                            {user.hasPasskey && (
                              <DropdownMenuItem
                                onClick={() => handleDeletePasskey(user.id)}
                                className="text-warning focus:text-warning"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Eliminar passkey
                              </DropdownMenuItem>
                            )}
                            {user.status !== "SUSPENDED" ? (
                              <DropdownMenuItem
                                onClick={() => handleToggleStatus(user.id, user.status)}
                                className="text-warning focus:text-warning"
                              >
                                <Lock className="mr-2 h-4 w-4" />
                                Suspender acceso
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => handleToggleStatus(user.id, user.status)}
                                className="text-success focus:text-success"
                              >
                                <Shield className="mr-2 h-4 w-4" />
                                Reactivar acceso
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteUser(user.id)}
                              className="text-error focus:text-error"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Eliminar usuario
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
            <label className="label" htmlFor="role-select">
              <span className="label-text">Rol asignado</span>
            </label>
            <select
              id="role-select"
              className="select select-bordered w-full"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
            >
              <option value="" disabled>
                Seleccionar rol
              </option>
              {roles?.map((role: { name: string }) => (
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
              isLoading={updateUserMutation.isPending}
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

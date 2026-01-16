import "dayjs/locale/es";

import {
  useCreateUserRoleAssignment,
  useDeleteManyUserRoleAssignment,
  useDeleteUser,
  useFindManyRole,
  useFindManyUser,
  useUpdateUser,
} from "@finanzas/db/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { Key, Shield, UserCog, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/data-table/DataTable";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { deleteUserPasskey, resetUserPassword, toggleUserMfa } from "@/features/users/api";
import { getColumns } from "@/features/users/components/columns";
import type { User } from "@/features/users/types";
import { getPersonFullName } from "@/lib/person";
import { PAGE_CONTAINER } from "@/lib/styles";

dayjs.extend(relativeTime);
dayjs.locale("es");

export default function UserManagementPage() {
  useAuth(); // Keep context mounted
  const { success, error } = useToast();
  const queryClient = useQueryClient();
  const [roleFilter, setRoleFilter] = useState<string>("ALL");

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState("");

  // ZenStack hooks for users
  const { data: usersData, isLoading } = useFindManyUser({
    include: { person: true },
    orderBy: { createdAt: "desc" },
  });

  // Filter out test/debug emails client-side (ZenStack where has limited support)
  // Transform ZenStack data to frontend User type
  type ZenStackUser = NonNullable<typeof usersData>[number];

  // Memoize users data
  const users: User[] = useMemo(() => {
    return (usersData ?? [])
      .filter((u: ZenStackUser) => !u.email?.includes("test") && !u.email?.includes("debug"))
      .map((u: ZenStackUser) => {
        const raw = u as Record<string, unknown>;
        const passkeys = (raw.passkeys as unknown[] | undefined) ?? [];
        const roles = (raw.roles as Array<{ role?: { name?: string } }> | undefined) ?? [];
        const personData = raw.person as { names?: string; fatherName?: string | null; rut?: string } | undefined;
        return {
          id: u.id,
          email: u.email,
          role: roles[0]?.role?.name ?? "",
          mfaEnabled: u.mfaEnabled ?? false,
          passkeysCount: passkeys.length,
          hasPasskey: passkeys.length > 0,
          status: u.status as User["status"],
          createdAt: (raw.createdAt as Date)?.toISOString() ?? new Date().toISOString(),
          person: {
            names: personData?.names ?? "",
            fatherName: personData?.fatherName ?? null,
            rut: personData?.rut ?? "",
          },
        };
      });
  }, [usersData]);

  // ZenStack hooks for roles (for filter dropdown)
  const { data: rolesData } = useFindManyRole({
    orderBy: { name: "asc" },
  });
  const roles = rolesData ?? [];

  // Mutations
  const updateUserMutation = useUpdateUser();
  const deleteUserMutation = useDeleteUser();
  const createRoleAssignment = useCreateUserRoleAssignment();
  const deleteRoleAssignments = useDeleteManyUserRoleAssignment();

  // Actions Handlers
  const actions = useMemo(
    () => ({
      onEditRole: (user: User) => {
        setEditingUser(user);
        setSelectedRole(user.role);
      },
      onToggleMfa: async (id: number, current: boolean) => {
        const action = current ? "desactivar" : "activar";
        if (confirm(`¿Estás seguro de ${action} MFA para este usuario?`)) {
          try {
            await toggleUserMfa(id, !current);
            queryClient.invalidateQueries({ queryKey: ["user"] });
            success("Estado MFA actualizado correctamente");
          } catch (error_) {
            error(error_ instanceof Error ? error_.message : "Error desconocido");
          }
        }
      },
      onResetPassword: async (id: number) => {
        if (confirm("¿Restablecer contraseña? Esto generará una clave temporal.")) {
          try {
            const tempPassword = await resetUserPassword(id);
            success("Contraseña restablecida");
            queryClient.invalidateQueries({ queryKey: ["user"] });
            alert(`Contraseña temporal: ${tempPassword}`);
          } catch (error_) {
            error(error_ instanceof Error ? error_.message : "Error al restablecer");
          }
        }
      },
      onDeletePasskey: async (id: number) => {
        if (confirm("¿Eliminar Passkey?")) {
          try {
            await deleteUserPasskey(id);
            success("Passkey eliminado");
            queryClient.invalidateQueries({ queryKey: ["user"] });
          } catch {
            error("Error al eliminar Passkey");
          }
        }
      },
      onToggleStatus: async (id: number, currentStatus: string) => {
        const newStatus = currentStatus === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
        const action = newStatus === "ACTIVE" ? "reactivar" : "suspender";
        if (confirm(`¿${action} usuario?`)) {
          try {
            await updateUserMutation.mutateAsync({
              where: { id },
              data: { status: newStatus },
            });
            success(`Usuario ${newStatus === "ACTIVE" ? "reactivado" : "suspendido"}`);
          } catch (error_) {
            error(error_ instanceof Error ? error_.message : "Error al actualizar estado");
          }
        }
      },
      onDeleteUser: async (id: number) => {
        if (confirm("¿Eliminar usuario permanentemente?")) {
          try {
            await deleteUserMutation.mutateAsync({ where: { id } });
            success("Usuario eliminado");
          } catch (error_) {
            error(error_ instanceof Error ? error_.message : "Error al eliminar");
          }
        }
      },
    }),
    [deleteUserMutation, error, queryClient, success, updateUserMutation]
  );

  const columns = useMemo(() => getColumns(actions), [actions]);

  const handleSaveRole = async () => {
    if (!editingUser || !selectedRole) return;

    const selectedRoleObj = roles.find((r) => r.name === selectedRole);
    if (!selectedRoleObj) {
      error("Rol no encontrado");
      return;
    }

    try {
      // First, remove all existing role assignments for the user
      await deleteRoleAssignments.mutateAsync({
        where: { userId: editingUser.id },
      });

      // Then, create the new role assignment
      await createRoleAssignment.mutateAsync({
        data: {
          userId: editingUser.id,
          roleId: selectedRoleObj.id,
        },
      });

      queryClient.invalidateQueries({ queryKey: ["user"] });
      success("Rol actualizado correctamente");
      setEditingUser(null);
    } catch (error_) {
      error(error_ instanceof Error ? error_.message : "Error al actualizar rol");
    }
  };

  // Filter users based on role filter (client side)
  const filteredUsers = useMemo(() => {
    if (roleFilter === "ALL") return users;
    return users.filter((u) => u.role === roleFilter || (u.role || "").toUpperCase() === roleFilter.toUpperCase());
  }, [users, roleFilter]);

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
        <div className="mb-4 flex flex-col items-end justify-between gap-4 sm:flex-row">
          {/* Custom Role Filter */}
          <div className="w-full sm:w-48">
            <label className="label py-0 pb-1" htmlFor="role-filter">
              <span className="label-text-alt">Filtrar por rol</span>
            </label>
            <select
              id="role-filter"
              className="select select-bordered w-full"
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
          </div>

          <Link to="/settings/users/add" className="btn btn-primary gap-2">
            <UserPlus size={20} />
            Agregar usuario
          </Link>
        </div>

        <DataTable columns={columns} data={filteredUsers} isLoading={isLoading} enableToolbar={true} />
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

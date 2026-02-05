import { schema as schemaLite } from "@finanzas/db/schema-lite";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useClientQueries } from "@zenstackhq/tanstack-query/react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { Key, Shield, UserCog, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Select, SelectItem } from "@/components/ui/Select";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { deleteUserPasskey, resetUserPassword, toggleUserMfa } from "@/features/users/api";
import { getColumns } from "@/features/users/components/columns";
import type { User } from "@/features/users/types";
import { getPersonFullName } from "@/lib/person";
import { PAGE_CONTAINER } from "@/lib/styles";

import "dayjs/locale/es";

dayjs.extend(relativeTime);
dayjs.locale("es");

export default function UserManagementPage() {
  const client = useClientQueries(schemaLite);

  const { can } = useAuth(); // Keep context mounted
  const { error, success } = useToast();
  const queryClient = useQueryClient();
  const [roleFilter, setRoleFilter] = useState<string>("ALL");

  const [editingUser, setEditingUser] = useState<null | User>(null);
  const [selectedRole, setSelectedRole] = useState("");

  // ZenStack hooks for users
  const { data: usersData, isLoading } = client.user.useFindMany({
    include: { passkeys: true, person: true, roles: { include: { role: true } } },
    orderBy: { createdAt: "desc" },
  });

  // Use TypeScript inference for raw ZenStack data type
  type RawUser = NonNullable<typeof usersData>[number];

  // Transform to frontend User view model (with computed properties)
  const users: User[] = useMemo(() => {
    if (!usersData) {
      return [];
    }
    return usersData
      .filter((u) => !u.email?.includes("test") && !u.email?.includes("debug"))
      .map(
        (u: RawUser): User => ({
          createdAt: u.createdAt ?? new Date(),
          email: u.email,
          hasPasskey: ((u as { passkeys?: unknown[] }).passkeys ?? []).length > 0,
          id: u.id,
          mfaEnabled: u.mfaEnabled ?? false,
          passkeysCount: ((u as { passkeys?: unknown[] }).passkeys ?? []).length,
          person: {
            fatherName:
              (u as { person?: { fatherName?: null | string } }).person?.fatherName ?? null,
            names: (u as { person?: { names?: string } }).person?.names ?? "",
            rut: (u as { person?: { rut?: string } }).person?.rut ?? "",
          },
          role: (u as { roles?: { role?: { name?: string } }[] }).roles?.[0]?.role?.name ?? "",
          status: u.status as User["status"],
        }),
      );
  }, [usersData]);

  // ZenStack hooks for roles (for filter dropdown)
  const { data: rolesData } = client.role.useFindMany({
    orderBy: { name: "asc" },
  });
  const roles = rolesData ?? [];

  // Mutations
  const updateUserMutation = client.user.useUpdate();
  const deleteUserMutation = client.user.useDelete();
  const createRoleAssignment = client.userRoleAssignment.useCreate();
  const deleteRoleAssignments = client.userRoleAssignment.useDeleteMany();

  // Actions Handlers
  const actions = useMemo(
    () => ({
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
      onEditRole: (user: User) => {
        setEditingUser(user);
        setSelectedRole(user.role);
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
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: interaction logic
      onToggleStatus: async (id: number, currentStatus: string) => {
        const newStatus = currentStatus === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
        const action = newStatus === "ACTIVE" ? "reactivar" : "suspender";
        if (confirm(`¿${action} usuario?`)) {
          try {
            await updateUserMutation.mutateAsync({
              data: { status: newStatus },
              where: { id },
            });
            success(`Usuario ${newStatus === "ACTIVE" ? "reactivado" : "suspendido"}`);
          } catch (error_) {
            error(error_ instanceof Error ? error_.message : "Error al actualizar estado");
          }
        }
      },
    }),
    [deleteUserMutation, error, queryClient, success, updateUserMutation],
  );

  const columns = useMemo(() => getColumns(actions), [actions]);

  const handleSaveRole = async () => {
    if (!editingUser || !selectedRole) {
      return;
    }

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
          roleId: selectedRoleObj.id,
          userId: editingUser.id,
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
    if (roleFilter === "ALL") {
      return users;
    }
    return users.filter(
      (u) => u.role === roleFilter || (u.role || "").toUpperCase() === roleFilter.toUpperCase(),
    );
  }, [users, roleFilter]);

  return (
    <div className={PAGE_CONTAINER}>
      {/* Security Overview Cards */}
      {users.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="card bg-background shadow-sm">
            <div className="card-body">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UserCog size={24} />
                </div>
                <div>
                  <p className="font-bold text-2xl">{users.length}</p>
                  <p className="text-default-500 text-sm">Usuarios totales</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card bg-background shadow-sm">
            <div className="card-body">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
                  <Shield size={24} />
                </div>
                <div>
                  <p className="font-bold text-2xl">{users.filter((u) => u.mfaEnabled).length}</p>
                  <p className="text-default-500 text-sm">Con MFA activo</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card bg-background shadow-sm">
            <div className="card-body">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-info/10 text-info">
                  <Key size={24} />
                </div>
                <div>
                  <p className="font-bold text-2xl">{users.filter((u) => u.hasPasskey).length}</p>
                  <p className="text-default-500 text-sm">Con passkey</p>
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
            <Select
              aria-label="Filtrar por rol"
              className="w-full"
              selectedKey={roleFilter}
              onSelectionChange={(key) => {
                if (key) {
                  setRoleFilter(key.toString());
                }
              }}
            >
              <SelectItem id="ALL" textValue="Todos los roles">
                Todos los roles
              </SelectItem>
              {roles?.map((role: { id: number; name: string }) => (
                <SelectItem id={role.name} key={role.id} textValue={role.name}>
                  {role.name}
                </SelectItem>
              ))}
            </Select>
          </div>

          {can("create", "User") && (
            <Link to="/settings/users/add">
              <Button variant="primary" className="gap-2">
                <UserPlus size={20} />
                Agregar usuario
              </Button>
            </Link>
          )}
        </div>

        <DataTable
          columns={columns}
          data={filteredUsers}
          containerVariant="plain"
          enableGlobalFilter={false}
          enableToolbar={true}
          isLoading={isLoading}
        />
      </div>

      <Modal
        boxClassName="max-w-md"
        isOpen={!!editingUser}
        onClose={() => {
          setEditingUser(null);
        }}
        title={`Editar Rol: ${editingUser ? getPersonFullName(editingUser.person) : ""}`}
      >
        <div className="mt-4 flex flex-col gap-4">
          <p className="text-default-600 text-sm">
            Selecciona el nuevo rol para el usuario. Esto actualizará sus permisos inmediatamente.
          </p>

          <div className="form-control">
            <label className="label" htmlFor="role-select">
              <span className="label-text">Rol asignado</span>
            </label>
            <Select
              aria-label="Rol asignado"
              className="w-full"
              placeholder="Seleccionar rol"
              selectedKey={selectedRole}
              onSelectionChange={(key) => {
                if (key) {
                  setSelectedRole(key.toString());
                }
              }}
            >
              {roles?.map((role: { id: number; name: string }) => (
                <SelectItem id={role.name} key={role.id} textValue={role.name}>
                  {role.name}
                </SelectItem>
              ))}
            </Select>
          </div>

          <div className="modal-action mt-6">
            <Button
              onClick={() => {
                setEditingUser(null);
              }}
              variant="ghost"
            >
              Cancelar
            </Button>
            <Button
              disabled={!selectedRole || selectedRole === editingUser?.role}
              isLoading={updateUserMutation.isPending}
              onClick={handleSaveRole}
              variant="primary"
            >
              Guardar cambios
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

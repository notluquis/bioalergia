import { schema as schemaLite } from "@finanzas/db/schema-lite";
import { Description } from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import { useClientQueries } from "@zenstackhq/tanstack-query/react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { Copy, Key, Shield, UserCog, UserPlus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select, SelectItem } from "@/components/ui/Select";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { deleteUserPasskey, resetUserPassword, toggleUserMfa } from "@/features/users/api";
import { AddUserFormContainer } from "@/features/users/components/AddUserFormContainer";
import { getColumns } from "@/features/users/components/columns";
import type { User } from "@/features/users/types";
import { getPersonFullName } from "@/lib/person";
import { PAGE_CONTAINER } from "@/lib/styles";

import "dayjs/locale/es";

dayjs.extend(relativeTime);
dayjs.locale("es");

type RoleOption = { id: number; name: string };

function mapRawUsers(usersData: unknown[] | undefined): User[] {
  if (!usersData) {
    return [];
  }

  type RawUser = {
    createdAt?: Date | null;
    id: number;
    mfaEnabled?: boolean | null;
    passkeys?: unknown[];
    person?: { email?: null | string; fatherName?: null | string; names?: string; rut?: string };
    roles?: { role?: { name?: string } }[];
    status?: string;
  };

  return usersData
    .filter((u) => {
      const personEmail = (u as RawUser).person?.email ?? "";
      return !personEmail.includes("test") && !personEmail.includes("debug");
    })
    .map(
      (u): User => ({
        createdAt: (u as RawUser).createdAt ?? new Date(),
        email: (u as RawUser).person?.email ?? "",
        hasPasskey: ((u as RawUser).passkeys ?? []).length > 0,
        id: (u as RawUser).id,
        mfaEnabled: (u as RawUser).mfaEnabled ?? false,
        passkeysCount: ((u as RawUser).passkeys ?? []).length,
        person: {
          fatherName: (u as RawUser).person?.fatherName ?? null,
          names: (u as RawUser).person?.names ?? "",
          rut: (u as RawUser).person?.rut ?? "",
        },
        role: (u as RawUser).roles?.[0]?.role?.name ?? "",
        status: ((u as RawUser).status ?? "ACTIVE") as User["status"],
      }),
    );
}

function filterUsersByRole(users: User[], roleFilter: string) {
  if (roleFilter === "ALL") {
    return users;
  }
  return users.filter(
    (u) => u.role === roleFilter || (u.role || "").toUpperCase() === roleFilter.toUpperCase(),
  );
}

function useUserManagementActions(params: {
  assignUserRole: (roleId: number, userId: number) => Promise<unknown>;
  clearUserRoles: (userId: number) => Promise<unknown>;
  deleteUser: (id: number) => Promise<unknown>;
  editingUser: null | User;
  errorToast: (message: string) => void;
  queryClient: ReturnType<typeof useQueryClient>;
  roles: RoleOption[];
  selectedRole: string;
  setEditingUser: (value: null | User) => void;
  setIsResetPasswordOpen: (value: boolean) => void;
  setResetPasswordUser: (value: string) => void;
  setResetPasswordValue: (value: string) => void;
  setSelectedRole: (value: string) => void;
  successToast: (message: string) => void;
  updateUserStatus: (id: number, status: "ACTIVE" | "SUSPENDED") => Promise<unknown>;
  users: User[];
}) {
  const invalidateUsers = useCallback(() => {
    void params.queryClient.invalidateQueries({ queryKey: ["user"] });
  }, [params.queryClient]);

  const handleDeletePasskey = useCallback(
    async (id: number) => {
      if (!confirm("¿Eliminar Passkey?")) {
        return;
      }
      try {
        await deleteUserPasskey(id);
        params.successToast("Passkey eliminado");
        invalidateUsers();
      } catch {
        params.errorToast("Error al eliminar Passkey");
      }
    },
    [invalidateUsers, params],
  );

  const handleDeleteUser = useCallback(
    async (id: number) => {
      if (!confirm("¿Eliminar usuario permanentemente?")) {
        return;
      }
      try {
        await params.deleteUser(id);
        params.successToast("Usuario eliminado");
      } catch (error_) {
        params.errorToast(error_ instanceof Error ? error_.message : "Error al eliminar");
      }
    },
    [params],
  );

  const handleEditRole = useCallback(
    (user: User) => {
      params.setEditingUser(user);
      params.setSelectedRole(user.role);
    },
    [params],
  );

  const handleResetPassword = useCallback(
    async (id: number) => {
      if (!confirm("¿Restablecer contraseña? Esto generará una clave temporal.")) {
        return;
      }
      try {
        const tempPassword = await resetUserPassword(id);
        const target = params.users.find((u) => u.id === id);
        params.successToast("Contraseña restablecida");
        invalidateUsers();
        params.setResetPasswordValue(tempPassword);
        params.setResetPasswordUser(target ? getPersonFullName(target.person) : `Usuario #${id}`);
        params.setIsResetPasswordOpen(true);
      } catch (error_) {
        params.errorToast(error_ instanceof Error ? error_.message : "Error al restablecer");
      }
    },
    [invalidateUsers, params],
  );

  const handleToggleMfa = useCallback(
    async (id: number, current: boolean) => {
      const action = current ? "desactivar" : "activar";
      if (!confirm(`¿Estás seguro de ${action} MFA para este usuario?`)) {
        return;
      }
      try {
        await toggleUserMfa(id, !current);
        invalidateUsers();
        params.successToast("Estado MFA actualizado correctamente");
      } catch (error_) {
        params.errorToast(error_ instanceof Error ? error_.message : "Error desconocido");
      }
    },
    [invalidateUsers, params],
  );

  const handleToggleStatus = useCallback(
    async (id: number, currentStatus: string) => {
      const newStatus = currentStatus === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
      const action = newStatus === "ACTIVE" ? "reactivar" : "suspender";
      if (!confirm(`¿${action} usuario?`)) {
        return;
      }
      try {
        await params.updateUserStatus(id, newStatus as "ACTIVE" | "SUSPENDED");
        params.successToast(`Usuario ${newStatus === "ACTIVE" ? "reactivado" : "suspendido"}`);
      } catch (error_) {
        params.errorToast(error_ instanceof Error ? error_.message : "Error al actualizar estado");
      }
    },
    [params],
  );

  const handleSaveRole = useCallback(async () => {
    if (!params.editingUser || !params.selectedRole) {
      return;
    }

    const selectedRoleObj = params.roles.find((r) => r.name === params.selectedRole);
    if (!selectedRoleObj) {
      params.errorToast("Rol no encontrado");
      return;
    }

    try {
      await params.clearUserRoles(params.editingUser.id);
      await params.assignUserRole(selectedRoleObj.id, params.editingUser.id);

      void params.queryClient.invalidateQueries({ queryKey: ["user"] });
      params.successToast("Rol actualizado correctamente");
      params.setEditingUser(null);
    } catch (error_) {
      params.errorToast(error_ instanceof Error ? error_.message : "Error al actualizar rol");
    }
  }, [params]);

  const actions = useMemo(
    () => ({
      onDeletePasskey: handleDeletePasskey,
      onDeleteUser: handleDeleteUser,
      onEditRole: handleEditRole,
      onResetPassword: handleResetPassword,
      onToggleMfa: handleToggleMfa,
      onToggleStatus: handleToggleStatus,
    }),
    [
      handleDeletePasskey,
      handleDeleteUser,
      handleEditRole,
      handleResetPassword,
      handleToggleMfa,
      handleToggleStatus,
    ],
  );

  return { actions, handleSaveRole };
}

export function UserManagementPage() {
  const client = useClientQueries(schemaLite);

  const { can } = useAuth(); // Keep context mounted
  const { error, success } = useToast();
  const queryClient = useQueryClient();
  const [roleFilter, setRoleFilter] = useState<string>("ALL");

  const [editingUser, setEditingUser] = useState<null | User>(null);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetPasswordUser, setResetPasswordUser] = useState("");
  const [selectedRole, setSelectedRole] = useState("");

  // ZenStack hooks for users
  const { data: usersData, isLoading } = client.user.useFindMany({
    include: { passkeys: true, person: true, roles: { include: { role: true } } },
    orderBy: { createdAt: "desc" },
  });

  // Transform to frontend User view model (with computed properties)
  const users: User[] = useMemo(() => mapRawUsers(usersData), [usersData]);

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

  const deleteUser = useCallback(
    (id: number) => deleteUserMutation.mutateAsync({ where: { id } }),
    [deleteUserMutation],
  );
  const clearUserRoles = useCallback(
    (userId: number) => deleteRoleAssignments.mutateAsync({ where: { userId } }),
    [deleteRoleAssignments],
  );
  const assignUserRole = useCallback(
    (roleId: number, userId: number) =>
      createRoleAssignment.mutateAsync({ data: { roleId, userId } }),
    [createRoleAssignment],
  );
  const updateUserStatus = useCallback(
    (id: number, status: "ACTIVE" | "SUSPENDED") =>
      updateUserMutation.mutateAsync({
        data: { status },
        where: { id },
      }),
    [updateUserMutation],
  );

  const { actions, handleSaveRole } = useUserManagementActions({
    assignUserRole,
    clearUserRoles,
    deleteUser,
    editingUser,
    errorToast: error,
    queryClient,
    roles,
    selectedRole,
    setEditingUser,
    setIsResetPasswordOpen,
    setResetPasswordUser,
    setResetPasswordValue,
    setSelectedRole,
    successToast: success,
    updateUserStatus,
    users,
  });

  const columns = useMemo(() => getColumns(actions), [actions]);

  // Filter users based on role filter (client side)
  const filteredUsers = useMemo(() => filterUsersByRole(users, roleFilter), [users, roleFilter]);

  return (
    <div className={PAGE_CONTAINER}>
      {users.length > 0 && <UserSecurityOverview users={users} />}

      {/* User Management Table */}
      <div className="surface-elevated rounded-2xl p-4">
        <div className="mb-4 flex flex-col items-end justify-between gap-4 sm:flex-row">
          {/* Custom Role Filter */}
          <div className="w-full sm:w-48">
            <Select
              aria-label="Filtrar por rol"
              className="w-full"
              label="Filtrar por rol"
              value={roleFilter}
              onChange={(key) => {
                if (key) {
                  setRoleFilter(key.toString());
                }
              }}
            >
              <SelectItem id="ALL" textValue="Todos los roles">
                Todos los roles
              </SelectItem>
              {roles?.map((role: RoleOption) => (
                <SelectItem id={role.name} key={role.id} textValue={role.name}>
                  {role.name}
                </SelectItem>
              ))}
            </Select>
          </div>

          {can("create", "User") && (
            <Button
              variant="primary"
              className="gap-2"
              onClick={() => {
                setIsCreateUserOpen(true);
              }}
            >
              <UserPlus size={20} />
              Agregar usuario
            </Button>
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
        boxClassName="max-w-4xl"
        isOpen={isCreateUserOpen}
        onClose={() => {
          setIsCreateUserOpen(false);
        }}
        title="Agregar usuario"
      >
        <AddUserFormContainer
          showPageHeader={false}
          onCancel={() => {
            setIsCreateUserOpen(false);
          }}
          onCreated={() => {
            setIsCreateUserOpen(false);
          }}
        />
      </Modal>

      <EditRoleModalContent
        editingUser={editingUser}
        isSaving={updateUserMutation.isPending}
        onCancel={() => {
          setEditingUser(null);
        }}
        onSave={handleSaveRole}
        roles={roles}
        selectedRole={selectedRole}
        setSelectedRole={setSelectedRole}
      />

      <ResetPasswordModalContent
        isOpen={isResetPasswordOpen}
        onClose={() => {
          setIsResetPasswordOpen(false);
        }}
        password={resetPasswordValue}
        userLabel={resetPasswordUser}
        onCopy={async () => {
          try {
            await navigator.clipboard.writeText(resetPasswordValue);
            success("Contraseña copiada al portapapeles");
          } catch {
            error("No se pudo copiar automáticamente. Copia manualmente la clave.");
          }
        }}
      />
    </div>
  );
}

function UserSecurityOverview({ users }: { users: User[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="card bg-background shadow-sm">
        <div className="card-body">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserCog size={24} />
            </div>
            <div>
              <span className="block font-bold text-2xl">{users.length}</span>
              <Description className="text-default-500 text-sm">Usuarios totales</Description>
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
              <span className="block font-bold text-2xl">
                {users.filter((u) => u.mfaEnabled).length}
              </span>
              <Description className="text-default-500 text-sm">Con MFA activo</Description>
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
              <span className="block font-bold text-2xl">
                {users.filter((u) => u.hasPasskey).length}
              </span>
              <Description className="text-default-500 text-sm">Con passkey</Description>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditRoleModalContent({
  editingUser,
  isSaving,
  onCancel,
  onSave,
  roles,
  selectedRole,
  setSelectedRole,
}: {
  editingUser: null | User;
  isSaving: boolean;
  onCancel: () => void;
  onSave: () => void;
  roles: RoleOption[];
  selectedRole: string;
  setSelectedRole: (value: string) => void;
}) {
  return (
    <Modal
      boxClassName="max-w-md"
      isOpen={Boolean(editingUser)}
      onClose={onCancel}
      title={`Editar Rol: ${editingUser ? getPersonFullName(editingUser.person) : ""}`}
    >
      <div className="mt-4 flex flex-col gap-4">
        <Description className="text-default-600 text-sm">
          Selecciona el nuevo rol para el usuario. Esto actualizará sus permisos inmediatamente.
        </Description>

        <div className="form-control">
          <Select
            aria-label="Rol asignado"
            className="w-full"
            label="Rol asignado"
            placeholder="Seleccionar rol"
            value={selectedRole}
            onChange={(key) => {
              if (key) {
                setSelectedRole(key.toString());
              }
            }}
          >
            {roles.map((role) => (
              <SelectItem id={role.name} key={role.id} textValue={role.name}>
                {role.name}
              </SelectItem>
            ))}
          </Select>
        </div>

        <div className="modal-action mt-6">
          <Button onClick={onCancel} variant="ghost">
            Cancelar
          </Button>
          <Button
            disabled={!selectedRole || selectedRole === editingUser?.role}
            isLoading={isSaving}
            onClick={onSave}
            variant="primary"
          >
            Guardar cambios
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ResetPasswordModalContent({
  isOpen,
  onClose,
  onCopy,
  password,
  userLabel,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCopy: () => Promise<void>;
  password: string;
  userLabel: string;
}) {
  return (
    <Modal
      boxClassName="max-w-md"
      isOpen={isOpen}
      onClose={onClose}
      title="Contraseña temporal generada"
    >
      <div className="flex flex-col gap-4">
        <Description className="text-default-600 text-sm">
          Guarda esta contraseña para <strong>{userLabel}</strong>. Se mostrará una sola vez.
        </Description>

        <div className="rounded-xl border border-default-200 bg-default-50 p-3">
          <code className="break-all font-mono text-sm">{password}</code>
        </div>

        <div className="flex justify-end gap-2">
          <Button onClick={() => void onCopy()} startContent={<Copy size={16} />} variant="ghost">
            Copiar
          </Button>
          <Button onClick={onClose} variant="primary">
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

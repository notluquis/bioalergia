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

  // Use TypeScript inference for raw ZenStack data type
  type RawUser = NonNullable<typeof usersData>[number];

  // Transform to frontend User view model (with computed properties)
  const users: User[] = useMemo(() => {
    if (!usersData) {
      return [];
    }
    return usersData
      .filter((u) => {
        const personEmail = (u as { person?: { email?: null | string } }).person?.email ?? "";
        return !personEmail.includes("test") && !personEmail.includes("debug");
      })
      .map(
        (u: RawUser): User => ({
          createdAt: u.createdAt ?? new Date(),
          email: (u as { person?: { email?: null | string } }).person?.email ?? "",
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

  const invalidateUsers = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["user"] });
  }, [queryClient]);

  const handleDeletePasskey = useCallback(
    async (id: number) => {
      if (!confirm("¿Eliminar Passkey?")) {
        return;
      }
      try {
        await deleteUserPasskey(id);
        success("Passkey eliminado");
        invalidateUsers();
      } catch {
        error("Error al eliminar Passkey");
      }
    },
    [error, invalidateUsers, success],
  );

  const handleDeleteUser = useCallback(
    async (id: number) => {
      if (!confirm("¿Eliminar usuario permanentemente?")) {
        return;
      }
      try {
        await deleteUserMutation.mutateAsync({ where: { id } });
        success("Usuario eliminado");
      } catch (error_) {
        error(error_ instanceof Error ? error_.message : "Error al eliminar");
      }
    },
    [deleteUserMutation, error, success],
  );

  const handleEditRole = useCallback((user: User) => {
    setEditingUser(user);
    setSelectedRole(user.role);
  }, []);

  const handleResetPassword = useCallback(
    async (id: number) => {
      if (!confirm("¿Restablecer contraseña? Esto generará una clave temporal.")) {
        return;
      }
      try {
        const tempPassword = await resetUserPassword(id);
        const target = users.find((u) => u.id === id);
        success("Contraseña restablecida");
        invalidateUsers();
        setResetPasswordValue(tempPassword);
        setResetPasswordUser(target ? getPersonFullName(target.person) : `Usuario #${id}`);
        setIsResetPasswordOpen(true);
      } catch (error_) {
        error(error_ instanceof Error ? error_.message : "Error al restablecer");
      }
    },
    [error, invalidateUsers, success, users],
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
        success("Estado MFA actualizado correctamente");
      } catch (error_) {
        error(error_ instanceof Error ? error_.message : "Error desconocido");
      }
    },
    [error, invalidateUsers, success],
  );

  const handleToggleStatus = useCallback(
    async (id: number, currentStatus: string) => {
      const newStatus = currentStatus === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
      const action = newStatus === "ACTIVE" ? "reactivar" : "suspender";
      if (!confirm(`¿${action} usuario?`)) {
        return;
      }
      try {
        await updateUserMutation.mutateAsync({
          data: { status: newStatus },
          where: { id },
        });
        success(`Usuario ${newStatus === "ACTIVE" ? "reactivado" : "suspendido"}`);
      } catch (error_) {
        error(error_ instanceof Error ? error_.message : "Error al actualizar estado");
      }
    },
    [error, success, updateUserMutation],
  );

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

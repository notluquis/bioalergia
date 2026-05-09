import {
  Button,
  Card,
  Description,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Switch,
  TextField,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { Copy, Key, Shield, UserCog, UserPlus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { useAuth } from "@/context/AuthContext";
import { useConfirmDialog } from "@/context/ConfirmDialogContext";
import { useToast } from "@/context/ToastContext";
import { fetchRoles } from "@/features/roles/api";
import {
  deleteUser,
  deleteUserPasskey,
  fetchUsers,
  resetUserPassword,
  toggleUserMfa,
  updateUserProfile,
  updateUserRole,
  updateUserStatus as updateUserStatusApi,
} from "@/features/users/api";
import { AddUserFormContainer } from "@/features/users/components/AddUserFormContainer";
import { getColumns } from "@/features/users/components/columns";
import type { User } from "@/features/users/types";
import { getPersonFullName } from "@/lib/person";
import { PAGE_CONTAINER } from "@/lib/styles";

import "dayjs/locale/es";

dayjs.extend(relativeTime);
dayjs.locale("es");

type RoleOption = { id: number; name: string };
type UserDetailsFormState = {
  bankAccountNumber: string;
  bankAccountType: string;
  bankName: string;
  department: string;
  loginEmail: string;
  notificationEmail: string;
  fatherName: string;
  mfaEnforced: boolean;
  motherName: string;
  names: string;
  phone: string;
  position: string;
  rut: string;
};

function filterUsersByRole(users: User[], roleFilter: string) {
  if (roleFilter === "ALL") {
    return users;
  }
  return users.filter(
    (u) => u.role === roleFilter || (u.role || "").toUpperCase() === roleFilter.toUpperCase()
  );
}

function useUserManagementActions(params: {
  confirmAction: ReturnType<typeof useConfirmDialog>;
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
  updateUserRole: (id: number, role: string) => Promise<unknown>;
  updateUserStatus: (
    id: number,
    status: "ACTIVE" | "PENDING_SETUP" | "SUSPENDED"
  ) => Promise<unknown>;
  users: User[];
}) {
  const invalidateUsers = useCallback(() => {
    void params.queryClient.invalidateQueries({ queryKey: ["users"] });
    void params.queryClient.invalidateQueries({ queryKey: ["user"] });
  }, [params.queryClient]);

  const handleDeletePasskey = useCallback(
    async (id: number) => {
      const confirmed = await params.confirmAction({
        confirmLabel: "Eliminar passkey",
        confirmVariant: "danger",
        description:
          "La passkey del usuario se eliminará y dejará de estar disponible para acceso.",
        isDismissable: true,
        isKeyboardDismissDisabled: false,
        status: "danger",
        title: "Eliminar passkey",
      });
      if (!confirmed) {
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
    [invalidateUsers, params]
  );

  const handleDeleteUser = useCallback(
    async (id: number) => {
      const confirmed = await params.confirmAction({
        confirmLabel: "Eliminar usuario",
        confirmVariant: "danger",
        description: "El usuario se eliminará permanentemente. Esta acción no se puede deshacer.",
        isDismissable: true,
        isKeyboardDismissDisabled: false,
        status: "danger",
        title: "Eliminar usuario",
      });
      if (!confirmed) {
        return;
      }
      try {
        await params.deleteUser(id);
        params.successToast("Usuario eliminado");
      } catch (error_) {
        params.errorToast(error_ instanceof Error ? error_.message : "Error al eliminar");
      }
    },
    [params]
  );

  const handleEditRole = useCallback(
    (user: User) => {
      params.setEditingUser(user);
      params.setSelectedRole(user.role);
    },
    [params]
  );

  const handleResetPassword = useCallback(
    async (id: number) => {
      const confirmed = await params.confirmAction({
        confirmLabel: "Restablecer contraseña",
        description: "Esto generará una clave temporal para el usuario seleccionado.",
        isDismissable: true,
        isKeyboardDismissDisabled: false,
        title: "Restablecer contraseña",
      });
      if (!confirmed) {
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
    [invalidateUsers, params]
  );

  const handleToggleMfa = useCallback(
    async (id: number, current: boolean) => {
      const action = current ? "desactivar" : "activar";
      const confirmed = await params.confirmAction({
        confirmLabel: current ? "Desactivar MFA" : "Activar MFA",
        description: `¿Estás seguro de ${action} MFA para este usuario?`,
        isDismissable: true,
        isKeyboardDismissDisabled: false,
        title: `${current ? "Desactivar" : "Activar"} MFA`,
      });
      if (!confirmed) {
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
    [invalidateUsers, params]
  );

  const handleSetStatus = useCallback(
    async (id: number, nextStatus: "ACTIVE" | "PENDING_SETUP" | "SUSPENDED") => {
      const prompts: Record<typeof nextStatus, string> = {
        ACTIVE: "¿Activar cuenta?",
        PENDING_SETUP:
          "¿Enviar a onboarding? Esto cerrará sesiones, eliminará passkeys y desactivará MFA.",
        SUSPENDED: "¿Suspender acceso?",
      };

      const confirmed = await params.confirmAction({
        confirmLabel:
          nextStatus === "ACTIVE"
            ? "Activar"
            : nextStatus === "PENDING_SETUP"
              ? "Enviar a onboarding"
              : "Suspender",
        description: prompts[nextStatus],
        isDismissable: true,
        isKeyboardDismissDisabled: false,
        title: "Confirmar cambio de estado",
      });
      if (!confirmed) {
        return;
      }

      try {
        await params.updateUserStatus(id, nextStatus);
        const successByStatus: Record<typeof nextStatus, string> = {
          ACTIVE: "Usuario activado",
          PENDING_SETUP: "Usuario enviado a onboarding",
          SUSPENDED: "Usuario suspendido",
        };
        params.successToast(successByStatus[nextStatus]);
      } catch (error_) {
        params.errorToast(error_ instanceof Error ? error_.message : "Error al actualizar estado");
      }
    },
    [params]
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
      await params.updateUserRole(params.editingUser.id, selectedRoleObj.name);

      void params.queryClient.invalidateQueries({ queryKey: ["users"] });
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
      onSetStatus: handleSetStatus,
      onToggleMfa: handleToggleMfa,
    }),
    [
      handleDeletePasskey,
      handleDeleteUser,
      handleEditRole,
      handleResetPassword,
      handleSetStatus,
      handleToggleMfa,
    ]
  );

  return { actions, handleSaveRole };
}

export function UserManagementPage() {
  const { can } = useAuth(); // Keep context mounted
  const { error, success } = useToast();
  const confirm = useConfirmDialog();
  const queryClient = useQueryClient();
  const [roleFilter, setRoleFilter] = useState<string>("ALL");

  const [editingUser, setEditingUser] = useState<null | User>(null);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [editingDetailsUser, setEditingDetailsUser] = useState<null | User>(null);
  const [detailsForm, setDetailsForm] = useState<null | UserDetailsFormState>(null);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetPasswordUser, setResetPasswordUser] = useState("");
  const [selectedRole, setSelectedRole] = useState("");

  const { data: usersData, isLoading } = useQuery({
    queryFn: fetchUsers,
    queryKey: ["users"],
  });
  const users = useMemo(() => usersData ?? [], [usersData]);

  const { data: rolesData } = useQuery({
    queryFn: fetchRoles,
    queryKey: ["roles"],
  });
  const roles = rolesData ?? [];

  // Mutations
  const updateUserProfileMutation = useMutation({
    mutationFn: async ({ payload, userId }: { payload: UserDetailsFormState; userId: number }) =>
      updateUserProfile(userId, {
        bankAccountNumber: toNullableField(payload.bankAccountNumber),
        bankAccountType: toNullableField(payload.bankAccountType),
        bankName: toNullableField(payload.bankName),
        department: toNullableField(payload.department),
        loginEmail: toNullableField(payload.loginEmail),
        notificationEmail: payload.notificationEmail.trim(),
        fatherName: toNullableField(payload.fatherName),
        mfaEnforced: payload.mfaEnforced,
        motherName: toNullableField(payload.motherName),
        names: payload.names.trim(),
        phone: toNullableField(payload.phone),
        position: payload.position.trim(),
        rut: payload.rut.trim(),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      void queryClient.invalidateQueries({ queryKey: ["user"] });
      success("Datos de usuario actualizados");
    },
  });
  const updateUserStatusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: number;
      status: "ACTIVE" | "PENDING_SETUP" | "SUSPENDED";
    }) => updateUserStatusApi(id, status),
  });
  const deleteUserAction = useCallback((id: number) => deleteUser(id), []);
  const updateUserRoleAction = useCallback(
    (id: number, role: string) => updateUserRole(id, role),
    []
  );
  const updateUserStatus = useCallback(
    (id: number, status: "ACTIVE" | "PENDING_SETUP" | "SUSPENDED") =>
      updateUserStatusMutation.mutateAsync({
        id,
        status,
      }),
    [updateUserStatusMutation]
  );

  const { actions, handleSaveRole } = useUserManagementActions({
    confirmAction: confirm,
    deleteUser: deleteUserAction,
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
    updateUserRole: updateUserRoleAction,
    updateUserStatus,
    users,
  });

  const handleEditDetails = useCallback((user: User) => {
    setEditingDetailsUser(user);
    setDetailsForm(createDetailsFormState(user));
  }, []);

  const columns = useMemo(
    () =>
      getColumns({
        ...actions,
        onEditDetails: handleEditDetails,
      }),
    [actions, handleEditDetails]
  );

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
              className="w-full"
              value={roleFilter}
              onChange={(key) => {
                if (key) {
                  setRoleFilter(key.toString());
                }
              }}
            >
              <Label>Filtrar por rol</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="ALL" textValue="Todos los roles">
                    Todos los roles
                  </ListBox.Item>
                  {roles?.map((role: RoleOption) => (
                    <ListBox.Item id={role.name} key={role.id} textValue={role.name}>
                      {role.name}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>

          {can("create", "User") && (
            <Button
              variant="primary"
              className="gap-2"
              onPress={() => {
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
          scrollMaxHeight="min(68dvh, 760px)"
        />
      </div>

      <Modal>
        <Modal.Backdrop
          className="bg-black/40 backdrop-blur-[2px]"
          isOpen={isCreateUserOpen}
          onOpenChange={(open) => {
            if (!open) {
              setIsCreateUserOpen(false);
            }
          }}
        >
          <Modal.Container placement="center">
            <Modal.Dialog className="relative w-full max-w-2xl rounded-[28px] bg-background p-6 shadow-2xl">
              <Modal.Header className="mb-4 font-bold text-primary text-xl">
                <Modal.Heading>Agregar usuario</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="mt-2 max-h-[80vh] overflow-y-auto overscroll-contain text-foreground">
                <AddUserFormContainer
                  showPageHeader={false}
                  onCancel={() => {
                    setIsCreateUserOpen(false);
                  }}
                  onCreated={() => {
                    void queryClient.invalidateQueries({ queryKey: ["users"] });
                    setIsCreateUserOpen(false);
                  }}
                />
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <EditRoleModalContent
        editingUser={editingUser}
        isSaving={updateUserStatusMutation.isPending}
        onCancel={() => {
          setEditingUser(null);
        }}
        onSave={handleSaveRole}
        roles={roles}
        selectedRole={selectedRole}
        setSelectedRole={setSelectedRole}
      />

      <EditUserDetailsModalContent
        form={detailsForm}
        isOpen={Boolean(editingDetailsUser)}
        isSaving={updateUserProfileMutation.isPending}
        onCancel={() => {
          setEditingDetailsUser(null);
          setDetailsForm(null);
        }}
        onChange={(field, value) => {
          setDetailsForm((prev) => (prev ? { ...prev, [field]: value } : prev));
        }}
        onSave={async () => {
          if (!editingDetailsUser || !detailsForm) {
            return;
          }
          try {
            await updateUserProfileMutation.mutateAsync({
              payload: detailsForm,
              userId: editingDetailsUser.id,
            });
            setEditingDetailsUser(null);
            setDetailsForm(null);
          } catch (error_) {
            error(error_ instanceof Error ? error_.message : "No se pudo actualizar el usuario");
          }
        }}
        title={editingDetailsUser ? getPersonFullName(editingDetailsUser.person) : ""}
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

function toNullableField(value: string): null | string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function createDetailsFormState(user: User): UserDetailsFormState {
  return {
    bankAccountNumber: user.employee?.bankAccountNumber ?? "",
    bankAccountType: user.employee?.bankAccountType ?? "",
    bankName: user.employee?.bankName ?? "",
    department: user.employee?.department ?? "",
    loginEmail: user.loginEmail ?? user.email ?? "",
    notificationEmail: user.notificationEmail ?? user.email ?? "",
    fatherName: user.person.fatherName ?? "",
    mfaEnforced: user.mfaEnforced ?? true,
    motherName: user.person.motherName ?? "",
    names: user.person.names ?? "",
    phone: user.person.phone ?? "",
    position: user.employee?.position ?? "",
    rut: user.person.rut ?? "",
  };
}

function UserSecurityOverview({ users }: { users: User[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="shadow-sm">
        <Card.Content className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserCog size={24} />
            </div>
            <div>
              <span className="block font-bold text-2xl">{users.length}</span>
              <Description className="text-default-500 text-sm">Usuarios totales</Description>
            </div>
          </div>
        </Card.Content>
      </Card>

      <Card className="shadow-sm">
        <Card.Content className="p-5">
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
        </Card.Content>
      </Card>

      <Card className="shadow-sm">
        <Card.Content className="p-5">
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
        </Card.Content>
      </Card>
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
    <Modal>
      <Modal.Backdrop
        className="bg-black/40 backdrop-blur-[2px]"
        isOpen={Boolean(editingUser)}
        onOpenChange={(open) => {
          if (!open) {
            onCancel();
          }
        }}
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-2xl rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4 font-bold text-primary text-xl">
              <Modal.Heading>{`Editar Rol: ${editingUser ? getPersonFullName(editingUser.person) : ""}`}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="mt-2 max-h-[80vh] overflow-y-auto overscroll-contain text-foreground">
              <div className="mt-4 flex flex-col gap-4">
                <Description className="text-default-600 text-sm">
                  Selecciona el nuevo rol para el usuario. Esto actualizará sus permisos
                  inmediatamente.
                </Description>

                <div className="w-full">
                  <Select
                    className="w-full"
                    placeholder="Seleccionar rol"
                    value={selectedRole}
                    onChange={(key) => {
                      if (key) {
                        setSelectedRole(key.toString());
                      }
                    }}
                  >
                    <Label>Rol asignado</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {roles.map((role) => (
                          <ListBox.Item id={role.name} key={role.id} textValue={role.name}>
                            {role.name}
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <Button onPress={onCancel} variant="outline">
                    Cancelar
                  </Button>
                  <Button
                    isDisabled={!selectedRole || selectedRole === editingUser?.role}
                    isPending={isSaving}
                    onPress={onSave}
                    variant="primary"
                  >
                    Guardar cambios
                  </Button>
                </div>
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function EditUserDetailsModalContent({
  form,
  isOpen,
  isSaving,
  onCancel,
  onChange,
  onSave,
  title,
}: {
  form: null | UserDetailsFormState;
  isOpen: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onChange: <K extends keyof UserDetailsFormState>(
    field: K,
    value: UserDetailsFormState[K]
  ) => void;
  onSave: () => Promise<void>;
  title: string;
}) {
  return (
    <Modal>
      <Modal.Backdrop
        className="bg-black/40 backdrop-blur-[2px]"
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            onCancel();
          }
        }}
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-2xl rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4 font-bold text-primary text-xl">
              <Modal.Heading>{`Editar usuario: ${title}`}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="mt-2 max-h-[80vh] overflow-y-auto overscroll-contain text-foreground">
              {form && (
                <div className="grid gap-4 md:grid-cols-2">
                  <TextField value={form.names} onChange={(v) => onChange("names", v)}>
                    <Label>Nombres</Label>
                    <Input />
                  </TextField>
                  <TextField value={form.fatherName} onChange={(v) => onChange("fatherName", v)}>
                    <Label>Primer apellido</Label>
                    <Input />
                  </TextField>
                  <TextField value={form.motherName} onChange={(v) => onChange("motherName", v)}>
                    <Label>Segundo apellido</Label>
                    <Input />
                  </TextField>
                  <TextField value={form.rut} onChange={(v) => onChange("rut", v)}>
                    <Label>RUT</Label>
                    <Input />
                  </TextField>
                  <TextField
                    type="email"
                    value={form.notificationEmail}
                    onChange={(v) => onChange("notificationEmail", v)}
                  >
                    <Label>Correo de notificación</Label>
                    <Input />
                  </TextField>
                  <TextField
                    type="email"
                    value={form.loginEmail}
                    onChange={(v) => onChange("loginEmail", v)}
                  >
                    <Label>Correo de login</Label>
                    <Input />
                    <Description className="text-xs">
                      Si lo dejas igual al de notificación, se usa ese por defecto para login.
                    </Description>
                  </TextField>
                  <TextField value={form.phone} onChange={(v) => onChange("phone", v)}>
                    <Label>Teléfono</Label>
                    <Input />
                  </TextField>
                  <TextField value={form.position} onChange={(v) => onChange("position", v)}>
                    <Label>Cargo</Label>
                    <Input />
                  </TextField>
                  <TextField value={form.department} onChange={(v) => onChange("department", v)}>
                    <Label>Departamento</Label>
                    <Input />
                  </TextField>
                  <TextField value={form.bankName} onChange={(v) => onChange("bankName", v)}>
                    <Label>Banco</Label>
                    <Input />
                  </TextField>
                  <TextField
                    value={form.bankAccountType}
                    onChange={(v) => onChange("bankAccountType", v)}
                  >
                    <Label>Tipo de cuenta</Label>
                    <Input />
                  </TextField>
                  <div className="md:col-span-2">
                    <TextField
                      value={form.bankAccountNumber}
                      onChange={(v) => onChange("bankAccountNumber", v)}
                    >
                      <Label>Número de cuenta</Label>
                      <Input />
                    </TextField>
                  </div>
                  <div className="md:col-span-2">
                    <Switch
                      isSelected={form.mfaEnforced}
                      onChange={(value) => {
                        onChange("mfaEnforced", value);
                      }}
                    >
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                      <Switch.Content>Forzar MFA/Passkey al iniciar sesión</Switch.Content>
                    </Switch>
                  </div>
                </div>
              )}
              <div className="mt-6 flex justify-end gap-2">
                <Button onPress={onCancel} variant="outline">
                  Cancelar
                </Button>
                <Button
                  isDisabled={
                    !form?.names.trim() || !form?.notificationEmail.trim() || !form?.position.trim()
                  }
                  isPending={isSaving}
                  onPress={() => void onSave()}
                  variant="primary"
                >
                  Guardar cambios
                </Button>
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
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
    <Modal>
      <Modal.Backdrop
        className="bg-black/40 backdrop-blur-[2px]"
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            onClose();
          }
        }}
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-2xl rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4 font-bold text-primary text-xl">
              <Modal.Heading>Contraseña temporal generada</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="mt-2 max-h-[80vh] overflow-y-auto overscroll-contain text-foreground">
              <div className="flex flex-col gap-4">
                <Description className="text-default-600 text-sm">
                  Guarda esta contraseña para <strong>{userLabel}</strong>. Se mostrará una sola
                  vez.
                </Description>

                <div className="rounded-xl border border-default-200 bg-default-50 p-3">
                  <code className="break-all font-mono text-sm">{password}</code>
                </div>

                <div className="flex justify-end gap-2">
                  <Button onPress={() => void onCopy()} variant="outline">
                    <Copy size={16} />
                    Copiar
                  </Button>
                  <Button onPress={onClose} variant="primary">
                    Cerrar
                  </Button>
                </div>
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

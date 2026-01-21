import {
  Button,
  FieldError,
  Input,
  Label,
  Modal,
  Spinner,
  TextArea,
  TextField,
} from "@heroui/react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { AlertCircle, User as UserIcon } from "lucide-react";
import { Suspense } from "react";
import { z } from "zod";

import { useToast } from "@/context/ToastContext";
import { createRole, type RoleUser, roleKeys, roleQueries, updateRole } from "@/features/roles/api";
import type { Role } from "@/types/roles";

interface RoleFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  role?: null | Role; // If present, Edit mode. If null, Create mode.
}

const formSchema = z.object({
  description: z.string().max(255, "La descripción no puede exceder los 255 caracteres").optional(),
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(50, "El nombre no puede exceder los 50 caracteres"),
});

interface RoleBaseFormProps {
  onClose: () => void;
  roleEntity: null | Role;
  userData: RoleUser[];
}

type RoleFormData = z.infer<typeof formSchema>;

export function RoleFormModal({ isOpen, onClose, role }: RoleFormModalProps) {
  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop />
      <Modal.Container placement="center">
        <Modal.Dialog>
          <Modal.Header>
            <h3 className="text-lg font-bold">{role ? "Editar Rol" : "Nuevo Rol"}</h3>
          </Modal.Header>
          <Modal.Body className="pb-6">
            {role ? (
              <Suspense
                fallback={
                  <div className="flex h-64 items-center justify-center">
                    <Spinner className="text-primary" />
                  </div>
                }
              >
                <RoleEditForm onClose={onClose} roleEntity={role} />
              </Suspense>
            ) : (
              <RoleBaseForm onClose={onClose} roleEntity={null} userData={[]} />
            )}
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal>
  );
}

function RoleBaseForm({ onClose, roleEntity, userData }: RoleBaseFormProps) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data: RoleFormData) => {
      const payload = {
        description: data.description || "",
        name: data.name,
      };
      await (roleEntity ? updateRole(roleEntity.id, payload) : createRole(payload));
    },
    onError: (err: Error) => {
      let message = err.message || "Ocurrió un error al guardar el rol.";
      const errorWithDetails = err as Error & { details?: unknown };
      if ("details" in errorWithDetails && Array.isArray(errorWithDetails.details)) {
        const issues = errorWithDetails.details
          .map(
            (i: { message: string; path: (number | string)[] }) =>
              `${i.path.join(".")}: ${i.message}`,
          )
          .join("\n");
        message = `Datos inválidos:\n${issues}`;
      }
      toast.error(message, "Error");
    },
    onSuccess: () => {
      toast.success(
        "Los cambios se han guardado correctamente.",
        roleEntity ? "Rol actualizado" : "Rol creado",
      );
      void queryClient.invalidateQueries({ queryKey: roleKeys.all });
      onClose();
    },
  });

  const form = useForm({
    defaultValues: {
      description: roleEntity?.description ?? "",
      name: roleEntity?.name ?? "",
    } as RoleFormData,
    onSubmit: async ({ value }) => {
      mutation.mutate(value);
    },
    validators: {
      onChange: formSchema,
    },
  });

  const renderUsersList = () => {
    if (userData.length > 0) {
      return (
        <div className="max-h-32 space-y-1 overflow-y-auto">
          {userData.map((u) => (
            <div
              className="hover:bg-default-100 flex items-center justify-between rounded p-1 text-xs"
              key={u.id}
            >
              <span>{u.person ? `${u.person.names} ${u.person.fatherName}` : "Sin nombre"}</span>
              <span className="opacity-50">{u.email}</span>
            </div>
          ))}
        </div>
      );
    }

    return <p className="text-xs italic opacity-50">No hay usuarios con este rol.</p>;
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="name">
        {(field) => (
          <TextField className="w-full" isInvalid={field.state.meta.errors.length > 0}>
            <Label className="text-sm font-medium">Nombre del Rol</Label>
            <Input
              className="border-default-200 mt-1 w-full rounded-md border px-3 py-2 text-sm focus:border-primary focus:outline-none"
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder="Ej. Supervisor de Finanzas"
              type="text"
              value={field.state.value}
            />
            {field.state.meta.errors.length > 0 && (
              <FieldError className="text-danger mt-1 text-xs">
                {field.state.meta.errors.join(", ")}
              </FieldError>
            )}
          </TextField>
        )}
      </form.Field>

      <form.Field name="description">
        {(field) => (
          <div className="flex w-full flex-col gap-1">
            <Label className="text-sm font-medium" htmlFor="role-desc">
              Descripción
            </Label>
            <TextArea
              className="border-default-200 w-full rounded-md border px-3 py-2 text-sm focus:border-primary focus:outline-none"
              id="role-desc"
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder="Descripción breve de las responsabilidades"
              rows={3}
              value={field.state.value ?? ""}
            />
          </div>
        )}
      </form.Field>

      {/* Show affected users even if empty list, to confirm zero users */}
      {roleEntity && (
        <div className="bg-default-100 rounded-lg p-3 text-sm">
          <div className="mb-2 flex items-center gap-2 font-medium opacity-70">
            <UserIcon className="h-4 w-4" />
            Usuarios afectados ({userData.length})
          </div>
          {renderUsersList()}
          <div className="text-warning mt-2 flex gap-1 text-xs">
            <AlertCircle className="h-3 w-3" />
            <span>Cualquier cambio en los permisos afectará inmediatamente a estos usuarios.</span>
          </div>
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onPress={onClose}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          isDisabled={mutation.isPending}
          isPending={mutation.isPending}
          type="submit"
        >
          {roleEntity ? "Guardar Cambios" : "Crear Rol"}
        </Button>
      </div>
    </form>
  );
}

function RoleEditForm({ onClose, roleEntity }: { onClose: () => void; roleEntity: Role }) {
  const { data: users } = useSuspenseQuery(roleQueries.users(roleEntity.id));

  return <RoleBaseForm onClose={onClose} roleEntity={roleEntity} userData={users} />;
}

import { Spinner } from "@heroui/react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { AlertCircle, User as UserIcon } from "lucide-react";
import { Suspense } from "react";
import { z } from "zod";
import Button from "@/components/ui/Button";

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
  if (!isOpen) return null;

  return (
    <dialog className="modal modal-bottom sm:modal-middle" open>
      <div className="modal-box">
        <h3 className="text-lg font-bold">{role ? "Editar Rol" : "Nuevo Rol"}</h3>

        {role ? (
          <Suspense
            fallback={
              <div className="flex h-64 items-center justify-center">
                <Spinner className="text-primary" color="current" />
              </div>
            }
          >
            <RoleEditForm onClose={onClose} roleEntity={role} />
          </Suspense>
        ) : (
          <RoleBaseForm onClose={onClose} roleEntity={null} userData={[]} />
        )}
      </div>

      {/* Backdrop to close */}
      <form className="modal-backdrop" method="dialog">
        <button onClick={onClose} type="button">
          close
        </button>
      </form>
    </dialog>
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
              className="hover:bg-base-100 flex items-center justify-between rounded p-1 text-xs"
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
      className="space-y-4 py-4"
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="name">
        {(field) => (
          <div className="form-control w-full">
            <label className="label" htmlFor="role-name">
              <span className="label-text">Nombre del Rol</span>
            </label>
            <input
              className={`input input-bordered w-full ${field.state.meta.errors.length > 0 ? "input-error" : ""}`}
              id="role-name"
              onBlur={field.handleBlur}
              onChange={(e) => {
                field.handleChange(e.target.value);
              }}
              placeholder="Ej. Supervisor de Finanzas"
              type="text"
              value={field.state.value}
            />
            {field.state.meta.errors.length > 0 && (
              <span className="text-error mt-1 text-xs">{field.state.meta.errors.join(", ")}</span>
            )}
          </div>
        )}
      </form.Field>

      <form.Field name="description">
        {(field) => (
          <div className="form-control w-full">
            <label className="label" htmlFor="role-description">
              <span className="label-text">Descripción</span>
            </label>
            <input
              className="input input-bordered w-full"
              id="role-description"
              onBlur={field.handleBlur}
              onChange={(e) => {
                field.handleChange(e.target.value);
              }}
              placeholder="Descripción breve de las responsabilidades"
              type="text"
              value={field.state.value ?? ""}
            />
          </div>
        )}
      </form.Field>

      {/* Show affected users even if empty list, to confirm zero users */}
      {roleEntity && (
        <div className="bg-base-200 rounded-lg p-3 text-sm">
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

      <div className="modal-action">
        <Button variant="ghost" onPress={onClose}>
          Cancelar
        </Button>
        <Button variant="primary" isDisabled={mutation.isPending} type="submit">
          {mutation.isPending && <Spinner size="sm" />}
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

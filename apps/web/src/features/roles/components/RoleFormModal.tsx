import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, User as UserIcon } from "lucide-react";
import { z } from "zod";

import { useToast } from "@/context/ToastContext";
import { createRole, fetchRoleUsers, type RoleUser, updateRole } from "@/features/roles/api";
import { Role } from "@/types/roles";

interface RoleFormModalProps {
  role?: Role | null; // If present, Edit mode. If null, Create mode.
  isOpen: boolean;
  onClose: () => void;
}

const formSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(50, "El nombre no puede exceder los 50 caracteres"),
  description: z.string().max(255, "La descripción no puede exceder los 255 caracteres").optional(),
});

type RoleFormData = z.infer<typeof formSchema>;

export function RoleFormModal({ role, isOpen, onClose }: RoleFormModalProps) {
  const toast = useToast();
  const queryClient = useQueryClient();

  // Fetch users for this role if editing
  const { data: userData = [], isLoading: isLoadingUsers } = useQuery<RoleUser[]>({
    queryKey: ["role-users", role?.id],
    queryFn: () => fetchRoleUsers(role!.id),
    enabled: isOpen && !!role,
  });

  const mutation = useMutation({
    mutationFn: async (data: RoleFormData) => {
      const payload = {
        name: data.name,
        description: data.description || "",
      };
      await (role ? updateRole(role.id, payload) : createRole(payload));
    },
    onSuccess: () => {
      toast.success("Los cambios se han guardado correctamente.", role ? "Rol actualizado" : "Rol creado");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      onClose();
    },
    onError: (err: Error) => {
      let message = err.message || "Ocurrió un error al guardar el rol.";

      const errorWithDetails = err as Error & { details?: unknown };

      if ("details" in errorWithDetails && Array.isArray(errorWithDetails.details)) {
        const issues = errorWithDetails.details
          .map((i: { path: (string | number)[]; message: string }) => `${i.path.join(".")}: ${i.message}`)
          .join("\n");
        message = `Datos inválidos:\n${issues}`;
      }

      toast.error(message, "Error");
    },
  });

  const form = useForm({
    defaultValues: {
      name: role?.name ?? "",
      description: role?.description ?? "",
    } as RoleFormData,
    validators: {
      onChange: formSchema,
    },
    onSubmit: async ({ value }) => {
      mutation.mutate(value);
    },
  });

  const renderUsersList = () => {
    if (isLoadingUsers) return <div className="loading loading-spinner loading-xs"></div>;

    if (userData.length > 0) {
      return (
        <div className="max-h-32 space-y-1 overflow-y-auto">
          {userData.map((u) => (
            <div key={u.id} className="hover:bg-base-100 flex items-center justify-between rounded p-1 text-xs">
              <span>{u.person ? `${u.person.names} ${u.person.fatherName}` : "Sin nombre"}</span>
              <span className="opacity-50">{u.email}</span>
            </div>
          ))}
        </div>
      );
    }

    return <p className="text-xs italic opacity-50">No hay usuarios con este rol.</p>;
  };

  if (!isOpen) return null;

  return (
    <dialog open className="modal modal-bottom sm:modal-middle">
      <div className="modal-box">
        <h3 className="text-lg font-bold">{role ? "Editar Rol" : "Nuevo Rol"}</h3>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
          className="space-y-4 py-4"
        >
          <form.Field name="name">
            {(field) => (
              <div className="form-control w-full">
                <label className="label" htmlFor="role-name">
                  <span className="label-text">Nombre del Rol</span>
                </label>
                <input
                  id="role-name"
                  type="text"
                  placeholder="Ej. Supervisor de Finanzas"
                  className={`input input-bordered w-full ${field.state.meta.errors.length > 0 ? "input-error" : ""}`}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
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
                  id="role-description"
                  type="text"
                  placeholder="Descripción breve de las responsabilidades"
                  className="input input-bordered w-full"
                  value={field.state.value ?? ""}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
              </div>
            )}
          </form.Field>

          {/* Show affected users when editing */}
          {role && (
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
            <button className="btn" type="button" onClick={onClose}>
              Cancelar
            </button>
            <button className="btn btn-primary" type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <span className="loading loading-spinner"></span>}
              {role ? "Guardar Cambios" : "Crear Rol"}
            </button>
          </div>
        </form>
      </div>

      {/* Backdrop to close */}
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, User as UserIcon } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { useToast } from "@/context/ToastContext";
import { createRole, fetchRoleUsers, type RoleUser, updateRole } from "@/features/roles/api";
import { Role } from "@/types/roles";

interface RoleFormModalProps {
  role?: Role | null; // If present, Edit mode. If null, Create mode.
  isOpen: boolean;
  onClose: () => void;
}

interface RoleFormData {
  name: string;
  description: string;
}

export function RoleFormModal({ role, isOpen, onClose }: RoleFormModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RoleFormData>();
  const toast = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isOpen) {
      reset({
        name: role?.name || "",
        description: role?.description || "",
      });
    }
  }, [isOpen, role, reset]);

  // Fetch users for this role if editing
  const { data: userData = [], isLoading: isLoadingUsers } = useQuery<RoleUser[]>({
    queryKey: ["role-users", role?.id],
    queryFn: () => fetchRoleUsers(role!.id),
    enabled: isOpen && !!role,
  });

  const mutation = useMutation({
    mutationFn: async (data: RoleFormData) => {
      if (role) {
        // Edit
        await updateRole(role.id, data);
      } else {
        // Create
        await createRole(data);
      }
    },
    onSuccess: () => {
      toast.success("Los cambios se han guardado correctamente.", role ? "Rol actualizado" : "Rol creado");
      queryClient.invalidateQueries({ queryKey: ["roles"] }); // Refresh list
      onClose();
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || "Ocurrió un error al guardar el rol.", "Error");
    },
  });

  const onSubmit = (data: RoleFormData) => {
    mutation.mutate(data);
  };

  if (!isOpen) return null;

  return (
    <dialog open className="modal modal-bottom sm:modal-middle">
      <div className="modal-box">
        <h3 className="text-lg font-bold">{role ? "Editar Rol" : "Nuevo Rol"}</h3>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="form-control w-full">
            <label className="label" htmlFor="role-name">
              <span className="label-text">Nombre del Rol</span>
            </label>
            <input
              id="role-name"
              type="text"
              placeholder="Ej. Supervisor de Finanzas"
              className={`input input-bordered w-full ${errors.name ? "input-error" : ""}`}
              {...register("name", { required: "El nombre es obligatorio" })}
            />
            {errors.name && <span className="text-error mt-1 text-xs">{errors.name.message}</span>}
          </div>

          <div className="form-control w-full">
            <label className="label" htmlFor="role-description">
              <span className="label-text">Descripción</span>
            </label>
            <input
              id="role-description"
              type="text"
              placeholder="Descripción breve de las responsabilidades"
              className="input input-bordered w-full"
              {...register("description")}
            />
          </div>

          {/* Show affected users when editing */}
          {role && (
            <div className="bg-base-200 rounded-lg p-3 text-sm">
              <div className="mb-2 flex items-center gap-2 font-medium opacity-70">
                <UserIcon className="h-4 w-4" />
                Usuarios afectados ({userData.length})
              </div>
              {isLoadingUsers ? (
                <div className="loading loading-spinner loading-xs"></div>
              ) : userData.length > 0 ? (
                <div className="max-h-32 space-y-1 overflow-y-auto">
                  {userData.map((u) => (
                    <div key={u.id} className="hover:bg-base-100 flex items-center justify-between rounded p-1 text-xs">
                      <span>{u.person ? `${u.person.names} ${u.person.fatherName}` : "Sin nombre"}</span>
                      <span className="opacity-50">{u.email}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs italic opacity-50">No hay usuarios con este rol.</p>
              )}
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

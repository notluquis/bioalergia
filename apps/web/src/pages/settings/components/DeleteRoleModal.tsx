import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle, ArrowRight, Trash2 } from "lucide-react";
import { useState } from "react";

import { useToast } from "@/context/ToastContext";
import { deleteRole, fetchRoleUsers, reassignRoleUsers, type RoleUser } from "@/features/roles/api";
import { Role } from "@/types/roles";

interface DeleteRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: Role;
  allRoles: Role[];
}

export function DeleteRoleModal({ isOpen, onClose, role, allRoles }: DeleteRoleModalProps) {
  const [targetRoleId, setTargetRoleId] = useState<string>("");
  const toast = useToast();
  const queryClient = useQueryClient();

  // Fetch users assigned to this role
  const { data: users = [], isLoading: isLoadingUsers } = useQuery<RoleUser[]>({
    queryKey: ["role-users", role.id],
    queryFn: () => fetchRoleUsers(role.id),
    enabled: isOpen,
  });

  const hasUsers = users.length > 0;

  // Filter out the role being deleted from potential targets
  const availableRoles = allRoles.filter((r) => r.id !== role.id);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (hasUsers) {
        if (!targetRoleId) throw new Error("Debes seleccionar un rol de destino");
        // Reassign users first
        await reassignRoleUsers({ roleId: role.id, targetRoleId: Number(targetRoleId) });
      }
      // Then delete
      await deleteRole(role.id);
    },
    onSuccess: () => {
      toast.success("El rol ha sido eliminado correctamente", "Rol eliminado");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      onClose();
    },
    onError: (err: Error) => {
      let message = err.message || "No se pudo eliminar el rol";

      const errorWithDetails = err as Error & { details?: unknown };

      if ("details" in errorWithDetails && Array.isArray(errorWithDetails.details)) {
        const issues = errorWithDetails.details
          .map((i: { path: (string | number)[]; message: string }) => `${i.path.join(".")}: ${i.message}`)
          .join("\n");
        message = `Error:\n${issues}`;
      }

      toast.error(message, "Error");
    },
  });

  if (!isOpen) return null;

  if (!isOpen) return null;

  const isSystemRole = role.isSystem;

  const renderUsersContent = () => {
    if (isLoadingUsers) {
      return (
        <div className="flex justify-center p-4">
          <span className="loading loading-spinner" />
        </div>
      );
    }

    if (hasUsers) {
      return (
        <div className="bg-warning/10 border-warning/20 space-y-3 rounded-lg border p-4">
          <div className="text-warning flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-5 w-5" />
            <div className="font-medium">Usuarios afectados</div>
          </div>
          <p className="text-sm">
            Hay <strong>{users.length} usuarios</strong> asignados a este rol. Debes moverlos a otro rol antes de
            eliminarlo.
          </p>

          <ul className="bg-base-100 max-h-32 space-y-1 overflow-y-auto rounded p-2 text-xs">
            {users.map((u) => (
              <li key={u.id} className="flex justify-between">
                <span>{u.person ? `${u.person.names} ${u.person.fatherName}` : u.email}</span>
                <span className="opacity-50">{u.email}</span>
              </li>
            ))}
          </ul>

          <div className="form-control w-full">
            <label className="label" htmlFor="target-role-select">
              <span className="label-text flex items-center gap-2 font-medium">
                <ArrowRight className="h-4 w-4" />
                Mover usuarios a:
              </span>
            </label>
            <select
              id="target-role-select"
              className="select select-bordered w-full"
              value={targetRoleId}
              onChange={(e) => setTargetRoleId(e.target.value)}
            >
              <option value="">Selecciona un rol...</option>
              {availableRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      );
    }

    return <p className="text-sm opacity-70">No hay usuarios asignados a este rol. Es seguro eliminarlo.</p>;
  };

  return (
    <dialog open className="modal modal-bottom sm:modal-middle">
      <div className="modal-box">
        <h3 className="text-error flex items-center gap-2 text-lg font-bold">
          <Trash2 className="h-5 w-5" />
          Eliminar Rol: {role.name}
        </h3>

        {isSystemRole ? (
          <div className="py-4">
            <div className="alert alert-error">
              <AlertCircle className="h-4 w-4" />
              <span>Este es un rol de sistema protegido y no puede ser eliminado.</span>
            </div>
            <div className="modal-action">
              <button className="btn" onClick={onClose}>
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-4">
              <p>¿Estás seguro que deseas eliminar este rol? Esta acción no se puede deshacer.</p>

              {renderUsersContent()}
            </div>

            <div className="modal-action">
              <button className="btn" onClick={onClose} type="button">
                Cancelar
              </button>
              <button
                className="btn btn-error"
                onClick={() => deleteMutation.mutate()}
                disabled={hasUsers && !targetRoleId}
              >
                {deleteMutation.isPending ? <span className="loading loading-spinner" /> : "Eliminar"}
              </button>
            </div>
          </>
        )}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}

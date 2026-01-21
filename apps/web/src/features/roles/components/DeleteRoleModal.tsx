import { Alert, Button, Modal, Spinner } from "@heroui/react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle, ArrowRight, Trash2 } from "lucide-react";
import { Suspense, useState } from "react";

import { useToast } from "@/context/ToastContext";
import { deleteRole, reassignRoleUsers, roleKeys, roleQueries } from "@/features/roles/api";
import type { Role } from "@/types/roles";

interface DeleteRoleModalProps {
  readonly allRoles: Role[];
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly role: Role;
}

export function DeleteRoleModal({ allRoles, isOpen, onClose, role }: DeleteRoleModalProps) {
  const isSystemRole = role.isSystem;

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop />
      <Modal.Container placement="center">
        <Modal.Dialog>
          <Modal.Header className="flex flex-col gap-1 text-danger">
            <div className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              <span className="text-lg font-bold">Eliminar Rol: {role.name}</span>
            </div>
          </Modal.Header>
          <Modal.Body className="pb-6">
            {isSystemRole ? (
              <div className="py-2">
                <Alert status="danger">
                  <Alert.Indicator>
                    <AlertCircle className="h-4 w-4" />
                  </Alert.Indicator>
                  <Alert.Content>
                    Este es un rol de sistema protegido y no puede ser eliminado.
                  </Alert.Content>
                </Alert>
                <div className="mt-6 flex justify-end">
                  <Button variant="ghost" onPress={onClose}>
                    Cerrar
                  </Button>
                </div>
              </div>
            ) : (
              <Suspense
                fallback={
                  <div className="py-8 text-center">
                    <Spinner className="text-primary" size="lg" />
                    <p className="mt-2 text-sm opacity-70">Verificando usuarios afectados...</p>
                  </div>
                }
              >
                <DeleteRoleForm allRoles={allRoles} onClose={onClose} role={role} />
              </Suspense>
            )}
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal>
  );
}

function DeleteRoleForm({
  allRoles,
  onClose,
  role,
}: Readonly<Omit<DeleteRoleModalProps, "isOpen">>) {
  const [targetRoleId, setTargetRoleId] = useState<string>("");
  const toast = useToast();
  const queryClient = useQueryClient();

  // Suspend here
  const { data: users } = useSuspenseQuery(roleQueries.users(role.id));
  const hasUsers = users.length > 0;

  const availableRoles = allRoles.filter((r) => r.id !== role.id);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (hasUsers) {
        if (!targetRoleId) throw new Error("Debes seleccionar un rol de destino");
        await reassignRoleUsers({ roleId: role.id, targetRoleId: Number(targetRoleId) });
      }
      await deleteRole(role.id);
    },
    onError: (err: Error) => {
      let message = err.message || "No se pudo eliminar el rol";
      const errorWithDetails = err as Error & { details?: unknown };
      if ("details" in errorWithDetails && Array.isArray(errorWithDetails.details)) {
        const issues = errorWithDetails.details
          .map(
            (i: { message: string; path: (number | string)[] }) =>
              `${i.path.join(".")}: ${i.message}`,
          )
          .join("\n");
        message = `Error:\n${issues}`;
      }
      toast.error(message, "Error");
    },
    onSuccess: () => {
      toast.success("El rol ha sido eliminado correctamente", "Rol eliminado");
      void queryClient.invalidateQueries({ queryKey: roleKeys.all });
      onClose();
    },
  });

  return (
    <>
      <div className="space-y-4 py-2">
        <p>¿Estás seguro que deseas eliminar este rol? Esta acción no se puede deshacer.</p>

        {hasUsers ? (
          <div className="bg-warning/10 border-warning-soft-hover space-y-3 rounded-lg border p-4">
            <div className="text-warning flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-5 w-5" />
              <div className="font-medium">Usuarios afectados</div>
            </div>
            <p className="text-sm">
              Hay <strong>{users.length} usuarios</strong> asignados a este rol. Debes moverlos a
              otro rol antes de eliminarlo.
            </p>

            <ul className="bg-base-100 max-h-32 space-y-1 overflow-y-auto rounded p-2 text-xs">
              {users.map((u) => (
                <li className="flex justify-between" key={u.id}>
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
                className="select select-bordered w-full"
                id="target-role-select"
                onChange={(e) => {
                  setTargetRoleId(e.target.value);
                }}
                value={targetRoleId}
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
        ) : (
          <p className="text-sm opacity-70">
            No hay usuarios asignados a este rol. Es seguro eliminarlo.
          </p>
        )}
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onPress={onClose}>
          Cancelar
        </Button>
        <Button
          variant="danger"
          isDisabled={deleteMutation.isPending || (hasUsers && !targetRoleId)}
          onPress={() => {
            deleteMutation.mutate();
          }}
        >
          {deleteMutation.isPending ? <Spinner size="sm" /> : "Eliminar"}
        </Button>
      </div>
    </>
  );
}

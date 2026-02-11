import { Alert, Spinner } from "@heroui/react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle, ArrowRight } from "lucide-react";
import { Suspense, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select, SelectItem } from "@/components/ui/Select";
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
    <Modal isOpen={isOpen} onClose={onClose} title={`Eliminar Rol: ${role.name}`}>
      <div className="pb-6">
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
      </div>
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
        if (!targetRoleId) {
          throw new Error("Debes seleccionar un rol de destino");
        }
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
          <div className="space-y-3 rounded-lg border border-warning-soft-hover bg-warning/10 p-4">
            <div className="flex items-start gap-2 text-warning">
              <AlertTriangle className="mt-0.5 h-5 w-5" />
              <div className="font-medium">Usuarios afectados</div>
            </div>
            <p className="text-sm">
              Hay <strong>{users.length} usuarios</strong> asignados a este rol. Debes moverlos a
              otro rol antes de eliminarlo.
            </p>

            <ul className="max-h-32 space-y-1 overflow-y-auto rounded bg-background p-2 text-xs">
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
              <Select
                aria-label="Seleccionar rol de destino"
                className="w-full"
                placeholder="Seleccionar rol..."
                value={targetRoleId}
                onChange={(key) => setTargetRoleId(key ? String(key) : "")}
              >
                {availableRoles.map((r) => (
                  <SelectItem id={r.id.toString()} key={r.id} textValue={r.name}>
                    {r.name}
                  </SelectItem>
                ))}
              </Select>
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

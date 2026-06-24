import { Button, Description, Form, Modal, Skeleton } from "@heroui/react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { AlertCircle, User as UserIcon } from "lucide-react";
import { Suspense } from "react";
import { z } from "zod";
import {
  TanStackInputField,
  TanStackTextAreaField,
} from "@/components/forms/TanStackFieldControls";
import { useToast } from "@/context/ToastContext";
import { createRole, type RoleUser, updateRole } from "@/features/roles/api";
import { roleKeys, roleQueries } from "@/features/roles/queries";
import type { Role } from "@/types/roles";

interface RoleFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  roleData?: null | Role; // If present, Edit mode. If null, Create mode.
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

export function RoleFormModal({ isOpen, onClose, roleData }: RoleFormModalProps) {
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
              <Modal.Heading>{roleData ? "Editar Rol" : "Nuevo Rol"}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="mt-2 max-h-[80vh] overflow-y-auto overscroll-contain text-foreground">
              <div className="pb-6">
                {roleData ? (
                  <Suspense
                    fallback={
                      <div className="space-y-3 p-4">
                        <Skeleton className="h-8 w-40 rounded-md" />
                        <Skeleton className="h-10 w-full rounded-md" />
                        <Skeleton className="h-10 w-full rounded-md" />
                      </div>
                    }
                  >
                    <RoleEditForm onClose={onClose} roleEntity={roleData} />
                  </Suspense>
                ) : (
                  <RoleBaseForm onClose={onClose} roleEntity={null} userData={[]} />
                )}
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
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
              `${i.path.join(".")}: ${i.message}`
          )
          .join("\n");
        message = `Datos inválidos:\n${issues}`;
      }
      toast.error(message, "Error");
    },
    onSuccess: () => {
      toast.success(
        "Los cambios se han guardado correctamente.",
        roleEntity ? "Rol actualizado" : "Rol creado"
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
              className="flex items-center justify-between rounded p-1 text-xs hover:bg-default-100"
              key={u.id}
            >
              <span>{u.person ? `${u.person.names} ${u.person.fatherName}` : "Sin nombre"}</span>
              <span className="opacity-50">{u.email}</span>
            </div>
          ))}
        </div>
      );
    }

    return (
      <Description className="text-xs italic opacity-50">No hay usuarios con este rol.</Description>
    );
  };

  return (
    <Form
      className="flex flex-col gap-4"
      onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      validationBehavior="aria"
    >
      <form.Field name="name">
        {(field) => (
          <TanStackInputField
            field={field}
            label="Nombre del Rol"
            placeholder="Ej. Supervisor de Finanzas"
          />
        )}
      </form.Field>

      <form.Field name="description">
        {(field) => (
          <TanStackTextAreaField
            field={field}
            label="Descripción"
            placeholder="Descripción breve de las responsabilidades"
            rows={3}
          />
        )}
      </form.Field>

      {/* Show affected users even if empty list, to confirm zero users */}
      {roleEntity && (
        <div className="rounded-lg bg-default-100 p-3 text-sm">
          <div className="mb-2 flex items-center gap-2 font-medium opacity-70">
            <UserIcon className="size-4" />
            Usuarios afectados ({userData.length})
          </div>
          {renderUsersList()}
          <div className="mt-2 flex gap-1 text-warning text-xs">
            <AlertCircle className="size-3" />
            <span>Cualquier cambio en los permisos afectará inmediatamente a estos usuarios.</span>
          </div>
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onPress={onClose}>
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
    </Form>
  );
}

function RoleEditForm({ onClose, roleEntity }: { onClose: () => void; roleEntity: Role }) {
  const { data: users } = useSuspenseQuery(roleQueries.users(roleEntity.id));

  return <RoleBaseForm onClose={onClose} roleEntity={roleEntity} userData={users} />;
}

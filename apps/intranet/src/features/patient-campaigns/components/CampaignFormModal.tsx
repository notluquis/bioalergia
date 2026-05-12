import { Button, Form, Modal, Switch } from "@heroui/react";
import { useForm } from "@tanstack/react-form";
import { Save } from "lucide-react";
import { useEffect } from "react";
import {
  TanStackInputField,
  TanStackTextAreaField,
} from "@/components/forms/TanStackFieldControls";
import { confirmAction } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/context/ToastContext";
import { useCreatePatientCampaign, useUpdatePatientCampaign } from "../queries";
import type { PatientCampaignWithCounts } from "../types";

interface CampaignFormState {
  name: string;
  description: string;
  messageTemplate: string;
  imageUrl: string;
  isActive: boolean;
}

interface CampaignFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign?: null | PatientCampaignWithCounts;
}

export function CampaignFormModal({ isOpen, onClose, campaign }: Readonly<CampaignFormModalProps>) {
  const toast = useToast();
  const createMutation = useCreatePatientCampaign();
  const updateMutation = useUpdatePatientCampaign();
  const isEditing = !!campaign;

  const form = useForm({
    defaultValues: {
      name: campaign?.name ?? "",
      description: campaign?.description ?? "",
      messageTemplate: campaign?.messageTemplate ?? "",
      imageUrl: campaign?.imageUrl ?? "",
      isActive: campaign?.isActive ?? true,
    } as CampaignFormState,
    onSubmit: async ({ value }) => {
      const ok = await confirmAction({
        title: isEditing ? "Confirmar cambios" : "Confirmar nueva campaña",
        description: <CampaignCheckAnswers value={value} isEditing={isEditing} />,
        confirmLabel: isEditing ? "Guardar cambios" : "Crear campaña",
        cancelLabel: "Volver a editar",
      });
      if (!ok) return;
      try {
        if (isEditing && campaign) {
          await updateMutation.mutateAsync({
            id: campaign.id,
            name: value.name.trim(),
            description: value.description.trim() || null,
            messageTemplate: value.messageTemplate.trim() || null,
            imageUrl: value.imageUrl.trim() || null,
            isActive: value.isActive,
          });
          toast.success("Campaña actualizada");
        } else {
          await createMutation.mutateAsync({
            name: value.name.trim(),
            description: value.description.trim() || undefined,
            messageTemplate: value.messageTemplate.trim() || undefined,
            imageUrl: value.imageUrl.trim() || undefined,
            isActive: value.isActive,
          });
          toast.success("Campaña creada");
        }
        form.reset();
        onClose();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Error al guardar campaña");
      }
    },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({
        name: campaign?.name ?? "",
        description: campaign?.description ?? "",
        messageTemplate: campaign?.messageTemplate ?? "",
        imageUrl: campaign?.imageUrl ?? "",
        isActive: campaign?.isActive ?? true,
      });
    }
  }, [isOpen, campaign, form]);

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleClose = () => {
    if (isPending) return;
    form.reset();
    onClose();
  };

  return (
    <Modal>
      <Modal.Backdrop
        className="bg-black/40 backdrop-blur-[2px]"
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) handleClose();
        }}
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-2xl rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4 font-bold text-primary text-xl">
              <Modal.Heading>{isEditing ? "Editar campaña" : "Nueva campaña"}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="mt-2 max-h-[80vh] overflow-y-auto overscroll-contain text-foreground">
              <Form
                className="space-y-4 pb-2"
                onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void form.handleSubmit();
                }}
                validationBehavior="aria"
              >
                <form.Field
                  name="name"
                  validators={{
                    onBlur: ({ value }) =>
                      !value || value.trim().length === 0 ? "Nombre requerido" : undefined,
                  }}
                >
                  {(field) => (
                    <TanStackInputField
                      field={field}
                      label="Nombre de la campaña"
                      placeholder="Ej: Descuentos Abril 2026"
                      required
                    />
                  )}
                </form.Field>

                <form.Field name="description">
                  {(field) => (
                    <TanStackTextAreaField
                      field={field}
                      label="Descripción interna"
                      placeholder="Notas internas sobre el objetivo de la campaña"
                      rows={2}
                    />
                  )}
                </form.Field>

                <form.Field name="messageTemplate">
                  {(field) => (
                    <TanStackTextAreaField
                      field={field}
                      label="Mensaje de WhatsApp"
                      placeholder="Hola! Como parte de nuestro compromiso..."
                      rows={6}
                    />
                  )}
                </form.Field>

                <form.Field name="imageUrl">
                  {(field) => (
                    <TanStackInputField
                      field={field}
                      label="URL de imagen (opcional)"
                      placeholder="https://..."
                    />
                  )}
                </form.Field>

                <form.Field name="isActive">
                  {(field) => (
                    <Switch
                      isSelected={field.state.value}
                      onChange={(selected) => field.handleChange(selected)}
                    >
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                      <Switch.Content>Campaña activa</Switch.Content>
                    </Switch>
                  )}
                </form.Field>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onPress={handleClose} isDisabled={isPending}>
                    Cancelar
                  </Button>
                  <Button type="submit" variant="primary" isPending={isPending}>
                    <Save size={16} />
                    {isEditing ? "Guardar" : "Crear"}
                  </Button>
                </div>
              </Form>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function CampaignCheckAnswers({
  value,
  isEditing,
}: {
  value: CampaignFormState;
  isEditing: boolean;
}) {
  const rows: Array<[string, string]> = [
    ["Nombre", value.name.trim() || "—"],
    ["Descripción", value.description.trim() || "—"],
    ["Mensaje", value.messageTemplate.trim() || "—"],
    ["Imagen", value.imageUrl.trim() || "—"],
    ["Activa", value.isActive ? "Sí" : "No"],
  ];
  return (
    <div className="space-y-3">
      <p className="text-default-600 text-sm">
        {isEditing
          ? "Revisa los cambios antes de guardar."
          : "Revisa los datos antes de crear la campaña."}
      </p>
      <dl className="divide-y divide-divider rounded-2xl border border-divider bg-content2">
        {rows.map(([k, v]) => (
          <div className="grid grid-cols-[120px_1fr] gap-3 px-4 py-2" key={k}>
            <dt className="text-caption text-default-500">{k}</dt>
            <dd className="break-words text-foreground text-sm whitespace-pre-wrap">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

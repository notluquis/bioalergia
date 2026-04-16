import { Button, Form, Modal, Switch } from "@heroui/react";
import { useForm } from "@tanstack/react-form";
import { Save } from "lucide-react";
import { useEffect } from "react";
import {
  TanStackInputField,
  TanStackTextAreaField,
} from "@/components/forms/TanStackFieldControls";
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
                    <div className="flex items-center gap-3">
                      <Switch
                        isSelected={field.state.value}
                        onChange={(selected) => field.handleChange(selected)}
                      />
                      <span className="text-sm">Campaña activa</span>
                    </div>
                  )}
                </form.Field>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" onPress={handleClose} isDisabled={isPending}>
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

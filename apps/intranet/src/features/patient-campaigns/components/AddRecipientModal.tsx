import { Button, Form, Modal } from "@heroui/react";
import { useForm } from "@tanstack/react-form";
import { UserPlus } from "lucide-react";
import { useEffect } from "react";
import { TanStackInputField } from "@/components/forms/TanStackFieldControls";
import { useToast } from "@/context/ToastContext";
import { formatRut, validateRut } from "@/lib/rut";
import { useUpsertCampaignRecipient } from "../queries";

interface AddRecipientFormState {
  patientRut: string;
  patientName: string;
  patientPhone: string;
}

interface AddRecipientModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: number;
}

export function AddRecipientModal({
  isOpen,
  onClose,
  campaignId,
}: Readonly<AddRecipientModalProps>) {
  const toast = useToast();
  const upsertMutation = useUpsertCampaignRecipient();

  const form = useForm({
    defaultValues: {
      patientRut: "",
      patientName: "",
      patientPhone: "",
    } as AddRecipientFormState,
    onSubmit: async ({ value }) => {
      if (!validateRut(value.patientRut)) {
        toast.error("El RUT ingresado no es válido");
        return;
      }
      try {
        await upsertMutation.mutateAsync({
          campaignId,
          patientRut: value.patientRut,
          patientName: value.patientName.trim() || undefined,
          patientPhone: value.patientPhone.trim() || undefined,
          status: "SENT",
        });
        toast.success("Destinatario agregado");
        form.reset();
        onClose();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Error al agregar destinatario");
      }
    },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset();
    }
  }, [isOpen, form]);

  const handleClose = () => {
    if (upsertMutation.isPending) return;
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
          <Modal.Dialog className="relative w-full max-w-md rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4 font-bold text-primary text-xl">
              <Modal.Heading>Agregar destinatario</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="mt-2 text-foreground">
              <Form
                className="space-y-4"
                onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void form.handleSubmit();
                }}
                validationBehavior="aria"
              >
                <form.Field
                  name="patientRut"
                  validators={{
                    onBlur: ({ value }) => (!validateRut(value) ? "RUT inválido" : undefined),
                  }}
                >
                  {(field) => (
                    <TanStackInputField
                      field={field}
                      label="RUT del paciente"
                      placeholder="12.345.678-9"
                      required
                      transformOnChange={formatRut}
                    />
                  )}
                </form.Field>

                <form.Field name="patientName">
                  {(field) => (
                    <TanStackInputField
                      field={field}
                      label="Nombre (opcional)"
                      placeholder="Se auto-completa si el paciente existe"
                    />
                  )}
                </form.Field>

                <form.Field name="patientPhone">
                  {(field) => (
                    <TanStackInputField
                      field={field}
                      label="Teléfono (opcional)"
                      placeholder="+56 9 1234 5678"
                    />
                  )}
                </form.Field>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="ghost"
                    onPress={handleClose}
                    isDisabled={upsertMutation.isPending}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" variant="primary" isPending={upsertMutation.isPending}>
                    <UserPlus size={16} />
                    Agregar
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

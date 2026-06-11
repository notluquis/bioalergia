import { useState } from "react";
import { Button, Checkbox, Form, Input, Modal, Select } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { certificatesORPCClient, toCertificatesApiError } from "@/features/certificates/orpc";
import { toast } from "@/lib/toast-interceptor";
import type { MedicalPrescription } from "@finanzas/orpc-contracts/certificates";
import { updatePatient } from "@/features/patients/api";

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  prescription: MedicalPrescription | null;
}

export function EmailPrescriptionModal({ isOpen, onOpenChange, prescription }: Props) {
  const queryClient = useQueryClient();
  const [emailSelection, setEmailSelection] = useState<string>("");
  const [customEmail, setCustomEmail] = useState("");
  const [saveToPatient, setSaveToPatient] = useState(false);

  const registeredEmail = prescription?.patient?.person?.email;

  const emailMutation = useMutation({
    mutationFn: async (targetEmail: string) => {
      if (!prescription) return;

      if (saveToPatient && customEmail && prescription.patient.id) {
        await updatePatient(prescription.patient.id, {
          email: customEmail,
        });
        await queryClient.invalidateQueries({ queryKey: ["patients"] });
      }

      const res = await certificatesORPCClient.prescriptions.email({
        id: prescription.id,
        to: targetEmail,
      });
      return res;
    },
    onSuccess: () => {
      toast.success("Receta enviada por correo exitosamente");
      onOpenChange(false);
      setEmailSelection("");
      setCustomEmail("");
      setSaveToPatient(false);
    },
    onError: (error) => {
      const apiErr = toCertificatesApiError(error);
      toast.error(apiErr.message || "Error al enviar la receta por correo");
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const finalEmail = emailSelection === "custom" ? customEmail : registeredEmail;
    if (!finalEmail) return;
    emailMutation.mutate(finalEmail);
  };

  const isCustom = emailSelection === "custom";

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Content>
        {(onClose) => (
          <Form onSubmit={handleSubmit} validationBehavior="aria">
            <Modal.Header className="flex flex-col gap-1">Enviar receta por correo</Modal.Header>
            <Modal.Body className="w-full">
              <p className="text-default-500 text-sm">
                Se enviará la receta médica de{" "}
                <strong className="text-foreground">{prescription?.patientName}</strong>.
              </p>

              <Select
                isRequired
                label="Seleccione el correo destinatario"
                selectedKeys={emailSelection ? [emailSelection] : []}
                onSelectionChange={(keys) => {
                  const key = Array.from(keys)[0] as string;
                  setEmailSelection(key);
                }}
              >
                {registeredEmail ? (
                  <Select.Item key="registered">{registeredEmail} (Correo registrado)</Select.Item>
                ) : null}
                <Select.Item key="custom">Ingresar otro correo...</Select.Item>
              </Select>

              {isCustom ? (
                <div className="mt-2 flex w-full flex-col gap-3">
                  <Input
                    autoFocus
                    isRequired
                    label="Correo electrónico"
                    type="email"
                    value={customEmail}
                    onValueChange={setCustomEmail}
                  />
                  <Checkbox isSelected={saveToPatient} onValueChange={setSaveToPatient}>
                    Guardar este correo en la ficha del paciente
                  </Checkbox>
                </div>
              ) : null}
            </Modal.Body>
            <Modal.Footer>
              <Button color="danger" variant="light" onPress={onClose}>
                Cancelar
              </Button>
              <Button
                color="primary"
                isLoading={emailMutation.isPending}
                type="submit"
                isDisabled={!emailSelection || (isCustom && !customEmail)}
              >
                Enviar correo
              </Button>
            </Modal.Footer>
          </Form>
        )}
      </Modal.Content>
    </Modal>
  );
}

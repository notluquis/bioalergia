import { useEffect, useState } from "react";
import {
  Button,
  Checkbox,
  Description,
  Form,
  Input,
  Label,
  Modal,
  Radio,
  RadioGroup,
  TextArea,
  TextField,
} from "@heroui/react";
import { Mail } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MedicalPrescription } from "@finanzas/orpc-contracts/certificates";
import { certificatesORPCClient, toCertificatesApiError } from "@/features/certificates/orpc";
import { updatePatient } from "@/features/patients/api";
import { toast } from "@/lib/toast-interceptor";

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  prescription: MedicalPrescription | null;
}

export function EmailPrescriptionModal({ isOpen, onOpenChange, prescription }: Props) {
  const queryClient = useQueryClient();
  const target = prescription;
  const patientEmail = target?.patient?.person?.email;

  const [sendType, setSendType] = useState<"registered" | "custom">("custom");
  const [customTo, setCustomTo] = useState("");
  const [message, setMessage] = useState("");
  const [saveEmail, setSaveEmail] = useState(false);

  // Prefilla el tipo y resetea campos al abrir.
  useEffect(() => {
    if (target) {
      if (target.patient?.person?.email) {
        setSendType("registered");
      } else {
        setSendType("custom");
      }
      setCustomTo("");
      setMessage("");
      setSaveEmail(false);
    }
  }, [target]);

  const emailMutation = useMutation({
    mutationFn: async ({
      to,
      message,
      saveEmail,
    }: {
      to: string;
      message?: string;
      saveEmail?: boolean;
    }) => {
      if (!target) return;
      if (saveEmail && to && target.patient?.id) {
        await updatePatient({ patientId: target.patient.id, email: to });
        await queryClient.invalidateQueries({ queryKey: ["patients"] });
      }
      return certificatesORPCClient.emailPrescription({
        id: target.id,
        to,
        message,
      });
    },
    onSuccess: () => {
      toast.success("Receta enviada por correo exitosamente");
      onOpenChange(false);
    },
    onError: (error) => {
      const apiErr = toCertificatesApiError(error);
      toast.error(apiErr.message || "Error al enviar la receta por correo");
    },
  });

  const onClose = () => onOpenChange(false);
  const isPending = emailMutation.isPending;

  if (!target) return null;

  const finalTo = sendType === "registered" && patientEmail ? patientEmail : customTo.trim();
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(finalTo);

  return (
    <Modal>
      <Modal.Backdrop
        className="bg-black/40 backdrop-blur-[2px]"
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-md rounded-[28px] bg-background p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <Modal.Header className="mb-4">
              <Modal.Heading className="font-semibold text-primary text-xl">
                Enviar receta por email
              </Modal.Heading>
              <p className="text-default-600 text-sm">
                {target.patientName}
                {target.folio ? ` · ${target.folio}` : ""}
              </p>
            </Modal.Header>
            <Modal.Body>
              <Form
                onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (validEmail) {
                    emailMutation.mutate({
                      to: finalTo,
                      message: message.trim() || undefined,
                      saveEmail: !patientEmail && saveEmail,
                    });
                  }
                }}
              >
                <div className="space-y-4 w-full">
                  {patientEmail ? (
                    <RadioGroup
                      className="w-full"
                      name="email-target"
                      value={sendType}
                      onChange={(val) => setSendType(val as "registered" | "custom")}
                    >
                      <Label>Destinatario</Label>
                      <Radio
                        className="group flex max-w-full cursor-pointer gap-3 rounded-xl border border-default-200 bg-default-50 p-3 hover:bg-default-100 data-[selected=true]:border-primary data-[selected=true]:bg-primary/5"
                        value="registered"
                      >
                        <Radio.Control className="mt-1">
                          <Radio.Indicator />
                        </Radio.Control>
                        <Radio.Content className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <Label className="cursor-pointer text-sm font-medium">
                            Email registrado
                          </Label>
                          <Description className="truncate text-xs">{patientEmail}</Description>
                        </Radio.Content>
                      </Radio>
                      <Radio
                        className="group flex max-w-full cursor-pointer gap-3 rounded-xl border border-default-200 bg-default-50 p-3 hover:bg-default-100 data-[selected=true]:border-primary data-[selected=true]:bg-primary/5"
                        value="custom"
                      >
                        <Radio.Control className="mt-1">
                          <Radio.Indicator />
                        </Radio.Control>
                        <Radio.Content className="flex min-w-0 flex-1 w-full flex-col gap-0.5">
                          <Label className="cursor-pointer text-sm font-medium">Otro correo</Label>
                          {sendType === "custom" && (
                            <div className="mt-2 w-full" onClick={(e) => e.stopPropagation()}>
                              <TextField
                                aria-label="Ingresar otro correo"
                                autoFocus
                                className="w-full"
                                value={customTo}
                                onChange={setCustomTo}
                              >
                                <Input placeholder="paciente@correo.cl" type="email" />
                              </TextField>
                            </div>
                          )}
                        </Radio.Content>
                      </Radio>
                    </RadioGroup>
                  ) : (
                    <div className="space-y-2">
                      <TextField className="w-full" value={customTo} onChange={setCustomTo}>
                        <Label>Email del destinatario</Label>
                        <Input placeholder="paciente@correo.cl" type="email" />
                      </TextField>
                      <Checkbox
                        isSelected={saveEmail}
                        onChange={setSaveEmail}
                        className="mt-2 flex gap-2"
                      >
                        <Checkbox.Content>
                          <Checkbox.Control>
                            <Checkbox.Indicator />
                          </Checkbox.Control>
                          Guardar este correo en el perfil del paciente
                        </Checkbox.Content>
                      </Checkbox>
                    </div>
                  )}

                  <TextField className="w-full" value={message} onChange={setMessage}>
                    <Label>Mensaje (opcional)</Label>
                    <TextArea placeholder="Mensaje adicional para el paciente" rows={3} />
                  </TextField>
                  <div className="flex w-full justify-end gap-2 pt-2">
                    <Button onPress={onClose} type="button" variant="ghost">
                      Cancelar
                    </Button>
                    <Button isDisabled={!validEmail || isPending} type="submit">
                      <Mail size={16} />
                      {isPending ? "Enviando..." : "Enviar"}
                    </Button>
                  </div>
                </div>
              </Form>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

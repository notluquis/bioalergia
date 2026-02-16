import {
  Button,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  Modal,
  TextField,
} from "@heroui/react";
import dayjs from "dayjs";
import { useServiceMutations } from "../hooks/use-service-mutations";
import type { ServiceSchedule } from "../types";

interface SkipScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: null | ServiceSchedule;
}

export function SkipScheduleModal({ isOpen, onClose, schedule }: SkipScheduleModalProps) {
  const { skipSchedule, skipSchedulePending } = useServiceMutations();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!schedule) {
      return;
    }

    const formData = new FormData(e.currentTarget);
    const reason = formData.get("reason") as string;

    await skipSchedule(schedule.id, { reason });
  };

  if (!schedule) {
    return null;
  }

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Container placement="center">
        <Modal.Dialog className="sm:max-w-125">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Marcar cuota como omitida</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div className="space-y-4">
              <div className="rounded-lg bg-amber-50 p-4 dark:bg-amber-900/30">
                <Description className="text-amber-800 text-sm dark:text-amber-300">
                  Esta cuota será marcada como OMITIDA y no contará en los totales de pendientes ni
                  vencidos.
                </Description>
                <Description className="mt-2 text-amber-700 text-xs dark:text-amber-400">
                  <strong>Periodo:</strong> {dayjs(schedule.periodStart).format("MMM YYYY")} •{" "}
                  <strong>Monto:</strong> ${schedule.expectedAmount.toLocaleString("es-CL")}
                </Description>
              </div>

              <Form
                className="flex flex-col gap-4"
                onSubmit={handleSubmit}
                validationBehavior="aria"
              >
                <TextField
                  isRequired
                  name="reason"
                  validate={(value) => {
                    if (!value || value.trim().length === 0) {
                      return "El motivo es obligatorio";
                    }
                    if (value.length > 500) {
                      return "El motivo no puede exceder 500 caracteres";
                    }
                    return null;
                  }}
                >
                  <Label>Motivo</Label>
                  <Input placeholder="Servicio suspendido temporalmente" />
                  <Description>
                    Explica por qué se omite esta cuota (ej: servicio suspendido, mes no aplicó,
                    etc.)
                  </Description>
                  <FieldError />
                </TextField>

                <div className="flex justify-end gap-3 pt-2">
                  <Button isDisabled={skipSchedulePending} slot="close" variant="secondary">
                    Cancelar
                  </Button>
                  <Button isPending={skipSchedulePending} type="submit" variant="danger-soft">
                    Marcar como omitida
                  </Button>
                </div>
              </Form>
            </div>
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

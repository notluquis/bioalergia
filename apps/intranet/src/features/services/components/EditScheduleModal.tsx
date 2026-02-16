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

interface EditScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: null | ServiceSchedule;
}

export function EditScheduleModal({ isOpen, onClose, schedule }: EditScheduleModalProps) {
  const { editSchedule, editSchedulePending } = useServiceMutations();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!schedule) {
      return;
    }

    const formData = new FormData(e.currentTarget);
    const dueDate = new Date(formData.get("dueDate") as string);
    const expectedAmount = Number(formData.get("expectedAmount"));
    const note = formData.get("note") as string;

    await editSchedule(schedule.id, {
      dueDate,
      expectedAmount,
      note: note || undefined,
    });
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
            <Modal.Heading>Editar cuota</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <Form className="flex flex-col gap-4" onSubmit={handleSubmit} validationBehavior="aria">
              <TextField
                defaultValue={dayjs(schedule.dueDate).format("YYYY-MM-DD")}
                isRequired
                name="dueDate"
                type="date"
                validate={(value) => {
                  if (!value) {
                    return "Fecha de vencimiento requerida";
                  }
                  return null;
                }}
              >
                <Label>Fecha de vencimiento</Label>
                <Input />
                <FieldError />
              </TextField>

              <TextField
                defaultValue={String(schedule.expectedAmount)}
                isRequired
                name="expectedAmount"
                type="number"
                validate={(value) => {
                  const num = Number(value);
                  if (Number.isNaN(num) || num < 0) {
                    return "Monto debe ser mayor o igual a 0";
                  }
                  return null;
                }}
              >
                <Label>Monto esperado</Label>
                <Input min={0} step="0.01" />
                <FieldError />
              </TextField>

              <TextField defaultValue={schedule.note ?? ""} name="note">
                <Label>Nota</Label>
                <Input placeholder="Opcional: agrega una nota sobre este ajuste" />
                <Description>Opcional: agrega una nota sobre este ajuste</Description>
              </TextField>

              <div className="flex justify-end gap-3 pt-2">
                <Button isDisabled={editSchedulePending} slot="close" variant="secondary">
                  Cancelar
                </Button>
                <Button isPending={editSchedulePending} type="submit">
                  Guardar cambios
                </Button>
              </div>
            </Form>
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

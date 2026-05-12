import { Button, Modal } from "@heroui/react";
import type { ReactNode } from "react";

interface CalendarActionModalProps {
  body?: ReactNode;
  confirmLabel: string;
  description: string;
  isOpen: boolean;
  isPending?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
}

export function CalendarActionModal({
  body,
  confirmLabel,
  description,
  isOpen,
  isPending = false,
  onClose,
  onConfirm,
  title,
}: Readonly<CalendarActionModalProps>) {
  return (
    <Modal>
      <Modal.Backdrop
        className="bg-black/40 backdrop-blur-[2px]"
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open && !isPending) {
            onClose();
          }
        }}
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-xl rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4">
              <div className="space-y-1">
                <Modal.Heading className="font-bold text-xl">{title}</Modal.Heading>
                <p className="text-default-500 text-sm">{description}</p>
              </div>
            </Modal.Header>

            <Modal.Body className="space-y-4 text-foreground">{body}</Modal.Body>

            <Modal.Footer className="mt-6 flex justify-end gap-3">
              <Button isDisabled={isPending} onPress={onClose} type="button" variant="outline">
                Cancelar
              </Button>
              <Button
                className="bg-primary text-primary-foreground"
                isDisabled={isPending}
                onPress={onConfirm}
                type="button"
              >
                {isPending ? "Procesando..." : confirmLabel}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

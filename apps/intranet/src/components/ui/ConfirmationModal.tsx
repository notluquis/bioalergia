import { Button, Description, Modal } from "@heroui/react";
import { AlertTriangle } from "lucide-react";

interface ConfirmationModalProps {
  cancelLabel?: string;
  confirmLabel?: string;
  description?: string;
  isOpen: boolean;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  variant?: "danger" | "warning" | "info";
}

export function ConfirmationModal({
  cancelLabel = "Cancelar",
  confirmLabel = "Confirmar",
  description,
  isOpen,
  loading = false,
  onCancel,
  onConfirm,
  title,
  variant = "warning",
}: ConfirmationModalProps) {
  const variantStyles = {
    danger: {
      bg: "bg-rose-100 dark:bg-rose-900/30",
      icon: "text-rose-600 dark:text-rose-400",
      text: "text-rose-700 dark:text-rose-300",
    },
    info: {
      bg: "bg-blue-100 dark:bg-blue-900/30",
      icon: "text-blue-600 dark:text-blue-400",
      text: "text-blue-700 dark:text-blue-300",
    },
    warning: {
      bg: "bg-amber-100 dark:bg-amber-900/30",
      icon: "text-amber-600 dark:text-amber-400",
      text: "text-amber-700 dark:text-amber-300",
    },
  };

  const styles = variantStyles[variant];

  const buttonVariant = variant === "danger" ? "danger" : "secondary";

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <Modal.Container placement="center">
        <Modal.Dialog className="sm:max-w-[440px]">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>{title}</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div className={`flex gap-3 rounded-lg p-4 ${styles.bg}`}>
              <AlertTriangle className={`h-5 w-5 shrink-0 ${styles.icon}`} />
              <Description className={`${styles.text} text-sm`}>
                {description || "¿Estás seguro de que deseas continuar con esta acción?"}
              </Description>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button
              isDisabled={loading}
              onPress={onCancel}
              slot="close"
              type="button"
              variant="secondary"
            >
              {cancelLabel}
            </Button>
            <Button
              isDisabled={loading}
              isPending={loading}
              onPress={onConfirm}
              type="button"
              variant={buttonVariant}
            >
              {loading ? "Procesando..." : confirmLabel}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

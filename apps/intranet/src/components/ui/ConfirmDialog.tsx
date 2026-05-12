import { Button, Modal } from "@heroui/react";
import { Store, useStore } from "@tanstack/react-store";

type ConfirmVariant = "default" | "danger";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
  resolve?: (value: boolean) => void;
}

const initialState: ConfirmState = {
  open: false,
  title: "",
};

const confirmStore = new Store<ConfirmState>(initialState);

/**
 * Imperative replacement for window.confirm().
 * Returns a promise resolving true if user confirms, false otherwise.
 * Requires <ConfirmDialogHost /> mounted once in the app tree.
 */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    confirmStore.setState(() => ({
      ...options,
      open: true,
      resolve,
    }));
  });
}

function close(result: boolean) {
  const { resolve } = confirmStore.state;
  confirmStore.setState((prev) => ({ ...prev, open: false, resolve: undefined }));
  resolve?.(result);
}

export function ConfirmDialogHost() {
  const state = useStore(confirmStore);
  const variant: ConfirmVariant = state.variant ?? "default";
  const confirmVariant = variant === "danger" ? "danger" : "primary";

  return (
    <Modal>
      <Modal.Backdrop
        className="bg-black/50 backdrop-blur-[2px]"
        isOpen={state.open}
        onOpenChange={(open) => {
          if (!open) {
            close(false);
          }
        }}
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-md rounded-[28px] bg-content1 p-6 shadow-2xl">
            <Modal.Header className="mb-2 font-bold text-foreground text-lg">
              <Modal.Heading>{state.title}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="mt-1 text-foreground">
              {state.description ? (
                <p className="text-default-600 text-sm leading-relaxed">{state.description}</p>
              ) : null}
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <Button onPress={() => close(false)} size="md" variant="outline">
                  {state.cancelLabel ?? "Cancelar"}
                </Button>
                <Button onPress={() => close(true)} size="md" variant={confirmVariant}>
                  {state.confirmLabel ?? "Confirmar"}
                </Button>
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

import { AlertDialog, Button } from "@heroui/react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type ConfirmDialogStatus = "accent" | "danger" | "default" | "success" | "warning";

export interface ConfirmDialogOptions {
  cancelLabel?: string;
  confirmLabel?: string;
  confirmVariant?: "danger" | "ghost" | "outline" | "primary" | "secondary" | "tertiary";
  description: ReactNode;
  isDismissable?: boolean;
  isKeyboardDismissDisabled?: boolean;
  size?: "cover" | "lg" | "md" | "sm" | "xs";
  status?: ConfirmDialogStatus;
  title: ReactNode;
}

type ConfirmDialogFn = (options: ConfirmDialogOptions) => Promise<boolean>;

const ConfirmDialogContext = createContext<ConfirmDialogFn | null>(null);

const DEFAULT_OPTIONS: Required<
  Pick<
    ConfirmDialogOptions,
    | "cancelLabel"
    | "confirmLabel"
    | "confirmVariant"
    | "isDismissable"
    | "isKeyboardDismissDisabled"
    | "size"
    | "status"
  >
> = {
  cancelLabel: "Cancelar",
  confirmLabel: "Confirmar",
  confirmVariant: "primary",
  isDismissable: false,
  isKeyboardDismissDisabled: true,
  size: "sm",
  status: "warning",
};

type ConfirmDialogRequest = Required<
  Pick<
    ConfirmDialogOptions,
    | "cancelLabel"
    | "confirmLabel"
    | "confirmVariant"
    | "isDismissable"
    | "isKeyboardDismissDisabled"
    | "size"
    | "status"
  >
> &
  Pick<ConfirmDialogOptions, "description" | "title">;

export function ConfirmDialogProvider({ children }: Readonly<{ children: ReactNode }>) {
  const resolverRef = useRef<((value: boolean) => void) | null>(null);
  const [request, setRequest] = useState<ConfirmDialogRequest | null>(null);

  const resolveRequest = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setRequest(null);
  }, []);

  const confirm = useCallback<ConfirmDialogFn>(
    async (options) =>
      new Promise<boolean>((resolve) => {
        if (resolverRef.current) {
          resolverRef.current(false);
        }

        resolverRef.current = resolve;
        setRequest({
          ...DEFAULT_OPTIONS,
          ...options,
        });
      }),
    []
  );

  useEffect(
    () => () => {
      resolverRef.current?.(false);
      resolverRef.current = null;
    },
    []
  );

  return (
    <ConfirmDialogContext.Provider value={confirm}>
      {children}
      <AlertDialog.Backdrop
        isDismissable={request?.isDismissable ?? DEFAULT_OPTIONS.isDismissable}
        isKeyboardDismissDisabled={
          request?.isKeyboardDismissDisabled ?? DEFAULT_OPTIONS.isKeyboardDismissDisabled
        }
        isOpen={request != null}
        onOpenChange={(open) => {
          if (!open) {
            resolveRequest(false);
          }
        }}
      >
        <AlertDialog.Container size={request?.size ?? DEFAULT_OPTIONS.size}>
          <AlertDialog.Dialog>
            <AlertDialog.CloseTrigger />
            <AlertDialog.Header>
              <AlertDialog.Icon status={request?.status ?? DEFAULT_OPTIONS.status} />
              <AlertDialog.Heading>{request?.title}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>{request?.description}</AlertDialog.Body>
            <AlertDialog.Footer>
              <Button onPress={() => resolveRequest(false)} variant="tertiary">
                {request?.cancelLabel ?? DEFAULT_OPTIONS.cancelLabel}
              </Button>
              <Button
                onPress={() => resolveRequest(true)}
                variant={request?.confirmVariant ?? DEFAULT_OPTIONS.confirmVariant}
              >
                {request?.confirmLabel ?? DEFAULT_OPTIONS.confirmLabel}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialog() {
  const context = useContext(ConfirmDialogContext);

  if (!context) {
    throw new Error("useConfirmDialog must be used within ConfirmDialogProvider");
  }

  return context;
}

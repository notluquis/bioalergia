import { Modal } from "@heroui/react";
import type { ReactNode } from "react";

type AppModalSize = "sm" | "md" | "lg" | "xl";

interface AppModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  size?: AppModalSize;
  footer?: ReactNode;
  children: ReactNode;
  /** When true (default) the modal slides up to cover the full viewport on
   * touch screens (<640px). Disable for tiny dialogs that should stay
   * floating even on mobile. */
  mobileFullscreen?: boolean;
}

const SIZE_TO_MAX_WIDTH: Record<AppModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

/**
 * Shared modal shell. Wraps the HeroUI v3 Modal compound (Backdrop + Container
 * + Dialog + Header + Body) so callers stop hand-rolling the same boilerplate.
 *
 * - Mobile (<640px): slides up to fill the viewport (mobileFullscreen).
 * - Desktop: floats centered with a tokenized rounded-3xl card on bg-content1.
 * - Always honors prefers-reduced-motion / reduced-transparency through the
 *   global gates in index.css.
 */
export function AppModal({
  isOpen,
  onClose,
  title,
  size = "md",
  footer,
  children,
  mobileFullscreen = true,
}: AppModalProps) {
  const dialogClass = mobileFullscreen
    ? `relative flex w-full flex-col bg-content1 shadow-2xl max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:rounded-none sm:max-h-[90vh] sm:rounded-[28px] sm:p-0 ${SIZE_TO_MAX_WIDTH[size]}`
    : `relative flex w-full flex-col rounded-[28px] bg-content1 shadow-2xl ${SIZE_TO_MAX_WIDTH[size]}`;

  return (
    <Modal>
      <Modal.Backdrop
        className="bg-black/50 backdrop-blur-[2px]"
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <Modal.Container placement={mobileFullscreen ? "bottom" : "center"} scroll="inside">
          <Modal.Dialog className={dialogClass}>
            <Modal.Header className="flex items-center justify-between border-divider border-b px-6 py-4">
              <Modal.Heading className="font-semibold text-foreground text-lg">
                {title}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex-1 overflow-y-auto overscroll-contain px-6 py-5 text-foreground">
              {children}
            </Modal.Body>
            {footer ? (
              <div className="flex flex-wrap justify-end gap-2 border-divider border-t px-6 py-4">
                {footer}
              </div>
            ) : null}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

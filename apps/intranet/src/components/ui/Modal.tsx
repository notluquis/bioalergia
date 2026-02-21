import { Modal as HeroModal } from "@heroui/react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface ModalProps {
  boxClassName?: string;
  children: ReactNode;
  className?: string; // wrapper class not used in HeroUI normally
  isOpen: boolean;
  onClose: () => void;
  title: string;
}
export function Modal({ boxClassName, children, isOpen, onClose, title }: ModalProps) {
  return (
    <HeroModal>
      <HeroModal.Backdrop
        className="bg-black/40 backdrop-blur-[2px]"
        isOpen={isOpen}
        onOpenChange={(open) => !open && onClose()}
      >
        <HeroModal.Container placement="center">
          <HeroModal.Dialog
            className={cn(
              "relative w-full max-w-2xl rounded-[28px] bg-background p-6 shadow-2xl",
              boxClassName,
            )}
          >
            <HeroModal.Header className="mb-4 font-bold text-primary text-xl">
              {title}
            </HeroModal.Header>
            <HeroModal.Body className="mt-2 max-h-[80vh] overflow-y-auto overscroll-contain text-foreground">
              {children}
            </HeroModal.Body>
          </HeroModal.Dialog>
        </HeroModal.Container>
      </HeroModal.Backdrop>
    </HeroModal>
  );
}

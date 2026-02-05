import {
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalHeader,
  ModalRoot,
} from "@heroui/react";
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
    <ModalRoot isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ModalBackdrop className="bg-black/40 backdrop-blur-[2px]">
        <ModalContainer placement="center">
          <ModalDialog
            className={cn(
              "relative w-full max-w-2xl rounded-[28px] bg-background p-6 shadow-2xl",
              boxClassName,
            )}
          >
            <ModalHeader className="mb-4 font-bold text-primary text-xl">{title}</ModalHeader>
            <ModalBody className="mt-2 max-h-[80vh] overflow-y-auto overscroll-contain text-foreground">
              {children}
            </ModalBody>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </ModalRoot>
  );
}

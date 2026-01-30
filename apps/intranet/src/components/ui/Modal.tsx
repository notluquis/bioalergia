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

export default function Modal({ boxClassName, children, isOpen, onClose, title }: ModalProps) {
  return (
    <ModalRoot isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ModalBackdrop className="bg-black/40 backdrop-blur-[2px]">
        <ModalContainer placement="center">
          <ModalDialog
            className={cn(
              "rounded-[28px] bg-background shadow-2xl p-6 relative w-full max-w-2xl",
              boxClassName,
            )}
          >
            <ModalHeader className="text-primary text-xl font-bold mb-4">{title}</ModalHeader>
            <ModalBody className="max-h-[80vh] overflow-y-auto overscroll-contain mt-2 text-foreground">
              {children}
            </ModalBody>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </ModalRoot>
  );
}

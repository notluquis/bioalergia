import {
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalHeader,
  ModalRoot,
} from "@heroui/react";
import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

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
      <ModalPortal>
        <ModalBackdrop className="bg-black/40 backdrop-blur-[2px]">
          <ModalContainer placement="center">
            <ModalDialog
              className={cn(
                "rounded-[28px] bg-background shadow-2xl p-6 relative w-full max-w-2xl",
                boxClassName,
              )}
            >
              <ModalHeader className="text-primary text-xl font-bold mb-4">{title}</ModalHeader>
              <ModalBody className="max-h-[80vh] max-h-[80dvh] overflow-y-auto overscroll-contain mt-2 text-foreground">
                {children}
              </ModalBody>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </ModalPortal>
    </ModalRoot>
  );
}

function ModalPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

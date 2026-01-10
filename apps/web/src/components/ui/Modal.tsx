import { X } from "lucide-react";
import React, { useEffect } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

import Backdrop from "./Backdrop";
import Button from "./Button";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  boxClassName?: string;
}

export default function Modal({ isOpen, onClose, title, children, className, boxClassName }: ModalProps) {
  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Handle native "cancel" event (Escape key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className={cn("modal modal-open flex items-center justify-center", className)}>
      <Backdrop isVisible={isOpen} onClose={onClose} className="z-0" zIndex={0} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={cn(
          "modal-box surface-elevated border-base-300/50 ring-base-300/30 relative z-10 w-full max-w-2xl rounded-[28px] border p-6 shadow-2xl ring-1",
          boxClassName
        )}
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 id="modal-title" className="text-primary text-xl font-bold">
            {title}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="btn-circle bg-base-200/60 text-base-content hover:bg-base-200"
          >
            <X size={18} />
          </Button>
        </div>
        <div className="mt-2">{children}</div>
      </div>
    </div>,
    document.body
  );
}

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
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
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  // Handle native "cancel" event (Escape key) to sync state
  const handleCancel = (e: React.SyntheticEvent) => {
    e.preventDefault(); // Prevent default close to control it via props if needed, or just allow it and call onClose
    onClose();
  };

  // Handle backdrop click
  const handleClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (e.target === dialog) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className={cn("modal bg-base-content/20 backdrop-blur-md transition-all duration-300", className)}
      onCancel={handleCancel}
      onClick={handleClick}
    >
      <div
        className={cn(
          "modal-box surface-elevated border-base-300/50 ring-base-300/30 relative w-full max-w-2xl rounded-[28px] border p-6 shadow-2xl ring-1",
          boxClassName
        )}
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-primary text-xl font-bold">{title}</h2>
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
    </dialog>
  );
}

import React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import Button from "./Button";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export default function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  React.useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal modal-open animate-fade-in bg-base-content/20 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={cn(
          "modal-box surface-elevated relative w-full max-w-2xl rounded-[28px] border border-base-300/50 p-6 shadow-2xl ring-1 ring-base-300/30 animate-scale-in transition-all duration-300",
          className
        )}
        tabIndex={-1}
      >
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-xl font-bold text-primary">{title}</h2>
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
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );
}

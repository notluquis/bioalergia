import React from "react";
import { X } from "lucide-react";

import Button from "./Button";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
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
    <div className="modal modal-open" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-box relative w-full max-w-2xl rounded-2xl p-6" tabIndex={-1}>
        <div className="flex items-start justify-between">
          <h2 className="text-xl font-bold text-(--brand-primary)">{title}</h2>
          <Button variant="secondary" size="sm" onClick={onClose} aria-label="Cerrar modal">
            <X size={18} />
          </Button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

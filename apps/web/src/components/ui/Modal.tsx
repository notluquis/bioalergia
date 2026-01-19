/**
 * Modal Component - Native implementation
 *
 * Using native portal + dialog for full API compatibility.
 */
import { X } from "lucide-react";
import type React from "react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

import Button from "./Button";

interface ModalProps {
  boxClassName?: string;
  children: React.ReactNode;
  className?: string;
  isOpen: boolean;
  onClose: () => void;
  title: string;
}

export default function Modal({
  boxClassName,
  children,
  className,
  isOpen,
  onClose,
  title,
}: ModalProps) {
  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "unset";
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
    globalThis.addEventListener("keydown", handleKeyDown);
    return () => {
      globalThis.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className={cn("modal modal-open flex items-center justify-center", className)}>
      {/* Backdrop */}
      {/* Backdrop */}
      {/* biome-ignore lint/a11y/useSemanticElements: modal overlay */}
      <div
        aria-label="Cerrar modal"
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
        role="button"
        tabIndex={0}
      />

      <div
        aria-labelledby="modal-title"
        aria-modal="true"
        className={cn(
          "modal-box surface-elevated border-base-300/50 ring-base-300/30 relative z-10 w-full max-w-2xl rounded-[28px] border p-6 shadow-2xl ring-1",
          boxClassName,
        )}
        role="dialog"
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-primary text-xl font-bold" id="modal-title">
            {title}
          </h2>
          <Button
            aria-label="Cerrar modal"
            className="btn-circle bg-base-200/60 text-base-content hover:bg-base-200"
            onClick={onClose}
            size="sm"
            variant="ghost"
          >
            <X size={18} />
          </Button>
        </div>
        <div className="mt-2">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

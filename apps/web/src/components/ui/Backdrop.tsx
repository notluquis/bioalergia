/**
 * Backdrop Component - Click-outside overlay
 *
 * Used for closing dropdowns, modals, etc. when clicking outside.
 */
import { cn } from "@/lib/utils";

interface BackdropProps {
  isVisible: boolean;
  onClose?: () => void;
  className?: string;
  zIndex?: number;
}

export default function Backdrop({ isVisible, onClose, className, zIndex = 40 }: BackdropProps) {
  if (!isVisible) return null;

  return (
    <div
      className={cn("fixed inset-0", className)}
      style={{ zIndex }}
      onClick={() => onClose?.()}
      onKeyDown={(e) => e.key === "Escape" && onClose?.()}
      role="button"
      tabIndex={0}
      aria-label="Close"
    />
  );
}

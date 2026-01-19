/**
 * Backdrop Component - Click-outside overlay
 *
 * Used for closing dropdowns, modals, etc. when clicking outside.
 */
import { cn } from "@/lib/utils";

interface BackdropProps {
  className?: string;
  isVisible: boolean;
  onClose?: () => void;
  zIndex?: number;
}

export default function Backdrop({
  className,
  isVisible,
  onClose,
  zIndex = 40,
}: Readonly<BackdropProps>) {
  if (!isVisible) return null;

  return (
    // biome-ignore lint/a11y/useSemanticElements: backdrop div
    <div
      aria-label="Close"
      className={cn("fixed inset-0", className)}
      onClick={() => onClose?.()}
      onKeyDown={(e) => e.key === "Escape" && onClose?.()}
      role="button"
      style={{ zIndex }}
      tabIndex={0}
    />
  );
}

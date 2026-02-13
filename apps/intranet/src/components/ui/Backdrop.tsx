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
export function Backdrop({ className, isVisible, onClose, zIndex = 40 }: Readonly<BackdropProps>) {
  if (!isVisible) {
    return null;
  }

  return (
    <button
      aria-label="Close"
      className={cn("fixed inset-0", className)}
      onClick={() => onClose?.()}
      style={{ zIndex }}
      type="button"
    />
  );
}

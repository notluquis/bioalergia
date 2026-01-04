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
      role="button"
      tabIndex={-1}
      aria-label="Cerrar (clic afuera)"
      className={cn("fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity", className)}
      style={{ zIndex }}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
          onClose?.();
        }
      }}
    />
  );
}

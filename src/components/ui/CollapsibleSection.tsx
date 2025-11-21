import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function CollapsibleSection({
  title,
  description,
  defaultOpen = false,
  actions,
  children,
  className,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={cn(
        "collapse collapse-plus border border-base-300 p-0 text-sm text-base-content bg-base-100",
        className
      )}
    >
      <input type="checkbox" className="hidden" checked={open} readOnly onClick={() => setOpen((v) => !v)} />
      <div
        className="collapse-title flex w-full items-center justify-between gap-3 px-4 py-3 cursor-pointer"
        onClick={() => setOpen((v) => !v)}
      >
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-base-content/80">{title}</p>
          {description && <p className="text-xs text-base-content/60">{description}</p>}
        </div>
        {/* DaisyUI collapse-plus handles the icon rotation automatically via CSS if using checkbox or details/summary, 
            but since we are controlling state manually for custom behavior, we might need to adjust. 
            However, the original code used manual icon. DaisyUI collapse-plus adds a plus/minus icon. 
            Let's stick to DaisyUI's built-in icon behavior if possible, or custom if needed.
            The original code had a custom chevron. Let's keep the custom chevron if we want specific style, 
            or use collapse-plus. The original used collapse-plus class BUT also a manual span with rotation.
            That's conflicting. Let's use standard DaisyUI collapse behavior or fully custom.
            
            Let's go with fully custom to match the original look but cleaner.
        */}
      </div>
      <div className={cn("collapse-content p-4", open && "block")}>
        {actions && <div className="mb-3 flex flex-wrap items-center gap-2">{actions}</div>}
        <div className="space-y-4">{children}</div>
      </div>
    </div>
  );
}

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

import { SmoothCollapse } from "@/components/ui/SmoothCollapse";
import { ChevronDown } from "lucide-react";

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
    <div className={cn("rounded-box border-base-300 bg-base-100 border", className)}>
      <div
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 select-none"
        onClick={() => setOpen((v) => !v)}
      >
        <div>
          <p className="text-base-content/80 text-sm font-semibold tracking-wide uppercase">{title}</p>
          {description && <p className="text-base-content/60 text-xs">{description}</p>}
        </div>
        <ChevronDown
          size={18}
          className={cn("text-base-content/50 transition-transform duration-300", open ? "rotate-180" : "")}
        />
      </div>

      <SmoothCollapse isOpen={open}>
        <div className="px-4 pt-0 pb-4">
          {actions && <div className="mb-3 flex flex-wrap items-center gap-2">{actions}</div>}
          <div className="space-y-4">{children}</div>
        </div>
      </SmoothCollapse>
    </div>
  );
}

import { useState, type ReactNode } from "react";

interface CollapsibleSectionProps {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}

export default function CollapsibleSection({
  title,
  description,
  defaultOpen = false,
  actions,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="collapse collapse-plus border border-base-300 p-0 text-sm text-base-content bg-base-100">
      <input type="checkbox" className="hidden" checked={open} readOnly />
      <div
        className="collapse-title flex w-full items-center justify-between gap-3 px-4 py-3"
        onClick={() => setOpen((v) => !v)}
      >
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-base-content/80">{title}</p>
          {description && <p className="text-xs text-base-content/60">{description}</p>}
        </div>
        <span
          className={`inline-flex h-7 w-7 items-center justify-center rounded-full border border-base-300 bg-base-100 text-xs font-semibold text-base-content/80 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <span className="text-xs">⌃</span>
        </span>
      </div>
      <div className="collapse-content p-4">
        {actions && <div className="mb-3 flex flex-wrap items-center gap-2">{actions}</div>}
        <div className="space-y-4">{children}</div>
      </div>
    </div>
  );
}

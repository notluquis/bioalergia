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
    <div className="collapse collapse-plus border border-white/40 p-0 text-sm text-slate-600 bg-base-100">
      <input type="checkbox" className="hidden" checked={open} readOnly />
      <div
        className="collapse-title flex w-full items-center justify-between gap-3 px-4 py-3"
        onClick={() => setOpen((v) => !v)}
      >
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</p>
          {description && <p className="text-xs text-slate-400">{description}</p>}
        </div>
        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/60 bg-base-100/70 text-xs font-semibold text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}>
          <span className="text-[10px]">⌃</span>
        </span>
      </div>
      <div className="collapse-content p-4">
        {actions && <div className="mb-3 flex flex-wrap items-center gap-2">{actions}</div>}
        <div className="space-y-4">{children}</div>
      </div>
    </div>
  );
}

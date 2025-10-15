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
    <section className="glass-card glass-underlay-gradient border border-white/40 p-4 text-sm text-slate-600">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</p>
          {description && <p className="text-xs text-slate-400">{description}</p>}
        </div>
        <span
          className={`inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/60 bg-white/70 text-xs font-semibold text-slate-500 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        >
          ⌃
        </span>
      </button>
      {actions && <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div>}
      {open && <div className="mt-4 space-y-4">{children}</div>}
    </section>
  );
}

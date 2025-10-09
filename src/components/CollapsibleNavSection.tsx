import { useState } from "react";
import { ChevronDown } from "lucide-react";
import React from "react";

interface CollapsibleNavSectionProps {
  title: string;
  children: React.ReactNode;
}

export default function CollapsibleNavSection({ title, children }: CollapsibleNavSectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-xl border border-white/40 bg-white/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600/90 shadow-inner transition-all hover:border-white/60 hover:bg-white/55 hover:text-[var(--brand-primary)]"
      >
        <span className="font-semibold">{title}</span>
        <ChevronDown size={16} className={`transform transition-transform ${isOpen ? "" : "-rotate-90"}`} />
      </button>
      {isOpen && <div className="flex flex-col gap-1.5 pl-2">{children}</div>}
    </div>
  );
}

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import React from "react";
import Button from "./Button";

interface CollapsibleNavSectionProps {
  title: string;
  children: React.ReactNode;
}

export default function CollapsibleNavSection({ title, children }: CollapsibleNavSectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="space-y-2">
      <div className={`collapse ${isOpen ? 'collapse-open' : ''} rounded-xl border border-white/40 bg-base-100/40 shadow-inner`}>
        <Button
          type="button"
          variant="secondary"
          className={`collapse-title flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600/90`}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="font-semibold">{title}</span>
          <ChevronDown size={16} className={`transform transition-transform ${isOpen ? "" : "-rotate-90"}`} />
        </Button>
        <div className="collapse-content p-0 pl-2">
          <div className="flex flex-col gap-1.5">{children}</div>
        </div>
      </div>
    </div>
  );
}

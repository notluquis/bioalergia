import { useState } from "react";
import { ChevronDown } from "lucide-react";
import React from "react";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface CollapsibleNavSectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export default function CollapsibleNavSection({ title, children, className }: CollapsibleNavSectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className={cn("space-y-2", className)}>
      <div
        className={cn(
          "collapse rounded-xl border border-base-300 bg-base-100 shadow-inner",
          isOpen ? "collapse-open" : ""
        )}
      >
        <Button
          type="button"
          variant="secondary"
          className="collapse-title flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-base-content/70 w-full"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="font-semibold">{title}</span>
          <ChevronDown size={16} className={cn("transform transition-transform", !isOpen && "-rotate-90")} />
        </Button>
        <div className="collapse-content p-0 pl-2">
          <div className="flex flex-col gap-1.5">{children}</div>
        </div>
      </div>
    </div>
  );
}

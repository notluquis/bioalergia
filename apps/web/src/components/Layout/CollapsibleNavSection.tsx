import { ChevronDown } from "lucide-react";
import React, { useState } from "react";

import Button from "@/components/ui/Button";
import { SmoothCollapse } from "@/components/ui/SmoothCollapse";
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
      <div className="border-base-300 bg-base-100 rounded-xl border shadow-inner">
        <Button
          type="button"
          variant="secondary"
          className="text-base-content/70 flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-semibold tracking-wide uppercase"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="font-semibold">{title}</span>
          <ChevronDown
            size={16}
            className={cn("transform transition-transform duration-300", !isOpen && "-rotate-90")}
          />
        </Button>
        <SmoothCollapse isOpen={isOpen}>
          <div className="p-0 pl-2 opacity-100 transition-opacity duration-300">
            <div className="flex flex-col gap-1.5 pb-2">{children}</div>
          </div>
        </SmoothCollapse>
      </div>
    </div>
  );
}

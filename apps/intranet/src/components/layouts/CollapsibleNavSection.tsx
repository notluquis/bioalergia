import { ChevronDown } from "lucide-react";
import type React from "react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { SmoothCollapse } from "@/components/ui/SmoothCollapse";
import { cn } from "@/lib/utils";

interface CollapsibleNavSectionProps {
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly title: string;
}
export function CollapsibleNavSection({ children, className, title }: CollapsibleNavSectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="rounded-xl border border-default-200 bg-background shadow-inner">
        <Button
          className="flex w-full items-center justify-between gap-2 px-3 py-2 font-semibold text-default-600 text-xs uppercase tracking-wide"
          onClick={() => {
            setIsOpen(!isOpen);
          }}
          type="button"
          variant="secondary"
        >
          <span className="font-semibold">{title}</span>
          <ChevronDown
            className={cn("transform transition-transform duration-300", !isOpen && "-rotate-90")}
            size={16}
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

import React from "react";
import { cn } from "@/lib/utils";

interface SmoothCollapseProps {
  isOpen: boolean;
  children: React.ReactNode;
  className?: string;
}

export function SmoothCollapse({ isOpen, children, className }: SmoothCollapseProps) {
  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows] duration-300 ease-out",
        isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        className
      )}
      aria-hidden={!isOpen}
    >
      <div className="min-w-0 overflow-hidden">{children}</div>
    </div>
  );
}

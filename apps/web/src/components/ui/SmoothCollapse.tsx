import React from "react";

import { cn } from "@/lib/utils";

interface SmoothCollapseProps {
  children: React.ReactNode;
  className?: string;
  isOpen: boolean;
}

export function SmoothCollapse({ children, className, isOpen }: SmoothCollapseProps) {
  return (
    <div
      aria-hidden={!isOpen}
      className={cn(
        "grid transition-[grid-template-rows] duration-300 ease-out",
        isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        className
      )}
    >
      <div className="min-w-0 overflow-hidden">{children}</div>
    </div>
  );
}

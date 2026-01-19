import { ChevronDown } from "lucide-react";
import type React from "react";
import { useState } from "react";

import Button from "@/components/ui/Button";
import { SmoothCollapse } from "@/components/ui/SmoothCollapse";
import { cn } from "@/lib/utils";

interface CollapsibleNavSectionProps {
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly title: string;
}

export default function CollapsibleNavSection({
  children,
  className,
  title,
}: CollapsibleNavSectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="border-base-300 bg-base-100 rounded-xl border shadow-inner">
        <Button
          className="text-base-content/70 flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-semibold tracking-wide uppercase"
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

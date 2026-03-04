import { Button, Disclosure } from "@heroui/react";
import type React from "react";
import { useState } from "react";
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
      <Disclosure isExpanded={isOpen} onExpandedChange={setIsOpen}>
        <Disclosure.Heading className="rounded-xl border border-default-200 bg-background shadow-inner">
          <Button
            className="flex w-full items-center justify-between gap-2 px-3 py-2 font-semibold text-default-600 text-xs uppercase tracking-wide"
            slot="trigger"
            type="button"
            variant="secondary"
          >
            <span className="font-semibold">{title}</span>
            <Disclosure.Indicator />
          </Button>
        </Disclosure.Heading>
        <Disclosure.Content>
          <Disclosure.Body className="p-0 pl-2">
            <div className="flex flex-col gap-1.5 pb-2">{children}</div>
          </Disclosure.Body>
        </Disclosure.Content>
      </Disclosure>
    </div>
  );
}

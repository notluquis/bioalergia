import {
  TooltipContent,
  type TooltipContentProps,
  TooltipRoot,
  type TooltipRootProps,
  TooltipTrigger,
} from "@heroui/react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type TooltipProps = Omit<TooltipContentProps, "className"> &
  Pick<
    TooltipRootProps,
    "delay" | "closeDelay" | "isDisabled" | "trigger" | "isOpen" | "defaultOpen" | "onOpenChange"
  > & {
    content: ReactNode;
    children: ReactNode;
    classNames?: {
      content?: string;
    };
    className?: string;
  };

export function Tooltip({
  children,
  content,
  delay,
  closeDelay,
  isDisabled,
  trigger,
  isOpen,
  defaultOpen,
  onOpenChange,
  classNames,
  className,
  ...props
}: TooltipProps) {
  return (
    <TooltipRoot
      delay={delay}
      closeDelay={closeDelay}
      isDisabled={isDisabled}
      trigger={trigger}
      isOpen={isOpen}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
    >
      <TooltipTrigger>{children}</TooltipTrigger>
      <TooltipContent className={cn(className, classNames?.content)} {...props}>
        {content}
      </TooltipContent>
    </TooltipRoot>
  );
}

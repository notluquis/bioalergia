import {
  Tooltip as HeroTooltip,
  type TooltipProps as HeroTooltipProps,
  TooltipContent,
  type TooltipContentProps,
  TooltipTrigger,
} from "@heroui/react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// We omit 'children' from HeroTooltipProps because in our adapter
// 'children' is the trigger content, and we assume 'content' is the tooltip content.
export interface TooltipProps extends Omit<HeroTooltipProps, "children"> {
  children: ReactNode;
  content: ReactNode;

  // Content Props
  showArrow?: boolean;
  placement?: TooltipContentProps["placement"];
  offset?: number;
  // We keep classNames in our interface for backward compatibility with consumers
  // but we map it manually since TooltipContent doesn't accept it directly in this version
  classNames?: {
    content?: string;
  };
  className?: string;
}

export function Tooltip({
  children,
  content,
  showArrow,
  placement,
  offset,
  classNames,
  className,
  ...rootProps
}: TooltipProps) {
  return (
    <HeroTooltip {...rootProps}>
      <TooltipTrigger>{children}</TooltipTrigger>
      <TooltipContent
        className={cn(className, classNames?.content)}
        offset={offset}
        placement={placement}
        showArrow={showArrow}
      >
        {content}
      </TooltipContent>
    </HeroTooltip>
  );
}

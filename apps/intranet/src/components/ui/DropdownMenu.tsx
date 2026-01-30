import {
  DropdownItem,
  DropdownPopover,
  DropdownRoot,
  DropdownSection,
  DropdownTrigger,
  DropdownMenu as HeroDropdownMenu,
} from "@heroui/react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

// Adapter: Radix Trigger -> HeroUI Trigger
// Radix's asChild behavior (merging props) is default in HeroUI Trigger, so we just strip the asChild prop.
const DropdownMenuTrigger = ({
  asChild,
  ...props
}: ComponentProps<typeof DropdownTrigger> & { asChild?: boolean }) => (
  <DropdownTrigger {...props} />
);

// Adapter: Radix Content -> HeroUI Popover + Menu
type DropdownMenuContentProps = ComponentProps<typeof HeroDropdownMenu> & {
  className?: string;
  sideOffset?: number;
  placement?: ComponentProps<typeof DropdownPopover>["placement"];
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
};

const DropdownMenuContentFixed = ({
  children,
  className,
  sideOffset = 4,
  placement,
  align,
  side,
  ...props
}: DropdownMenuContentProps) => {
  // Map side/align to placement
  let resolvedPlacement = placement;
  if (!resolvedPlacement) {
    if (side) {
      if (align === "start") resolvedPlacement = `${side} start` as any;
      else if (align === "end") resolvedPlacement = `${side} end` as any;
      else resolvedPlacement = side as any;
    } else {
      // Default fallback
      resolvedPlacement = align === "end" ? "bottom end" : "bottom";
    }
  }

  return (
    <DropdownPopover
      offset={sideOffset}
      placement={resolvedPlacement as any}
      // isNonModal prevents the popover from triggering global modal/backdrop behaviors
      // which was causing the "behind the blur" issue.
      {...({ isNonModal: true } as any)}
    >
      <HeroDropdownMenu aria-label="Menu" className={className} {...props}>
        {children}
      </HeroDropdownMenu>
    </DropdownPopover>
  );
};

// Adapter: Radix Group -> DropdownSection
const DropdownMenuGroup = DropdownSection;

// Adapter: Radix Item -> HeroUI Item
const DropdownMenuItem = ({
  onSelect,
  className,
  asChild,
  ...props
}: ComponentProps<typeof DropdownItem> & { onSelect?: (e: any) => void; asChild?: boolean }) => {
  return (
    <DropdownItem
      className={className}
      onPress={(e: any) => {
        onSelect?.(e);
        props.onPress?.(e);
      }}
      {...props}
    />
  );
};

// Adapter: Radix CheckboxItem -> HeroUI Item with manual checked handling
const DropdownMenuCheckboxItem = ({
  checked,
  children,
  onCheckedChange,
  onSelect,
  ...props
}: ComponentProps<typeof DropdownItem> & {
  checked?: boolean;
  children?: ReactNode;
  onCheckedChange?: (checked: boolean) => void;
  onSelect?: (e: any) => void;
}) => {
  return (
    <DropdownItem
      textValue={typeof children === "string" ? children : undefined}
      onPress={(e: any) => {
        onSelect?.(e);
        onCheckedChange?.(!checked);
        props.onPress?.(e);
      }}
      {...props}
    >
      <div className="flex items-center gap-2">
        <span className="flex w-4 items-center justify-center">
          {checked && <span className="text-primary text-xs">✓</span>}
        </span>
        {children}
      </div>
    </DropdownItem>
  );
};

const DropdownMenuLabel = ({
  children,
  className,
  ...props
}: ComponentProps<typeof DropdownItem>) => (
  <DropdownItem
    className={cn("font-semibold opacity-100 cursor-default", className)}
    isDisabled
    {...props}
  >
    {children}
  </DropdownItem>
);

const DropdownMenuSeparator = () => (
  <DropdownSection className="h-px bg-default-200 my-1"></DropdownSection>
);

const DropdownMenuRoot = Object.assign(DropdownRoot, {
  CheckboxItem: DropdownMenuCheckboxItem,
  Content: DropdownMenuContentFixed,
  Group: DropdownMenuGroup,
  Item: DropdownMenuItem,
  Label: DropdownMenuLabel,
  Separator: DropdownMenuSeparator,
  Trigger: DropdownMenuTrigger,
});

export {
  DropdownMenuRoot as DropdownMenu,
  /** @deprecated Use DropdownMenu namespace */
  DropdownMenuCheckboxItem,
  /** @deprecated Use DropdownMenu namespace */
  DropdownMenuContentFixed as DropdownMenuContent,
  /** @deprecated Use DropdownMenu namespace */
  DropdownMenuGroup,
  /** @deprecated Use DropdownMenu namespace */
  DropdownMenuItem,
  /** @deprecated Use DropdownMenu namespace */
  DropdownMenuLabel,
  /** @deprecated Use DropdownMenu namespace */
  DropdownMenuSeparator,
  /** @deprecated Use DropdownMenu namespace */
  DropdownMenuTrigger,
};

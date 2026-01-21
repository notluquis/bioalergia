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

// Adapter: Radix Root -> HeroUI Root
const DropdownMenu = DropdownRoot;

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

const DropdownMenuContent = ({
  children,
  className,
  sideOffset = 4,
  placement,
  align,
  side,
  ...props
}: DropdownMenuContentProps) => {
  // Map side/align to placement
  // Radix: side (top/bottom/left/right) + align (start/center/end)
  // HeroUI (React Aria): top start, top, top end, etc. (Space separated)
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
    <DropdownPopover offset={sideOffset} placement={resolvedPlacement as any}>
      <HeroDropdownMenu aria-label="Dropdown menu" className={className} {...props}>
        {children}
      </HeroDropdownMenu>
    </DropdownPopover>
  );
};

// Adapter: Radix Group -> DropdownSection
const DropdownMenuGroup = DropdownSection;

const DropdownMenuPortal = ({ children }: { children: ReactNode }) => <>{children}</>;

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
      onPress={(e) => {
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
      onPress={(e) => {
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
  <DropdownSection className="h-px bg-default-200 my-1">
    <></>
  </DropdownSection>
);

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
};

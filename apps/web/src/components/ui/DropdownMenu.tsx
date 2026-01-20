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
const DropdownMenuTrigger = DropdownTrigger;

// Adapter: Radix Content -> HeroUI Popover + Menu
// We map placement/alignment props here.
// Radix expects 'side' and 'align'. HeroUI expects 'placement'.
type DropdownMenuContentProps = ComponentProps<typeof HeroDropdownMenu> & {
  className?: string;
  sideOffset?: number;
  placement?: ComponentProps<typeof DropdownPopover>["placement"];
  align?: "start" | "center" | "end";
};

const DropdownMenuContent = ({
  children,
  className,
  sideOffset = 4,
  placement,
  align,
  ...props
}: DropdownMenuContentProps) => {
  // Simple mapping: "bottom-end" -> "bottom end" for React Aria?
  // TS Error suggests "bottom end".
  const resolvedPlacement = placement || (align === "end" ? "bottom end" : "bottom");

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
const DropdownMenuItem = DropdownItem;

// Adapter: Radix CheckboxItem -> HeroUI Item with manual checked handling
const DropdownMenuCheckboxItem = ({
  checked,
  children,
  onCheckedChange,
  ...props
}: ComponentProps<typeof DropdownItem> & {
  checked?: boolean;
  children?: ReactNode;
  onCheckedChange?: (checked: boolean) => void;
}) => {
  return (
    <DropdownItem
      textValue={typeof children === "string" ? children : undefined}
      onPress={(e) => {
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

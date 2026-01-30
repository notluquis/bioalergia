import {
  Dropdown,
  DropdownItem,
  DropdownPopover,
  type DropdownPopoverProps,
  DropdownSection,
  DropdownTrigger,
  DropdownMenu as HeroDropdownMenu,
  type DropdownMenuProps as HeroDropdownMenuProps,
} from "@heroui/react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const DropdownMenu = Dropdown;
const DropdownMenuTrigger = DropdownTrigger;
const DropdownMenuGroup = DropdownSection;
const DropdownMenuItem = DropdownItem;
const DropdownMenuLabel = (props: ComponentProps<typeof DropdownItem>) => (
  // HeroUI doesn't have a distinct Label component for items, so we style an Item
  <DropdownItem
    className={cn("font-semibold opacity-100 cursor-default", props.className)}
    isDisabled
    {...props}
  />
);
const DropdownMenuSeparator = () => (
  <DropdownSection className="h-px bg-default-200 my-1" aria-label="Separator" />
);

// Adapter: Merge Popover + Menu to match Shadcn 'Content' API
// This allows preserving the usage: <DropdownMenuContent><DropdownMenuItem .../></DropdownMenuContent>
const DropdownMenuContent = ({
  children,
  className,
  align = "end",
  sideOffset = 4,
  ...props
}: HeroDropdownMenuProps<object> & {
  sideOffset?: number;
  align?: "start" | "center" | "end";
}) => {
  // Map 'align' to placement roughly (HeroUI uses placement prop on Popover)
  // Defaulting to "bottom end" if align is "end" (common in dashboards)
  const placement: DropdownPopoverProps["placement"] =
    align === "end"
      ? ("bottom-end" as any)
      : align === "start"
        ? ("bottom-start" as any)
        : "bottom";

  return (
    <DropdownPopover offset={sideOffset} placement={placement}>
      <HeroDropdownMenu className={className} {...props}>
        {children}
      </HeroDropdownMenu>
    </DropdownPopover>
  );
};

// Aliases for compatibility with existing imports
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  // CheckboxItem - HeroUI handles checkboxes via selectionMode="multiple" on Menu
  // For now, we map it to Item, but state handling differs.
  // Assuming simple usage for now.
  DropdownMenuItem as DropdownMenuCheckboxItem,
};

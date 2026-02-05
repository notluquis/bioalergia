import { Dropdown } from "@heroui/react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// DropdownMenuCheckboxItem implementation compatible with Shadcn API
const DropdownMenuCheckboxItem = ({
  checked,
  onCheckedChange,
  children,
  ...props
}: ComponentProps<typeof Dropdown.Item> & {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  children?: React.ReactNode;
}) => (
  <Dropdown.Item
    className={cn("flex items-center justify-between gap-2", props.className)}
    onPress={() => onCheckedChange?.(!checked)}
    {...props}
  >
    <div className="flex items-center gap-2">{children}</div>
    {checked && <span className="text-small">✓</span>}
  </Dropdown.Item>
);

// Aliases for compatibility + strict HeroUI v3 exports
// DropdownMenuContent removed in favor of strict composition: <DropdownPopover><HeroDropdownMenu>...</HeroDropdownMenu></DropdownPopover>

const DropdownMenu = Dropdown;
const DropdownMenuTrigger = Dropdown.Trigger;
const DropdownMenuGroup = Dropdown.Section;
const DropdownMenuItem = Dropdown.Item;
const DropdownPopover = Dropdown.Popover;
const HeroDropdownMenu = Dropdown.Menu;

const DropdownMenuSeparator = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div className={cn("-mx-1 my-1 h-px bg-default-200/50", className)} {...props} />
);

const DropdownMenuLabel = ({
  className,
  inset,
  ...props
}: React.ComponentProps<"div"> & { inset?: boolean }) => (
  <div className={cn("px-2 py-1.5 font-semibold text-sm", inset && "pl-8", className)} {...props} />
);

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuCheckboxItem,
  // Export primitives for strict composition
  DropdownPopover,
  HeroDropdownMenu,
};

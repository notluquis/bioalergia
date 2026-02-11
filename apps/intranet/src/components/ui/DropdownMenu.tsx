import { Dropdown } from "@heroui/react";
import { cn } from "@/lib/utils";

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
  // Export primitives for strict composition
  DropdownPopover,
  HeroDropdownMenu,
};

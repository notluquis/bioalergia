import {
  Dropdown,
  DropdownItem,
  DropdownPopover,
  DropdownSection,
  DropdownTrigger,
  DropdownMenu as HeroDropdownMenu,
} from "@heroui/react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// DropdownMenuCheckboxItem implementation compatible with Shadcn API
const DropdownMenuCheckboxItem = ({
  checked,
  onCheckedChange,
  children,
  ...props
}: ComponentProps<typeof DropdownItem> & {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  children?: React.ReactNode;
}) => (
  <DropdownItem
    className={cn("justify-between flex items-center gap-2", props.className)}
    onPress={() => onCheckedChange?.(!checked)}
    {...props}
  >
    <div className="flex items-center gap-2">{children}</div>
    {checked && <span className="text-small">✓</span>}
  </DropdownItem>
);

// Aliases for compatibility + strict HeroUI v3 exports
// DropdownMenuContent removed in favor of strict composition: <DropdownPopover><HeroDropdownMenu>...</HeroDropdownMenu></DropdownPopover>

const DropdownMenu = Dropdown;
const DropdownMenuTrigger = DropdownTrigger;
const DropdownMenuGroup = DropdownSection;
const DropdownMenuItem = DropdownItem;

const DropdownMenuSeparator = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div className={cn("-mx-1 my-1 h-px bg-default-200/50", className)} {...props} />
);

const DropdownMenuLabel = ({
  className,
  inset,
  ...props
}: React.ComponentProps<"div"> & { inset?: boolean }) => (
  <div className={cn("px-2 py-1.5 text-sm font-semibold", inset && "pl-8", className)} {...props} />
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

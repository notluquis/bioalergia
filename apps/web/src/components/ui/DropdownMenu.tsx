import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import * as React from "react";

import { cn } from "@/lib/utils";

const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuGroup = DropdownMenuPrimitive.Group;
const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

const DropdownMenuContent = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      className={cn(
        "bg-base-100 border-base-200 text-base-content z-50 min-w-32 overflow-hidden rounded-xl border p-1 shadow-lg",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
        "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      ref={ref}
      sideOffset={sideOffset}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownMenuItem = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    className={cn(
      "focus:bg-base-200 focus:text-base-content relative flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors outline-none select-none",
      "data-disabled:pointer-events-none data-disabled:opacity-50",
      inset && "pl-8",
      className
    )}
    ref={ref}
    {...props}
  />
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

const DropdownMenuSeparator = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator className={cn("bg-base-200 -mx-1 my-1 h-px", className)} ref={ref} {...props} />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

const DropdownMenuLabel = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    className={cn("px-2 py-1.5 text-sm font-semibold", inset && "pl-8", className)}
    ref={ref}
    {...props}
  />
));
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ checked, children, className, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    checked={checked}
    className={cn(
      "focus:bg-base-200 focus:text-base-content relative flex cursor-pointer items-center rounded-lg py-2 pr-2 pl-8 text-sm transition-colors outline-none select-none",
      "data-disabled:pointer-events-none data-disabled:opacity-50",
      className
    )}
    ref={ref}
    {...props}
  >
    <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
      <div
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded border transition-colors",
          checked ? "border-primary bg-primary text-primary-content" : "border-base-content/30 bg-base-100"
        )}
      >
        <DropdownMenuPrimitive.ItemIndicator>
          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </DropdownMenuPrimitive.ItemIndicator>
      </div>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName = DropdownMenuPrimitive.CheckboxItem.displayName;

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

import {
  Description,
  FieldError,
  Select as HeroSelect,
  type SelectProps as HeroSelectProps,
  Label,
  ListBox,
  ListBoxItem,
  type ListBoxItemProps,
  SelectIndicator,
  SelectPopover,
  SelectTrigger,
  SelectValue,
} from "@heroui/react";
import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

export interface SelectProps<T extends object = object>
  extends Omit<HeroSelectProps<T>, "children"> {
  label?: string;
  placeholder?: string;
  description?: string;
  /**
   * Helper text - maps to description
   */
  helper?: string;
  errorMessage?: string;
  children: ReactNode;
  className?: string;
}

function SelectBase<T extends object>({
  label,
  placeholder,
  description,
  helper,
  errorMessage,
  children,
  className,
  isInvalid,
  ...props
}: SelectProps<T> & { value?: string | number; onChange?: (val: any) => void }) {
  const hasError = isInvalid || !!errorMessage;

  // Map legacy value/onChange to HeroUI selectedKey/onSelectionChange if provided
  const selectedKey = props.selectedKey ?? props.value;
  const onSelectionChange =
    props.onSelectionChange ?? (props.onChange ? (key: any) => props.onChange?.(key) : undefined);

  return (
    <HeroSelect
      className={cn("w-full", className)}
      isInvalid={hasError}
      placeholder={placeholder}
      {...props}
      onSelectionChange={onSelectionChange}
      selectedKey={selectedKey}
    >
      {label && (
        <Label className="text-default-600 font-semibold uppercase tracking-wider">{label}</Label>
      )}
      <SelectTrigger>
        <SelectValue />
        <SelectIndicator />
      </SelectTrigger>
      {(description || helper) && <Description>{description || helper}</Description>}
      {errorMessage && <FieldError>{errorMessage}</FieldError>}
      <SelectPopoverFixed>
        <ListBox>{children}</ListBox>
      </SelectPopoverFixed>
    </HeroSelect>
  );
}

function SelectPopoverFixed({ children, ...props }: any) {
  return (
    <SelectPopover {...props} {...({ isNonModal: true } as any)}>
      <SelectPortal>{children}</SelectPortal>
    </SelectPopover>
  );
}

export const Select = Object.assign(SelectBase, {
  Indicator: SelectIndicator,
  Item: ListBoxItem,
  Popover: SelectPopoverFixed,
  Trigger: SelectTrigger,
  Value: SelectValue,
});

function SelectPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(() => typeof document !== "undefined");

  useEffect(() => {
    if (!mounted) setMounted(true);
  }, [mounted]);

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

export interface SelectItemProps extends ListBoxItemProps {
  /**
   * Alias for id - used for backward compatibility with older Select components
   */
  key?: string | number;
}

export function SelectItem({ children, ...props }: SelectItemProps) {
  const { id, key, ...rest } = props as any;

  return (
    <ListBoxItem id={id ?? key} {...rest}>
      {children}
    </ListBoxItem>
  );
}

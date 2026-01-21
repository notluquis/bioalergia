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
import type React from "react";

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
  children: React.ReactNode;
  className?: string;
}

export function Select<T extends object>({
  label,
  placeholder,
  description,
  helper,
  errorMessage,
  children,
  className,
  isInvalid,
  ...props
}: SelectProps<T>) {
  const hasError = isInvalid || !!errorMessage;

  return (
    <HeroSelect
      className={cn("w-full", className)}
      isInvalid={hasError}
      placeholder={placeholder}
      {...props}
    >
      {label && <Label>{label}</Label>}
      <SelectTrigger>
        <SelectValue />
        <SelectIndicator />
      </SelectTrigger>
      {(description || helper) && <Description>{description || helper}</Description>}
      {errorMessage && <FieldError>{errorMessage}</FieldError>}
      <SelectPopover>
        <ListBox>{children}</ListBox>
      </SelectPopover>
    </HeroSelect>
  );
}

export interface SelectItemProps extends ListBoxItemProps {}

export function SelectItem({ children, ...props }: SelectItemProps) {
  return (
    <ListBoxItem
      {...props}
      // Automate textValue if simpler children?
      // Consumers should pass textValue if children is not string.
    >
      {children}
    </ListBoxItem>
  );
}

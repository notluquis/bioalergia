import {
  Description,
  FieldError,
  Select as HeroSelect,
  type SelectProps as HeroSelectProps,
  Label,
  ListBox,
  ListBoxItem,
} from "@heroui/react";
import type { ReactNode } from "react";

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
}: SelectProps<T> & {
  value?: HeroSelectProps<T>["value"];
  onChange?: HeroSelectProps<T>["onChange"];
}) {
  const hasError = isInvalid || Boolean(errorMessage);
  const hasValueProp = Object.hasOwn(props, "value");

  // Map controlled value/onChange to HeroUI value/onChange
  const { value, onChange, ...restProps } = props;
  const mappedProps: HeroSelectProps<T> = { ...restProps };
  if (hasValueProp) {
    mappedProps.value = value !== undefined && value !== "" ? value : null;
  }
  if (onChange) {
    mappedProps.onChange = onChange;
  }

  return (
    <HeroSelect
      className={cn("w-full", className)}
      isInvalid={hasError}
      placeholder={placeholder}
      {...mappedProps}
    >
      {label && (
        <Label className="font-semibold text-default-600 uppercase tracking-wider">{label}</Label>
      )}
      <HeroSelect.Trigger>
        <HeroSelect.Value />
        <HeroSelect.Indicator />
      </HeroSelect.Trigger>
      {(description || helper) && <Description>{description || helper}</Description>}
      {errorMessage && <FieldError>{errorMessage}</FieldError>}
      <HeroSelect.Popover>
        <ListBox>{children}</ListBox>
      </HeroSelect.Popover>
    </HeroSelect>
  );
}

export const Select = Object.assign(SelectBase, {
  Indicator: HeroSelect.Indicator,
  Item: ListBoxItem,
  Trigger: HeroSelect.Trigger,
  Value: HeroSelect.Value,
});

export const SelectItem = ListBoxItem;

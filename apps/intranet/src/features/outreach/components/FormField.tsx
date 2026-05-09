import { Input, Label, ListBox, Select, TextArea, TextField } from "@heroui/react";
import type { ReactNode } from "react";

export type SelectOption = { value: string; label: string };

type FieldVariant = "primary" | "secondary";

export type TextInputProps = {
  label?: string;
  value: string | number | null | undefined;
  onValueChange: (value: string) => void;
  type?: "text" | "email" | "url" | "number" | "datetime-local";
  required?: boolean;
  isDisabled?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  defaultValue?: string;
  className?: string;
  variant?: FieldVariant;
  onBlur?: () => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
};

export function TextInput({
  label,
  value,
  onValueChange,
  type = "text",
  required,
  isDisabled,
  placeholder,
  min,
  max,
  defaultValue,
  className,
  variant = "secondary",
  onBlur,
  onKeyDown,
}: TextInputProps) {
  return (
    <TextField
      value={value == null ? "" : String(value)}
      defaultValue={defaultValue}
      onChange={onValueChange}
      type={type}
      isRequired={required}
      isDisabled={isDisabled}
      onBlur={onBlur}
      className={className}
    >
      {label && <Label>{label}</Label>}
      <Input
        variant={variant}
        placeholder={placeholder}
        min={min}
        max={max}
        onKeyDown={onKeyDown}
      />
    </TextField>
  );
}

export type TextAreaInputProps = {
  label?: string;
  value: string;
  onValueChange: (value: string) => void;
  rows?: number;
  required?: boolean;
  isDisabled?: boolean;
  placeholder?: string;
  className?: string;
  variant?: FieldVariant;
  onBlur?: () => void;
};

export function TextAreaInput({
  label,
  value,
  onValueChange,
  rows = 4,
  required,
  isDisabled,
  placeholder,
  className,
  variant = "secondary",
  onBlur,
}: TextAreaInputProps) {
  return (
    <TextField
      value={value}
      onChange={onValueChange}
      isRequired={required}
      isDisabled={isDisabled}
      onBlur={onBlur}
      className={className}
    >
      {label && <Label>{label}</Label>}
      <TextArea variant={variant} rows={rows} placeholder={placeholder} />
    </TextField>
  );
}

export type SelectInputProps = {
  label?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  isDisabled?: boolean;
  className?: string;
};

export function SelectInput({
  label,
  value,
  onValueChange,
  options,
  isDisabled,
  className,
}: SelectInputProps) {
  return (
    <Select
      value={value}
      onChange={(key) => onValueChange(typeof key === "string" ? key : "")}
      isDisabled={isDisabled}
      className={className}
    >
      {label && <Label>{label}</Label>}
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((opt) => (
            <ListBox.Item key={opt.value} id={opt.value}>
              {opt.label}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

export function FieldGroup({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{children}</div>;
}

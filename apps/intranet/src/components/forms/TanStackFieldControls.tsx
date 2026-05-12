import {
  Description,
  FieldError,
  Input,
  Label,
  ListBox,
  Select,
  TextArea,
  TextField,
} from "@heroui/react";
import type { Updater } from "@tanstack/react-form";

interface TanStackFieldLike<TValue> {
  handleBlur: () => void;
  handleChange: (updater: Updater<TValue>) => void;
  state: {
    meta: { errors: unknown[] };
    value: TValue;
  };
}

interface TanStackInputFieldProps<TValue> {
  className?: string;
  description?: string;
  emptyAsUndefined?: boolean;
  field: TanStackFieldLike<TValue>;
  label: string;
  onBlur?: () => void;
  placeholder?: string;
  required?: boolean;
  transformOnChange?: (value: string) => string;
  type?: string;
}

interface TanStackSelectFieldProps<TValue> {
  description?: string;
  emptyOption?: { label: string; value: string };
  field: TanStackFieldLike<TValue>;
  isDisabled?: boolean;
  label: string;
  options: Array<{ label: string; value: string }>;
  placeholder?: string;
  required?: boolean;
}

interface TanStackTextAreaFieldProps<TValue> {
  className?: string;
  emptyAsUndefined?: boolean;
  field: TanStackFieldLike<TValue>;
  label: string;
  placeholder?: string;
  required?: boolean;
  rows?: number;
}

const getFieldError = (errors: unknown[]) => {
  const [firstError] = errors;
  if (typeof firstError === "string") {
    return firstError;
  }
  return firstError ? JSON.stringify(firstError) : "";
};

export function TanStackInputField<TValue>({
  className,
  description,
  emptyAsUndefined = false,
  field,
  label,
  onBlur,
  placeholder,
  required,
  transformOnChange,
  type = "text",
}: Readonly<TanStackInputFieldProps<TValue>>) {
  const errorText = getFieldError(field.state.meta.errors);
  const inputValue = typeof field.state.value === "string" ? field.state.value : "";
  return (
    <TextField
      isInvalid={Boolean(errorText)}
      isRequired={required}
      type={type}
      value={inputValue}
      onChange={(value) => {
        const nextValue = transformOnChange ? transformOnChange(value) : value;
        const normalizedValue = emptyAsUndefined && nextValue.length === 0 ? undefined : nextValue;
        field.handleChange(() => normalizedValue as TValue);
      }}
    >
      <Label>{label}</Label>
      <Input
        className={className}
        onBlur={() => {
          field.handleBlur();
          onBlur?.();
        }}
        placeholder={placeholder}
      />
      {description ? <Description>{description}</Description> : null}
      {errorText ? <FieldError>{errorText}</FieldError> : null}
    </TextField>
  );
}

export function TanStackTextAreaField<TValue>({
  className,
  emptyAsUndefined = false,
  field,
  label,
  placeholder,
  required,
  rows = 3,
}: Readonly<TanStackTextAreaFieldProps<TValue>>) {
  const errorText = getFieldError(field.state.meta.errors);
  const textValue = typeof field.state.value === "string" ? field.state.value : "";
  return (
    <TextField
      isInvalid={Boolean(errorText)}
      isRequired={required}
      value={textValue}
      onChange={(value) => {
        const normalizedValue = emptyAsUndefined && value.length === 0 ? undefined : value;
        field.handleChange(() => normalizedValue as TValue);
      }}
    >
      <Label>{label}</Label>
      <TextArea
        className={className}
        onBlur={field.handleBlur}
        placeholder={placeholder}
        rows={rows}
      />
      {errorText ? <FieldError>{errorText}</FieldError> : null}
    </TextField>
  );
}

export function TanStackSelectField<TValue>({
  description,
  emptyOption,
  field,
  isDisabled,
  label,
  options,
  placeholder,
  required,
}: Readonly<TanStackSelectFieldProps<TValue>>) {
  const errorText = getFieldError(field.state.meta.errors);
  const selectedValue =
    (typeof field.state.value === "string" && field.state.value.length > 0
      ? field.state.value
      : emptyOption?.value) ?? null;

  return (
    <Select
      isDisabled={isDisabled}
      isInvalid={Boolean(errorText)}
      isRequired={required}
      onChange={(value) => {
        if (value === null) {
          field.handleChange(() => "" as TValue);
          field.handleBlur();
          return;
        }
        const next = String(value);
        field.handleChange(() => (emptyOption && next === emptyOption.value ? "" : next) as TValue);
        field.handleBlur();
      }}
      placeholder={placeholder}
      value={selectedValue}
    >
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {emptyOption ? (
            <ListBox.Item id={emptyOption.value} textValue={emptyOption.label}>
              {emptyOption.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ) : null}
          {options.map((option) => (
            <ListBox.Item id={option.value} key={option.value} textValue={option.label}>
              {option.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
      {description ? <Description>{description}</Description> : null}
      {errorText ? <FieldError>{errorText}</FieldError> : null}
    </Select>
  );
}

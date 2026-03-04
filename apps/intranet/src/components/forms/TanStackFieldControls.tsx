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
  emptyOption?: { label: string; value: string };
  field: TanStackFieldLike<TValue>;
  label: string;
  options: Array<{ label: string; value: string }>;
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
  return firstError ? String(firstError) : "";
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
    <TextField isInvalid={Boolean(errorText)} isRequired={required} type={type}>
      <Label>{label}</Label>
      <Input
        className={className}
        onBlur={() => {
          field.handleBlur();
          onBlur?.();
        }}
        onChange={(event) => {
          const nextValue = transformOnChange
            ? transformOnChange(event.target.value)
            : event.target.value;
          const normalizedValue =
            emptyAsUndefined && nextValue.length === 0 ? undefined : nextValue;
          field.handleChange(() => normalizedValue as TValue);
        }}
        placeholder={placeholder}
        value={inputValue}
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
    <TextField isInvalid={Boolean(errorText)} isRequired={required}>
      <Label>{label}</Label>
      <TextArea
        className={className}
        onBlur={field.handleBlur}
        onChange={(event) => {
          const nextValue = event.target.value;
          const normalizedValue =
            emptyAsUndefined && nextValue.length === 0 ? undefined : nextValue;
          field.handleChange(() => normalizedValue as TValue);
        }}
        placeholder={placeholder}
        rows={rows}
        value={textValue}
      />
      {errorText ? <FieldError>{errorText}</FieldError> : null}
    </TextField>
  );
}

export function TanStackSelectField<TValue>({
  emptyOption,
  field,
  label,
  options,
  required,
}: Readonly<TanStackSelectFieldProps<TValue>>) {
  const errorText = getFieldError(field.state.meta.errors);
  const selectedValue =
    (typeof field.state.value === "string" && field.state.value.length > 0
      ? field.state.value
      : emptyOption?.value) ?? null;

  return (
    <Select
      isInvalid={Boolean(errorText)}
      isRequired={required}
      onBlur={field.handleBlur}
      onChange={(key) => {
        if (!key) {
          field.handleChange(() => "" as TValue);
          return;
        }
        const next = String(key);
        field.handleChange(() => (emptyOption && next === emptyOption.value ? "" : next) as TValue);
      }}
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
            <ListBox.Item id={emptyOption.value}>{emptyOption.label}</ListBox.Item>
          ) : null}
          {options.map((option) => (
            <ListBox.Item id={option.value} key={option.value}>
              {option.label}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
      {errorText ? <FieldError>{errorText}</FieldError> : null}
    </Select>
  );
}

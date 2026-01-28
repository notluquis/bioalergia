import { Input as HeroInput, TextArea as HeroTextArea } from "@heroui/react";
import { Eye, EyeOff } from "lucide-react";
import React from "react";

import { cn } from "@/lib/utils";

// Legacy sizing mapping
const SIZE_MAPPING = {
  xs: "sm",
  sm: "sm",
  md: "md",
  lg: "lg",
} as const;

interface InputBaseProps {
  containerClassName?: string;
  error?: string; // Mapped to isInvalid + errorMessage
  helper?: string; // Mapped to description
  label?: string;
  placeholder?: string; // Explicitly added to base props
  rightElement?: React.ReactNode;
  size?: "xs" | "sm" | "md" | "lg";
  type?: string;
}

// Combine strict input props with our base props
type InputProps = InputBaseProps &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & {
    enterKeyHint?: "done" | "enter" | "go" | "next" | "previous" | "search" | "send";
    inputMode?: "decimal" | "email" | "none" | "numeric" | "search" | "tel" | "text" | "url";
  };

type SelectProps = InputBaseProps & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size">;
type TextareaProps = InputBaseProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>;

type Props =
  | (InputProps & { as?: "input" })
  | (SelectProps & { as: "select" })
  | (TextareaProps & { as: "textarea" });

// Helper: Create password toggle button
const createPasswordToggle = (isVisible: boolean, onToggle: () => void) => (
  <button
    aria-label="Toggle password visibility"
    className="text-default-400 hover:text-default-600 focus:outline-none"
    onClick={onToggle}
    type="button"
  >
    {isVisible ? <EyeOff size={18} /> : <Eye size={18} />}
  </button>
);

// Helper: Render textarea with HeroUI
const renderTextarea = (props: {
  className?: string;
  containerClassName?: string;
  error?: string;
  helper?: string;
  label?: string;
  placeholder?: string;
  size: "xs" | "sm" | "md" | "lg";
  rest: React.TextareaHTMLAttributes<HTMLTextAreaElement>;
}) => {
  const { className, containerClassName, error, helper, label, placeholder, size, rest } = props;
  // biome-ignore lint/suspicious/noExplicitAny: Resolving complex union type issues
  const { ref: _ref, ...textareaRest } = rest as any;
  return (
    <div className={cn("w-full", containerClassName)}>
      <HeroTextArea
        classNames={{
          base: className,
          input: cn("text-foreground", size === "xs" && "text-xs"),
        }}
        description={helper}
        errorMessage={error}
        isInvalid={!!error}
        label={label}
        labelPlacement="outside"
        placeholder={placeholder}
        {...textareaRest}
      />
    </div>
  );
};

// Helper: Render native select (temporary until HeroUI migration)
const renderSelect = (props: {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  error?: string;
  helper?: string;
  label?: string;
  rest: React.SelectHTMLAttributes<HTMLSelectElement>;
  selectId: string;
  size: "xs" | "sm" | "md" | "lg";
}) => {
  const { children, className, containerClassName, error, helper, label, rest, selectId, size } =
    props;
  return (
    <div className={cn("form-control w-full", containerClassName)}>
      {label && (
        <label htmlFor={selectId} className="label pt-0 pb-1.5 pl-1">
          <span className="label-text text-default-600 text-xs font-semibold uppercase tracking-wider">
            {label}
          </span>
        </label>
      )}
      <select
        id={selectId}
        className={cn(
          "select select-bordered bg-background/50 hover:bg-background focus:bg-background w-full transition-all",
          size === "xs" && "select-xs text-xs",
          size === "sm" && "select-sm text-sm",
          size === "md" && "min-h-10 text-sm",
          size === "lg" && "select-lg text-base",
          error && "select-error focus:ring-error/20 focus:border-danger focus:ring-2",
          className,
        )}
        {...(rest as React.SelectHTMLAttributes<HTMLSelectElement>)}
      >
        {children}
      </select>
      {(error || helper) && (
        <div className="label pb-0 pt-1">
          <span
            className={cn("label-text-alt text-xs", error ? "text-danger" : "text-default-500")}
          >
            {error || helper}
          </span>
        </div>
      )}
    </div>
  );
};

// Helper: Render input with HeroUI
const renderInput = (props: {
  className?: string;
  containerClassName?: string;
  endContent: React.ReactNode;
  error?: string;
  helper?: string;
  heroSize: "sm" | "md" | "lg";
  inputType?: string;
  label?: string;
  placeholder?: string;
  rest: React.InputHTMLAttributes<HTMLInputElement>;
  size: "xs" | "sm" | "md" | "lg";
}) => {
  const {
    className,
    containerClassName,
    endContent,
    error,
    helper,
    heroSize,
    inputType,
    label,
    placeholder,
    rest,
    size,
  } = props;
  // biome-ignore lint/suspicious/noExplicitAny: Resolving complex union type issues
  const { ref: _ref, ...inputRest } = rest as any;

  return (
    <div className={cn("w-full!", containerClassName)}>
      <HeroInput
        classNames={{
          base: cn("w-full", className),
          input: cn("text-foreground", size === "xs" && "text-xs"),
          label: "text-default-600 font-semibold uppercase tracking-wider",
        }}
        description={helper}
        endContent={endContent}
        errorMessage={error}
        isInvalid={!!error}
        label={label}
        labelPlacement="outside"
        placeholder={placeholder}
        // biome-ignore lint/suspicious/noExplicitAny: HeroUI beta type conflict
        size={heroSize as any}
        type={inputType}
        {...inputRest}
      />
    </div>
  );
};

export default function Input(props: Props) {
  const {
    as = "input",
    className,
    containerClassName,
    error,
    helper,
    label,
    size = "md",
    type,
    ...rest
  } = props;

  const [isPasswordVisible, setIsPasswordVisible] = React.useState(false);
  const selectId = React.useId(); // Always call hooks at top level
  const isPassword = type === "password";
  const inputType = isPassword && isPasswordVisible ? "text" : type;
  const heroSize = SIZE_MAPPING[size] || "md";
  const toggleVisibility = () => setIsPasswordVisible(!isPasswordVisible);

  const endContent =
    props.rightElement ??
    (isPassword ? createPasswordToggle(isPasswordVisible, toggleVisibility) : null);

  // --- RENDER: TEXTAREA ---
  if (as === "textarea") {
    return renderTextarea({
      className,
      containerClassName,
      error,
      helper,
      label,
      placeholder: props.placeholder,
      size,
      rest: rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    });
  }

  // --- RENDER: SELECT (Temporary Native Callback) ---
  if (as === "select") {
    return renderSelect({
      children: props.children,
      className,
      containerClassName,
      error,
      helper,
      label,
      rest: rest as React.SelectHTMLAttributes<HTMLSelectElement>,
      selectId,
      size,
    });
  }

  // --- RENDER: INPUT (HeroUI) ---
  return renderInput({
    className,
    containerClassName,
    endContent,
    error,
    helper,
    heroSize,
    inputType,
    label,
    placeholder: props.placeholder,
    rest: rest as React.InputHTMLAttributes<HTMLInputElement>,
    size,
  });
}

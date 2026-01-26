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
  const isPassword = type === "password";
  const inputType = isPassword && isPasswordVisible ? "text" : type;

  const heroSize = SIZE_MAPPING[size] || "md";

  // Password Toggle Logic
  const toggleVisibility = () => setIsPasswordVisible(!isPasswordVisible);

  const endContent =
    props.rightElement ??
    (isPassword ? (
      <button
        aria-label="Toggle password visibility"
        className="text-default-400 hover:text-default-600 focus:outline-none"
        onClick={toggleVisibility}
        type="button"
      >
        {isPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    ) : null);

  // --- RENDER: TEXTAREA ---
  if (as === "textarea") {
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
          placeholder={props.placeholder}
          {...textareaRest}
        />
      </div>
    );
  }

  // --- RENDER: SELECT (Temporary Native Callback) ---
  // We keep this native style for now until we migrate all 35+ files to use HeroUI <Select> + <SelectItem>
  if (as === "select") {
    return (
      <div className={cn("form-control w-full", containerClassName)}>
        {label && (
          <label className="label pt-0 pb-1.5 pl-1">
            <span className="label-text text-default-600 text-xs font-semibold uppercase tracking-wider">
              {label}
            </span>
          </label>
        )}
        <select
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
          {props.children}
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
  }

  // --- RENDER: INPUT (HeroUI) ---
  // biome-ignore lint/suspicious/noExplicitAny: Resolving complex union type issues
  const { ref: _ref, ...inputRest } = rest as any;

  return (
    <div className={cn("w-full", containerClassName)}>
      <HeroInput
        classNames={{
          base: className,
          input: cn("text-foreground", size === "xs" && "text-xs"),
          label: "text-default-600 font-semibold uppercase tracking-wider",
        }}
        description={helper}
        endContent={endContent}
        errorMessage={error}
        isInvalid={!!error}
        label={label}
        labelPlacement="outside"
        placeholder={props.placeholder}
        // biome-ignore lint/suspicious/noExplicitAny: HeroUI beta type conflict
        size={heroSize as any}
        type={inputType}
        {...inputRest}
      />
    </div>
  );
}

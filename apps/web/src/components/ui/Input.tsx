import { Eye, EyeOff } from "lucide-react";
import React from "react";

import { cn } from "@/lib/utils";

// Constants extracted outside component to reduce complexity
const SIZE_CLASSES = {
  xs: "input-xs h-6 text-xs",
  sm: "input-sm h-8 text-sm",
  md: "h-10 text-sm",
  lg: "input-lg h-12 text-base",
} as const;

const SELECT_SIZE_CLASSES = {
  xs: "select-xs h-6 text-xs",
  sm: "select-sm h-8 text-sm",
  md: "h-10 text-sm",
  lg: "select-lg h-12 text-base",
} as const;

const BASE_CLASSES =
  "w-full transition-all duration-200 ease-apple placeholder:text-base-content/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary";

const LABEL_CLASSES = "label pt-0 pb-2";
const LABEL_TEXT_CLASSES = "label-text text-xs font-semibold uppercase tracking-wider text-base-content/70 ml-1";

type InputSize = "xs" | "sm" | "md" | "lg";

type InputBaseProps = {
  label?: string;
  helper?: string;
  error?: string;
  containerClassName?: string;
  rightElement?: React.ReactNode;
  type?: string;
  size?: InputSize;
};

type InputProps = InputBaseProps &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & {
    inputMode?: "none" | "text" | "decimal" | "numeric" | "tel" | "search" | "email" | "url";
    enterKeyHint?: "enter" | "done" | "go" | "next" | "previous" | "search" | "send";
  };
type TextareaProps = InputBaseProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>;
type SelectProps = InputBaseProps & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size">;

type Props = ({ as?: "input" } & InputProps) | ({ as: "textarea" } & TextareaProps) | ({ as: "select" } & SelectProps);

// Helper to get error classes for any input type
const getErrorClasses = (inputType: "input" | "textarea" | "select") =>
  `${inputType}-error focus:ring-error/20 focus:border-error`;

export default function Input(props: Props) {
  const { label, helper, error, className, containerClassName, as = "input", type, size = "md", ...rest } = props;
  const [isPasswordVisible, setIsPasswordVisible] = React.useState(false);

  const generatedId = React.useId();
  const inputId = rest.id || generatedId;
  const helperId = `${inputId}-helper`;
  const errorId = `${inputId}-error`;

  const isPassword = type === "password";
  const inputType = isPassword && isPasswordVisible ? "text" : type;

  const inputClasses = cn(
    "input input-bordered bg-base-100/50 hover:bg-base-100 focus:bg-base-100",
    SIZE_CLASSES[size],
    error && getErrorClasses("input"),
    (isPassword || props.rightElement) && "pr-14",
    BASE_CLASSES,
    className
  );

  const textareaClasses = cn(
    "textarea textarea-bordered bg-base-100/50 hover:bg-base-100 focus:bg-base-100 min-h-25 py-2",
    size === "xs" || size === "sm" ? "text-xs" : "text-sm",
    error && getErrorClasses("textarea"),
    BASE_CLASSES,
    className
  );

  const selectClasses = cn(
    "select select-bordered bg-base-100/50 hover:bg-base-100 focus:bg-base-100",
    SELECT_SIZE_CLASSES[size],
    error && getErrorClasses("select"),
    BASE_CLASSES,
    className
  );

  const helperClasses = cn("label-text-alt mt-1.5 ml-1 text-xs text-base-content/70", error && "text-error");

  // Compute aria-describedby without nested ternary
  let describedById: string | undefined;
  if (error) {
    describedById = errorId;
  } else if (helper) {
    describedById = helperId;
  }

  const ariaProps = {
    id: inputId,
    "aria-describedby": describedById,
    "aria-invalid": error ? true : undefined,
  };

  // Render control based on type using if-else
  let control: React.ReactNode;
  if (as === "textarea") {
    control = (
      <textarea
        className={textareaClasses}
        {...ariaProps}
        {...(rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
      />
    );
  } else if (as === "select") {
    control = (
      <select className={selectClasses} {...ariaProps} {...(rest as React.SelectHTMLAttributes<HTMLSelectElement>)}>
        {props.children}
      </select>
    );
  } else {
    control = (
      <input
        type={inputType}
        className={inputClasses}
        {...ariaProps}
        {...(rest as React.InputHTMLAttributes<HTMLInputElement>)}
      />
    );
  }

  const rightContent =
    props.rightElement ??
    (isPassword && (
      <button
        type="button"
        onClick={() => setIsPasswordVisible((v) => !v)}
        className="text-base-content/60 hover:text-base-content hover:bg-base-200/50 rounded-full p-1 transition-colors focus:outline-none"
        tabIndex={-1}
        aria-label={isPasswordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
      >
        {isPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    ));

  const controlWithRight = rightContent ? (
    <div className="relative flex items-center">
      {control}
      <div className="absolute right-10 flex items-center justify-center">{rightContent}</div>
    </div>
  ) : (
    control
  );

  return (
    <div className={cn("form-control w-full", containerClassName)}>
      {label && (
        <label htmlFor={inputId} className={LABEL_CLASSES}>
          <span className={LABEL_TEXT_CLASSES}>{label}</span>
        </label>
      )}

      {controlWithRight}

      {(helper || error) && (
        <div className="label pt-0 pb-0">
          <span id={describedById} className={helperClasses}>
            {error || helper}
          </span>
        </div>
      )}
    </div>
  );
}

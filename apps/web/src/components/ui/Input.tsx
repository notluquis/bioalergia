import { Eye, EyeOff } from "lucide-react";
import React from "react";

import { cn } from "@/lib/utils";

// Constants extracted outside component to reduce complexity
const SIZE_CLASSES = {
  lg: "input-lg h-12 text-base",
  md: "h-10 text-sm",
  sm: "input-sm h-8 text-sm",
  xs: "input-xs h-6 text-xs",
} as const;

const SELECT_SIZE_CLASSES = {
  lg: "select-lg h-12 text-base",
  md: "h-10 text-sm",
  sm: "select-sm h-8 text-sm",
  xs: "select-xs h-6 text-xs",
} as const;

const BASE_CLASSES =
  "w-full transition-all duration-200 ease-apple placeholder:text-base-content/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary";

const LABEL_CLASSES = "label pt-0 pb-2";
const LABEL_TEXT_CLASSES = "label-text text-xs font-semibold uppercase tracking-wider text-base-content/70 ml-1";

interface InputBaseProps {
  containerClassName?: string;
  error?: string;
  helper?: string;
  label?: string;
  rightElement?: React.ReactNode;
  size?: InputSize;
  type?: string;
}

type InputProps = InputBaseProps &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & {
    enterKeyHint?: "done" | "enter" | "go" | "next" | "previous" | "search" | "send";
    inputMode?: "decimal" | "email" | "none" | "numeric" | "search" | "tel" | "text" | "url";
  };

type InputSize = "lg" | "md" | "sm" | "xs";
type Props = (InputProps & { as?: "input" }) | (SelectProps & { as: "select" }) | (TextareaProps & { as: "textarea" });
type SelectProps = InputBaseProps & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size">;

type TextareaProps = InputBaseProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>;

// Helper to get error classes for any input type
const getErrorClasses = (inputType: "input" | "select" | "textarea") =>
  `${inputType}-error focus:ring-error/20 focus:border-error`;

// Helper to determine aria-describedby
const getDescribedById = (error?: string, helper?: string, inputId?: string) => {
  if (error) return `${inputId}-error`;
  return helper ? `${inputId}-helper` : undefined;
};

export default function Input(props: Props) {
  const { as = "input", className, containerClassName, error, helper, label, size = "md", type, ...rest } = props;
  const [isPasswordVisible, setIsPasswordVisible] = React.useState(false);

  const generatedId = React.useId();
  const inputId = rest.id ?? generatedId;

  const isPassword = type === "password";
  const inputType = isPassword && isPasswordVisible ? "text" : type;

  const inputClasses = cn(
    "input input-bordered bg-base-100/50 hover:bg-base-100 focus:bg-base-100",
    // eslint-disable-next-line security/detect-object-injection
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
    // eslint-disable-next-line security/detect-object-injection
    SELECT_SIZE_CLASSES[size],
    error && getErrorClasses("select"),
    BASE_CLASSES,
    className
  );

  const helperClasses = cn("label-text-alt mt-1.5 ml-1 text-xs text-base-content/70", error && "text-error");

  const describedById = getDescribedById(error, helper, inputId);
  const ariaProps = {
    "aria-describedby": describedById,
    "aria-invalid": error ? true : undefined,
    id: inputId,
  };

  // Render control helper
  const renderControl = () => {
    if (as === "textarea") {
      return (
        <textarea
          className={textareaClasses}
          {...ariaProps}
          {...(rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      );
    }
    if (as === "select") {
      return (
        <select className={selectClasses} {...ariaProps} {...(rest as React.SelectHTMLAttributes<HTMLSelectElement>)}>
          {props.children}
        </select>
      );
    }
    return (
      <input
        className={inputClasses}
        type={inputType}
        {...ariaProps}
        {...(rest as React.InputHTMLAttributes<HTMLInputElement>)}
      />
    );
  };

  const control = renderControl();

  const rightContent =
    props.rightElement ??
    (isPassword && (
      <button
        aria-label={isPasswordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="text-base-content/60 hover:text-base-content hover:bg-base-200/50 rounded-full p-1 transition-colors focus:outline-none"
        onClick={() => {
          setIsPasswordVisible((v) => !v);
        }}
        tabIndex={-1}
        type="button"
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
        <label className={LABEL_CLASSES} htmlFor={inputId}>
          <span className={LABEL_TEXT_CLASSES}>{label}</span>
        </label>
      )}

      {controlWithRight}

      {/* eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing */}
      {(helper || error) && (
        <div className="label pt-0 pb-0">
          <span className={helperClasses} id={describedById}>
            {/* eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing */}
            {error || helper}
          </span>
        </div>
      )}
    </div>
  );
}

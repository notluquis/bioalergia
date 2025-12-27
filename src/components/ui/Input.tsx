import React from "react";
import { cn } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";

type InputBaseProps = {
  label?: string;
  helper?: string;
  error?: string;
  containerClassName?: string;
  rightElement?: React.ReactNode;
  type?: string;
  size?: "xs" | "sm" | "md" | "lg";
};

type InputProps = InputBaseProps &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & {
    inputMode?: "none" | "text" | "decimal" | "numeric" | "tel" | "search" | "email" | "url";
    enterKeyHint?: "enter" | "done" | "go" | "next" | "previous" | "search" | "send";
  };
type TextareaProps = InputBaseProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>;
type SelectProps = InputBaseProps & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size">;

// Discriminated union for props
type Props = ({ as?: "input" } & InputProps) | ({ as: "textarea" } & TextareaProps) | ({ as: "select" } & SelectProps);

export default function Input(props: Props) {
  const { label, helper, error, className, containerClassName, as = "input", type, size = "md", ...rest } = props;
  const [isPasswordVisible, setIsPasswordVisible] = React.useState(false);

  const isPassword = type === "password";
  const inputType = isPassword ? (isPasswordVisible ? "text" : "password") : type;

  const sizeClasses = {
    xs: "input-xs h-6 text-xs",
    sm: "input-sm h-8 text-sm",
    md: "h-10 text-sm", // Default compact
    lg: "input-lg h-12 text-base",
  };

  const selectSizeClasses = {
    xs: "select-xs h-6 text-xs",
    sm: "select-sm h-8 text-sm",
    md: "h-10 text-sm",
    lg: "select-lg h-12 text-base",
  };

  const baseClasses =
    "w-full transition-all duration-200 ease-apple placeholder:text-base-content/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary";

  const inputClasses = cn(
    "input input-bordered bg-base-100/50 hover:bg-base-100 focus:bg-base-100",
    sizeClasses[size],
    error && "input-error focus:ring-error/20 focus:border-error",
    (isPassword || props.rightElement) && "pr-14", // Extra padding for toggle + Safari autofill icon
    baseClasses,
    className
  );

  const textareaClasses = cn(
    "textarea textarea-bordered bg-base-100/50 hover:bg-base-100 focus:bg-base-100 min-h-25 py-2",
    size === "xs" || size === "sm" ? "text-xs" : "text-sm",
    error && "textarea-error focus:ring-error/20 focus:border-error",
    baseClasses,
    className
  );

  const selectClasses = cn(
    "select select-bordered bg-base-100/50 hover:bg-base-100 focus:bg-base-100",
    selectSizeClasses[size],
    error && "select-error focus:ring-error/20 focus:border-error",
    baseClasses,
    className
  );

  const labelClasses = "label pt-0 pb-2"; // Increased bottom padding
  const labelTextClasses = "label-text text-xs font-semibold uppercase tracking-wider text-base-content/70 ml-1";
  const helperClasses = cn("label-text-alt mt-1.5 ml-1 text-xs text-base-content/70", error && "text-error");

  let control: React.ReactNode;

  if (as === "textarea") {
    control = <textarea className={textareaClasses} {...(rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>)} />;
  } else if (as === "select") {
    control = (
      <select className={selectClasses} {...(rest as React.SelectHTMLAttributes<HTMLSelectElement>)}>
        {props.children}
      </select>
    );
  } else {
    control = (
      <input type={inputType} className={inputClasses} {...(rest as React.InputHTMLAttributes<HTMLInputElement>)} />
    );
  }

  // Handle right element (either prop or auto-password toggle)
  const rightContent =
    props.rightElement ||
    (isPassword && (
      <button
        type="button"
        onClick={() => setIsPasswordVisible(!isPasswordVisible)}
        className="text-base-content/60 hover:text-base-content hover:bg-base-200/50 rounded-full p-1 transition-colors focus:outline-none"
        tabIndex={-1}
      >
        {isPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    ));

  return (
    <div className={cn("form-control w-full", containerClassName)}>
      {label && (
        <label className={labelClasses}>
          <span className={labelTextClasses}>{label}</span>
        </label>
      )}

      {rightContent ? (
        <div className="relative flex items-center">
          {control}
          <div className="absolute right-10 flex items-center justify-center">{rightContent}</div>
        </div>
      ) : (
        control
      )}

      {(helper || error) && (
        <div className="label pt-0 pb-0">
          <span className={helperClasses}>{error || helper}</span>
        </div>
      )}
    </div>
  );
}

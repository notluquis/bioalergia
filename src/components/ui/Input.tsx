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
};

type InputProps = InputBaseProps &
  React.InputHTMLAttributes<HTMLInputElement> & {
    inputMode?: "none" | "text" | "decimal" | "numeric" | "tel" | "search" | "email" | "url";
    enterKeyHint?: "enter" | "done" | "go" | "next" | "previous" | "search" | "send";
  };
type TextareaProps = InputBaseProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>;
type SelectProps = InputBaseProps & React.SelectHTMLAttributes<HTMLSelectElement>;

// Discriminated union for props
type Props = ({ as?: "input" } & InputProps) | ({ as: "textarea" } & TextareaProps) | ({ as: "select" } & SelectProps);

export default function Input(props: Props) {
  const { label, helper, error, className, containerClassName, as = "input", type, ...rest } = props;
  const [isPasswordVisible, setIsPasswordVisible] = React.useState(false);

  const isPassword = type === "password";
  const inputType = isPassword ? (isPasswordVisible ? "text" : "password") : type;

  const baseClasses =
    "w-full transition-all duration-200 ease-apple placeholder:text-base-content/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary";

  const inputClasses = cn(
    "input input-bordered bg-base-100/50 hover:bg-base-100 focus:bg-base-100 h-12", // Fixed height for better alignment
    error && "input-error focus:ring-error/20 focus:border-error",
    baseClasses,
    className
  );

  const textareaClasses = cn(
    "textarea textarea-bordered bg-base-100/50 hover:bg-base-100 focus:bg-base-100 min-h-25",
    error && "textarea-error focus:ring-error/20 focus:border-error",
    baseClasses,
    className
  );

  const selectClasses = cn(
    "select select-bordered bg-base-100/50 hover:bg-base-100 focus:bg-base-100 h-12",
    error && "select-error focus:ring-error/20 focus:border-error",
    baseClasses,
    className
  );

  const labelClasses = "label pt-0 pb-2"; // Increased bottom padding
  const labelTextClasses = "label-text text-xs font-semibold uppercase tracking-wider text-base-content/60 ml-1";
  const helperClasses = cn("label-text-alt mt-1.5 ml-1 text-xs text-base-content/60", error && "text-error");

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
        className="text-base-content/50 hover:text-base-content hover:bg-base-200/50 rounded-full p-1 transition-colors focus:outline-none"
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
          <div className="absolute right-3 flex items-center justify-center">{rightContent}</div>
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

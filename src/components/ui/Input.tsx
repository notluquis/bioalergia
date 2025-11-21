import React from "react";
import { cn } from "@/lib/utils";

type InputBaseProps = {
  label?: string;
  helper?: string;
  error?: string;
  containerClassName?: string;
};

type InputProps = InputBaseProps & React.InputHTMLAttributes<HTMLInputElement>;
type TextareaProps = InputBaseProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>;
type SelectProps = InputBaseProps & React.SelectHTMLAttributes<HTMLSelectElement>;

// Discriminated union for props
type Props = ({ as?: "input" } & InputProps) | ({ as: "textarea" } & TextareaProps) | ({ as: "select" } & SelectProps);

export default function Input(props: Props) {
  const { label, helper, error, className, containerClassName, as = "input", ...rest } = props;

  const baseClasses =
    "w-full transition-all duration-200 ease-apple placeholder:text-base-content/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary";

  const inputClasses = cn(
    "input input-bordered bg-base-100/50 hover:bg-base-100 focus:bg-base-100",
    error && "input-error focus:ring-error/20 focus:border-error",
    baseClasses,
    className
  );

  const textareaClasses = cn(
    "textarea textarea-bordered bg-base-100/50 hover:bg-base-100 focus:bg-base-100 min-h-[100px]",
    error && "textarea-error focus:ring-error/20 focus:border-error",
    baseClasses,
    className
  );

  const selectClasses = cn(
    "select select-bordered bg-base-100/50 hover:bg-base-100 focus:bg-base-100",
    error && "select-error focus:ring-error/20 focus:border-error",
    baseClasses,
    className
  );

  const labelClasses = "label pt-0 pb-1.5";
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
    control = <input className={inputClasses} {...(rest as React.InputHTMLAttributes<HTMLInputElement>)} />;
  }

  return (
    <div className={cn("form-control w-full", containerClassName)}>
      {label && (
        <label className={labelClasses}>
          <span className={labelTextClasses}>{label}</span>
        </label>
      )}
      {control}
      {(helper || error) && (
        <div className="label pb-0 pt-0">
          <span className={helperClasses}>{error || helper}</span>
        </div>
      )}
    </div>
  );
}

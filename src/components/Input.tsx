import React from "react";

type InputBaseProps = {
  label?: string;
  helper?: string;
  type?: string;
  rows?: number;
};

type InputProps =
  | (InputBaseProps & React.InputHTMLAttributes<HTMLInputElement>)
  | (InputBaseProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>)
  | (InputBaseProps & React.SelectHTMLAttributes<HTMLSelectElement>);

export default function Input(props: InputProps) {
  const { label, helper, type = "text", rows = 3, className = "", children, ...rest } = props;
  const toneClasses =
    "bg-base-100/95 text-base-content placeholder:text-base-content/60 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/40 focus-visible:outline-none transition-colors duration-200";
  // combine daisyUI input classes with tone styling
  const sharedClasses = `input input-bordered w-full ${toneClasses} ${className}`.trim();

  const labelClasses = "form-control text-sm text-base-content";
  const labelTextClasses = "label-text text-xs font-semibold uppercase tracking-wide text-base-content/70";
  const helperClasses = "text-xs text-base-content/60 mt-1";

  let control: React.ReactNode;

  if (type === "textarea") {
    control = (
      <textarea
        rows={rows}
        {...(rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
        className={`textarea textarea-bordered w-full ${toneClasses} ${className}`.trim()}
      />
    );
  } else if (type === "select") {
    control = (
      <select
        {...(rest as React.SelectHTMLAttributes<HTMLSelectElement>)}
        className={`select select-bordered w-full ${toneClasses} ${className}`.trim()}
      >
        {children}
      </select>
    );
  } else {
    control = (
      <input type={type} {...(rest as React.InputHTMLAttributes<HTMLInputElement>)} className={sharedClasses} />
    );
  }

  return (
    <label className={labelClasses}>
      {label && <span className={labelTextClasses}>{label}</span>}
      {control}
      {helper && <span className={helperClasses}>{helper}</span>}
    </label>
  );
}

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
  // combine daisyUI input classes with existing glass styles to preserve branding
  const sharedClasses = `input input-bordered w-full ${className}`.trim();

  const labelClasses = "form-control text-sm text-slate-600";
  const labelTextClasses = "label-text text-xs font-semibold uppercase tracking-wide text-slate-600/90";
  const helperClasses = "text-xs text-slate-500/80 mt-1";

  let control: React.ReactNode;

  if (type === "textarea") {
    control = (
      <textarea
        rows={rows}
        {...(rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
        className={`textarea textarea-bordered w-full ${className}`}
      />
    );
  } else if (type === "select") {
    control = (
      <select {...(rest as React.SelectHTMLAttributes<HTMLSelectElement>)} className={`select select-bordered w-full ${className}`}>
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

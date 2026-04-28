import type { ReactNode } from "react";

const baseInput =
  "w-full rounded-medium border border-default-300 bg-default-50 px-3 py-2 text-sm focus:border-primary focus:outline-none";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-default-700">{label}</span>
      {children}
    </label>
  );
}

export function TextInput(
  props: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
) {
  const { className, invalid, ...rest } = props;
  return (
    <input
      className={`${baseInput} ${invalid ? "border-danger" : ""} ${className ?? ""}`}
      {...rest}
    />
  );
}

export function TextAreaInput(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, ...rest } = props;
  return <textarea className={`${baseInput} font-mono ${className ?? ""}`} {...rest} />;
}

export function NativeSelect(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }
) {
  const { className, children, ...rest } = props;
  return (
    <select className={`${baseInput} ${className ?? ""}`} {...rest}>
      {children}
    </select>
  );
}

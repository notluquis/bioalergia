import { IMaskInput } from "react-imask";
import IMask from "imask";
import { cn } from "@/lib/utils";

interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function TimeInput({ value, onChange, placeholder, className, disabled }: TimeInputProps) {
  return (
    <IMaskInput
      mask="HH:MM"
      blocks={{
        HH: {
          mask: IMask.MaskedRange,
          from: 0,
          to: 23,
          maxLength: 2,
        },
        MM: {
          mask: IMask.MaskedRange,
          from: 0,
          to: 59,
          maxLength: 2,
        },
      }}
      value={value}
      unmask={false}
      onAccept={(value) => onChange(value)}
      placeholder={placeholder || "HH:MM"}
      className={cn("input input-bordered input-sm w-full font-mono text-center", className)}
      disabled={disabled}
      lazy={true}
      autofix={false}
      inputMode="numeric"
    />
  );
}

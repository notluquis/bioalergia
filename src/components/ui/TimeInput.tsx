import { cn } from "@/lib/utils";
import { useCallback, useRef } from "react";

interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Normaliza un input de hora parcial a formato HH:MM
 * - "15" -> "15:00"
 * - "9" -> "09:00"
 * - "15:3" -> "15:30"
 * - "1530" -> "15:30"
 */
function normalizeTimeValue(value: string): string {
  if (!value || value.trim() === "") return "";

  const cleaned = value.replace(/[^0-9:]/g, "");

  // Ya está en formato completo HH:MM
  if (/^\d{1,2}:\d{2}$/.test(cleaned)) {
    const [h, m] = cleaned.split(":");
    const hours = Math.min(23, parseInt(h || "0", 10));
    const minutes = Math.min(59, parseInt(m || "0", 10));
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  }

  // Solo dígitos (ej: "15", "9", "1530", "930")
  const digits = cleaned.replace(/:/g, "");

  if (digits.length === 0) return "";

  if (digits.length === 1) {
    // "9" -> "09:00"
    const hours = Math.min(23, parseInt(digits, 10));
    return `${hours.toString().padStart(2, "0")}:00`;
  }

  if (digits.length === 2) {
    // "15" -> "15:00", "25" -> tratamos como 2 horas 5 minutos? No, asumimos son horas
    const hours = Math.min(23, parseInt(digits, 10));
    return `${hours.toString().padStart(2, "0")}:00`;
  }

  if (digits.length === 3) {
    // "930" -> "09:30" o "153" -> "15:30"
    // Intentamos HMM primero (1 dígito hora, 2 dígitos minutos)
    const h1 = parseInt(digits[0] || "0", 10);
    const m1 = parseInt(digits.slice(1), 10);
    if (h1 <= 9 && m1 <= 59) {
      return `0${h1}:${m1.toString().padStart(2, "0")}`;
    }
    // Fallback: HHM (2 dígitos hora, 1 dígito minutos)
    const h2 = Math.min(23, parseInt(digits.slice(0, 2), 10));
    const m2 = Math.min(59, parseInt(digits[2] + "0", 10));
    return `${h2.toString().padStart(2, "0")}:${m2.toString().padStart(2, "0")}`;
  }

  if (digits.length >= 4) {
    // "1530" -> "15:30"
    const hours = Math.min(23, parseInt(digits.slice(0, 2), 10));
    const minutes = Math.min(59, parseInt(digits.slice(2, 4), 10));
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  }

  return "";
}

export default function TimeInput({ value, onChange, onBlur, placeholder, className, disabled }: TimeInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleBlur = useCallback(() => {
    // Al salir del campo, normalizar el valor (ej: "9" -> "09:00", "930" -> "09:30")
    const normalized = normalizeTimeValue(value);
    if (normalized && normalized !== value) {
      onChange(normalized);
    }
    onBlur?.();
  }, [value, onChange, onBlur]);

  // Use a simple input with pattern matching instead of IMask for more flexibility
  // This allows typing "9" and converting it to "09:00" on blur
  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={handleBlur}
      placeholder={placeholder || "HH:MM"}
      className={cn("input input-bordered input-sm w-full font-mono text-center", className)}
      disabled={disabled}
      inputMode="numeric"
      maxLength={5}
    />
  );
}

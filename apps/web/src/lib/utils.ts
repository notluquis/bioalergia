import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "CLP") {
  try {
    return new Intl.NumberFormat("es-CL", {
      currency: currency,
      style: "currency",
    }).format(amount);
  } catch (_error) {
    // Fallback to CLP if currency code is invalid/malformed
    return new Intl.NumberFormat("es-CL", {
      currency: "CLP",
      style: "currency",
    }).format(amount);
  }
}

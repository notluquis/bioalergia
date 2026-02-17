import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "CLP") {
  // Caso especial para UF (no es código ISO 4217 válido)
  if (currency === "UF") {
    const formatted = new Intl.NumberFormat("es-CL", {
      style: "decimal",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    return `UF ${formatted}`;
  }

  // Resto de monedas estándar (CLP, USD, etc.)
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

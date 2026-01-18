import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "CLP") {
  return new Intl.NumberFormat("es-CL", {
    currency: currency,
    style: "currency",
  }).format(amount);
}

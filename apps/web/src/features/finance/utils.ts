/**
 * Formats monetary amounts for display.
 * Handles both number and string (Decimal serialization) inputs.
 */
export function formatAmount(amount: number | string | null | undefined, currency: string | null = "CLP"): string {
  if (amount === null || amount === undefined) return "-";

  // Convert string (from Decimal serialization) to number
  // If it's an object (like Decimal), convert to string first
  let numericAmount: number;
  if (typeof amount === "number") {
    numericAmount = amount;
  } else {
    const strAmount = String(amount);
    numericAmount = Number.parseFloat(strAmount);
  }

  if (Number.isNaN(numericAmount)) return "-";

  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: currency || "CLP",
    minimumFractionDigits: 0,
  }).format(numericAmount);
}

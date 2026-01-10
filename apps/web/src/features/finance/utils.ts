export function formatAmount(amount: number | null | undefined, currency: string | null = "CLP") {
  if (amount === null || amount === undefined) return "-";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: currency || "CLP",
    minimumFractionDigits: 0,
  }).format(amount);
}

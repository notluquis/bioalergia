const env = import.meta.env;

export const SHOP_CONFIG = {
  storefrontUrl: (env.VITE_STOREFRONT_URL as string | undefined) ?? "https://bioalergia.cl",
  lowStockThreshold: Number(env.VITE_LOW_STOCK_THRESHOLD ?? 3),
  currency: "CLP",
  locale: "es-CL",
} as const;

export type StockState = {
  label: "Stock disponible" | "Últimas unidades" | "Agotado";
  color: "success" | "warning" | "default";
};

export function stockState(availableQty: number, safetyStock: number): StockState {
  const effective = availableQty - safetyStock;
  if (effective <= 0) return { label: "Agotado", color: "default" };
  if (effective <= SHOP_CONFIG.lowStockThreshold)
    return { label: "Últimas unidades", color: "warning" };
  return { label: "Stock disponible", color: "success" };
}

export const CLP_FORMATTER = new Intl.NumberFormat(SHOP_CONFIG.locale, {
  style: "currency",
  currency: SHOP_CONFIG.currency,
  maximumFractionDigits: 0,
});

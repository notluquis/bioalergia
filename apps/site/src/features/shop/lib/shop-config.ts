import { useQuery } from "@tanstack/react-query";

import { catalogClient } from "@/lib/orpc-client";

export const CLP_FORMATTER = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

export type StockState = {
  label: "Stock disponible" | "Últimas unidades" | "Agotado";
  color: "success" | "warning" | "default";
};

export function makeStockState(
  availableQty: number,
  safetyStock: number,
  lowStockThreshold: number
): StockState {
  const effective = availableQty - safetyStock;
  if (effective <= 0) return { label: "Agotado", color: "default" };
  if (effective <= lowStockThreshold) return { label: "Últimas unidades", color: "warning" };
  return { label: "Stock disponible", color: "success" };
}

export function storefrontUrl(): string {
  return typeof window === "undefined" ? "" : window.location.origin;
}

const FALLBACK_LOW_STOCK = 3;

export function useShopConfig() {
  const { data } = useQuery({
    queryKey: ["shop", "public-config"],
    queryFn: () => catalogClient.publicConfig(),
    staleTime: 1000 * 60 * 30,
  });
  return {
    lowStockThreshold: data?.data.low_stock_threshold ?? FALLBACK_LOW_STOCK,
  };
}

export function useStockState(availableQty: number, safetyStock: number): StockState {
  const { lowStockThreshold } = useShopConfig();
  return makeStockState(availableQty, safetyStock, lowStockThreshold);
}

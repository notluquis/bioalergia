import { useQueries } from "@tanstack/react-query";
import { getUFValue } from "@/services/cmf-uf";
import type { PersonalCredit } from "../types";

interface CreditPaidAmounts {
  /** Total pagado en moneda nativa del crédito */
  totalPaid: number;
  /** Total pagado convertido a CLP (solo para créditos en UF) */
  totalPaidCLP: number | null;
  /** Indica si aún está cargando valores UF */
  isLoading: boolean;
}

/**
 * Hook para calcular montos totales pagados de un crédito
 * Para créditos en UF, también calcula el equivalente en CLP según fechas de pago
 */
export function useCreditPaidAmounts(credit: PersonalCredit): CreditPaidAmounts {
  const paidInstallments = credit.installments?.filter((i) => i.status === "PAID") || [];

  // Calcular total pagado en moneda nativa (UF si es UF, CLP si es CLP)
  const totalPaid = paidInstallments.reduce((sum, i) => sum + (i.paidAmount || 0), 0);

  // Si no es UF, retornar simple
  const needsUFConversion = credit.currency === "UF";

  // Obtener fechas de pago únicas que necesitan conversión
  const paymentDates = needsUFConversion
    ? paidInstallments.filter((i) => i.paidAt).map((i) => i.paidAt as string)
    : [];

  // Fetch valores UF para cada fecha de pago
  const ufQueries = useQueries({
    queries: paymentDates.map((date) => ({
      queryKey: ["uf-value", date] as const,
      queryFn: () => getUFValue(date),
      staleTime: Number.POSITIVE_INFINITY, // Los valores UF históricos no cambian
      gcTime: 1000 * 60 * 60 * 24, // Cache por 24 horas
    })),
  });

  // Si no necesita conversión, retornar inmediatamente
  if (!needsUFConversion) {
    return {
      totalPaid,
      totalPaidCLP: null,
      isLoading: false,
    };
  }

  // Verificar si está cargando
  const isLoading = ufQueries.some((q) => q.isLoading);

  // Calcular total en CLP si todos los valores UF están disponibles
  let totalPaidCLP: number | null = null;

  if (ufQueries.every((q) => q.isSuccess)) {
    totalPaidCLP = paidInstallments.reduce((sum, installment, index) => {
      if (!installment.paidAt) return sum;

      const ufValue = ufQueries[index]?.data;
      if (!ufValue) return sum;

      const paidAmount = installment.paidAmount || 0;
      return sum + paidAmount * ufValue;
    }, 0);
  }

  return {
    totalPaid,
    totalPaidCLP,
    isLoading,
  };
}

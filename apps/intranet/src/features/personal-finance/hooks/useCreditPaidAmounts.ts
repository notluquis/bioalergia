import type { PersonalCredit } from "../types";

interface CreditPaidAmounts {
  /** Total pagado en moneda nativa del crédito */
  totalPaid: number;
  /** Total pagado convertido a CLP (solo para créditos en UF) */
  totalPaidCLP: number | null;
  /** Indica si aún está cargando valores UF (siempre false ahora) */
  isLoading: boolean;
}

/**
 * Hook para calcular montos totales pagados de un crédito
 * Para créditos en UF, usa el valor paidAmountCLP guardado en DB (calculado al momento del pago)
 */
export function useCreditPaidAmounts(credit: PersonalCredit): CreditPaidAmounts {
  const paidInstallments = credit.installments?.filter((i) => i.status === "PAID") || [];

  // Calcular total pagado en moneda nativa (UF si es UF, CLP si es CLP)
  const totalPaid = paidInstallments.reduce((sum, i) => sum + (i.paidAmount || 0), 0);

  // Para créditos en UF, sumar los valores CLP guardados en DB
  const needsUFConversion = credit.currency === "UF";
  const totalPaidCLP = needsUFConversion
    ? paidInstallments.reduce((sum, i) => sum + (i.paidAmountCLP || 0), 0)
    : null;

  return {
    totalPaid,
    totalPaidCLP,
    isLoading: false, // Ya no hay carga async - valores vienen de DB
  };
}

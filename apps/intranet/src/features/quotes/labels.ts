import type { QuoteStatus } from "@finanzas/orpc-contracts/quotes";

export const STATUS_LABELS: Record<QuoteStatus, string> = {
  DRAFT: "Borrador",
  SENT: "Enviada",
  ACCEPTED: "Aceptada",
  REJECTED: "Rechazada",
  EXPIRED: "Vencida",
};

export const STATUS_OPTIONS: { id: QuoteStatus; label: string }[] = (
  Object.keys(STATUS_LABELS) as QuoteStatus[]
).map((id) => ({ id, label: STATUS_LABELS[id] }));

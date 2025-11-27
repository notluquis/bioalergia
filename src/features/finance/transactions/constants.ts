import type { LedgerRow } from "./types";

export const COLUMN_DEFS = [
  { key: "date", label: "Fecha" },
  { key: "time", label: "Hora" },
  { key: "description", label: "Descripción" },
  { key: "source_id", label: "ID transacción" },
  { key: "origin", label: "Desde" },
  { key: "destination", label: "Hacia" },
  { key: "direction", label: "Tipo" },
  { key: "amount", label: "Monto" },
  { key: "related", label: "Relacionado" },
  { key: "runningBalance", label: "Saldo cuenta" },
] as const;

export type ColumnKey = (typeof COLUMN_DEFS)[number]["key"];

export type TransactionsTableRow = LedgerRow;

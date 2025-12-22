import dayjs from "dayjs";
import { fmtCLP } from "@/lib/format";
import type { ProductionBalanceHistoryEntry } from "../types";

interface HistoryItemProps {
  entry: ProductionBalanceHistoryEntry;
}

/**
 * History item component for displaying balance change history
 */
export function HistoryItem({ entry }: HistoryItemProps) {
  const status = entry.snapshot?.status ?? "DRAFT";
  const badgeTone = status === "FINAL" ? "badge-success" : "badge-warning";

  return (
    <li className="content-auto border-base-200 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-base-content font-semibold">{dayjs(entry.createdAt).format("DD MMM YYYY HH:mm")}</p>
          <p className="text-base-content/60 text-xs">Por: {entry.changedByEmail || "Desconocido"}</p>
        </div>
        <span className={`badge ${badgeTone} badge-sm`}>{status}</span>
      </div>
      {entry.snapshot && (
        <p className="text-base-content/70 mt-2 text-xs">
          Snapshot: Ingresos {fmtCLP(entry.snapshot.ingresoTarjetas)} tarjetas,{" "}
          {fmtCLP(entry.snapshot.ingresoTransferencias)} transferencias, {fmtCLP(entry.snapshot.ingresoEfectivo)}{" "}
          efectivo.
        </p>
      )}
      {entry.changeReason && <p className="text-base-content/70 mt-1 text-xs">Motivo: {entry.changeReason}</p>}
    </li>
  );
}

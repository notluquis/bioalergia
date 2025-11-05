import { fmtCLP } from "../../../lib/format";
import { formatRut } from "../../../lib/rut";
import type { ParticipantSummaryRow } from "../../participants/types";

interface TopParticipantsSectionProps {
  data: ParticipantSummaryRow[];
  loading: boolean;
  error: string | null;
}

export default function TopParticipantsSection({ data, loading, error }: TopParticipantsSectionProps) {
  return (
    <section className="space-y-3 bg-base-100 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-primary">Top retiros</h2>
        <span className="text-xs uppercase tracking-wide text-base-content/50">Mayores egresos</span>
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
      {loading ? (
        <p className="text-xs text-base-content/60">Cargando contrapartes...</p>
      ) : data.length ? (
        <ul className="space-y-2 text-sm text-base-content/70">
          {data.map((item) => {
            const displayName = item.bankAccountHolder || item.displayName || item.participant;
            const rut = item.identificationNumber ? formatRut(item.identificationNumber) || "-" : "-";
            const account = item.bankAccountNumber || item.withdrawId || "-";
            return (
              <li
                key={`${item.participant}-${item.withdrawId ?? ""}`}
                className="flex items-center justify-between rounded-lg bg-base-200 px-3 py-2"
              >
                <div>
                  <p className="font-medium text-base-content">{displayName}</p>
                  <p className="text-xs text-base-content/60">
                    RUT {rut} · Cuenta {account}
                  </p>
                  <p className="text-xs text-base-content/50">
                    {item.outgoingCount} egresos · {fmtCLP(item.outgoingAmount)}
                  </p>
                </div>
                <span className="text-xs font-semibold text-base-content/50">Total {fmtCLP(item.totalAmount)}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-base-content/60">Sin retiros registrados en el rango.</p>
      )}
    </section>
  );
}

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
        <h2 className="text-lg font-semibold text-(--brand-primary)">Top retiros</h2>
        <span className="text-xs uppercase tracking-wide text-slate-400">Mayores egresos</span>
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      {loading ? (
        <p className="text-xs text-slate-500">Cargando contrapartes...</p>
      ) : data.length ? (
        <ul className="space-y-2 text-sm text-slate-600">
          {data.map((item) => {
            const displayName = item.bankAccountHolder || item.displayName || item.participant;
            const rut = item.identificationNumber ? formatRut(item.identificationNumber) || "-" : "-";
            const account = item.bankAccountNumber || item.withdrawId || "-";
            return (
              <li
                key={`${item.participant}-${item.withdrawId ?? ""}`}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
              >
                <div>
                  <p className="font-medium text-slate-700">{displayName}</p>
                  <p className="text-xs text-slate-500">
                    RUT {rut} · Cuenta {account}
                  </p>
                  <p className="text-xs text-slate-400">
                    {item.outgoingCount} egresos · {fmtCLP(item.outgoingAmount)}
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-400">Total {fmtCLP(item.totalAmount)}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-slate-500">Sin retiros registrados en el rango.</p>
      )}
    </section>
  );
}

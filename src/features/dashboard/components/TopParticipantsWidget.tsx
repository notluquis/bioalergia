import { Link } from "react-router-dom";
import { fmtCLP } from "../../../lib/format";
import { formatRut } from "../../../lib/rut";
import type { ParticipantSummaryRow } from "../../participants/types";

export default function TopParticipantsWidget({
  data,
  loading,
  error,
}: {
  data: ParticipantSummaryRow[];
  loading: boolean;
  error: string | null;
}) {
  return (
    <article className="space-y-4 p-6 bg-base-100">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-[var(--brand-secondary)] drop-shadow-sm">Retiros destacados</h3>
        <Link
          to="/transactions/participants"
          className="inline-flex items-center rounded-full border border-[var(--brand-secondary)]/40 bg-[var(--brand-secondary)]/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--brand-secondary)]"
        >
          Ver todos
        </Link>
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      {loading ? (
        <p className="text-xs text-slate-600">Cargando...</p>
      ) : data.length ? (
        <ul className="space-y-3 text-sm text-slate-600">
          {data.map((item) => {
            const displayName = item.bankAccountHolder || item.displayName || item.participant;
            const rut = item.identificationNumber ? formatRut(item.identificationNumber) || "-" : "-";
            const account = item.bankAccountNumber || item.withdrawId || "-";
            return (
              <li
                key={`${item.participant}-${item.withdrawId ?? ""}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/55 bg-base-100/50 px-4 py-3 shadow-[0_10px_24px_-16px_rgba(16,37,66,0.4)]"
              >
                <div>
                  <p className="font-medium text-slate-700">{displayName}</p>
                  <p className="text-xs text-slate-500/90">
                    RUT {rut} · Cuenta {account}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400/80">{item.outgoingCount} retiros</p>
                </div>
                <span className="text-xs font-semibold text-slate-500">{fmtCLP(item.outgoingAmount)}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-slate-600">Aún no hay retiros registrados.</p>
      )}
    </article>
  );
}

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
        <h3 className="text-base font-semibold text-secondary drop-shadow-sm">Retiros destacados</h3>
        <Link
          to="/transactions/participants"
          className="inline-flex items-center rounded-full border border-secondary/40 bg-secondary/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-secondary"
        >
          Ver todos
        </Link>
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      {loading ? (
        <p className="text-xs text-base-content">Cargando...</p>
      ) : data.length ? (
        <ul className="space-y-3 text-sm text-base-content">
          {data.map((item) => {
            const displayName = item.bankAccountHolder || item.displayName || item.participant;
            const rut = item.identificationNumber ? formatRut(item.identificationNumber) || "-" : "-";
            const account = item.bankAccountNumber || item.withdrawId || "-";
            return (
              <li
                key={`${item.participant}-${item.withdrawId ?? ""}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-base-300 bg-base-200 px-4 py-3 shadow-sm"
              >
                <div>
                  <p className="font-medium text-base-content">{displayName}</p>
                  <p className="text-xs text-base-content/90">
                    RUT {rut} · Cuenta {account}
                  </p>
                  <p className="text-xs uppercase tracking-wide text-base-content/80">{item.outgoingCount} retiros</p>
                </div>
                <span className="text-xs font-semibold text-base-content/70">{fmtCLP(item.outgoingAmount)}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-base-content">Aún no hay retiros registrados.</p>
      )}
    </article>
  );
}

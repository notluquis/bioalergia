import { Link } from "@tanstack/react-router";

import { fmtCLP } from "@/lib/format";
import { formatRut } from "@/lib/rut";

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
    <article className="surface-recessed space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-secondary text-base font-semibold drop-shadow-sm">Retiros destacados</h3>
        <Link
          to="/finanzas/participants"
          className="border-secondary/40 bg-secondary/15 text-secondary inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-wide uppercase"
        >
          Ver todos
        </Link>
      </div>
      {error && <p className="text-error text-xs">{error}</p>}
      {loading ? (
        <p className="text-base-content text-xs">Cargando...</p>
      ) : data.length ? (
        <ul className="text-base-content space-y-3 text-sm">
          {data.map((item) => {
            const displayName = item.bankAccountHolder || item.displayName || item.participant || "Sin información";
            const rutValue =
              item.identificationNumber && typeof item.identificationNumber === "string"
                ? formatRut(item.identificationNumber)
                : "";
            const rut = rutValue || "-";
            const account = item.bankAccountNumber || item.withdrawId || "-";
            return (
              <li
                key={`${item.participant}-${item.withdrawId ?? ""}`}
                className="border-base-300 bg-base-200 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-sm"
              >
                <div>
                  <p className="text-base-content font-medium">{displayName}</p>
                  <p className="text-base-content/90 text-xs">
                    RUT {rut} · Cuenta {account}
                  </p>
                  <p className="text-base-content/80 text-xs tracking-wide uppercase">{item.outgoingCount} retiros</p>
                </div>
                <span className="text-base-content/70 text-xs font-semibold">{fmtCLP(item.outgoingAmount)}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-base-content text-xs">Aún no hay retiros registrados.</p>
      )}
    </article>
  );
}

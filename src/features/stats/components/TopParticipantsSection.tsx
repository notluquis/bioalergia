import { fmtCLP } from "@/lib/format";
import { formatRut } from "@/lib/rut";
import type { ParticipantSummaryRow } from "../../participants/types";

interface TopParticipantsSectionProps {
  data: ParticipantSummaryRow[];
  loading: boolean;
  error: string | null;
}

export default function TopParticipantsSection({ data, loading, error }: TopParticipantsSectionProps) {
  return (
    <section className="bg-base-100 space-y-3 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-primary text-lg font-semibold">Top retiros</h2>
        <span className="text-base-content/50 text-xs tracking-wide uppercase">Mayores egresos</span>
      </div>
      {error && <p className="text-error text-xs">{error}</p>}
      {loading ? (
        <p className="text-base-content/60 text-xs">Cargando contrapartes...</p>
      ) : data.length ? (
        <ul className="text-base-content/70 space-y-2 text-sm">
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
                className="bg-base-200 flex items-center justify-between rounded-lg px-3 py-2"
              >
                <div>
                  <p className="text-base-content font-medium">{displayName}</p>
                  <p className="text-base-content/60 text-xs">
                    RUT {rut} · Cuenta {account}
                  </p>
                  <p className="text-base-content/50 text-xs">
                    {item.outgoingCount} egresos · {fmtCLP(item.outgoingAmount)}
                  </p>
                </div>
                <span className="text-base-content/50 text-xs font-semibold">Total {fmtCLP(item.totalAmount)}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-base-content/60 text-xs">Sin retiros registrados en el rango.</p>
      )}
    </section>
  );
}

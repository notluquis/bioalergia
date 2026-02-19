import { Skeleton } from "@heroui/react";
import { Link } from "@tanstack/react-router";

import { fmtCLP } from "@/lib/format";
import { formatRut } from "@/lib/rut";

import type { ParticipantSummaryRow } from "../../participants/types";
export function TopParticipantsWidget({
  data,
  error,
  loading,
}: {
  data: ParticipantSummaryRow[];
  error: null | string;
  loading: boolean;
}) {
  return (
    <article className="surface-recessed space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-base text-secondary drop-shadow-sm">
          Retiros destacados
        </h3>
        <Link
          className="inline-flex items-center rounded-full border border-secondary/40 bg-secondary/15 px-3 py-1 font-semibold text-secondary text-xs uppercase tracking-wide"
          to="/finanzas/counterparts"
        >
          Ver todos
        </Link>
      </div>
      {error && <p className="text-danger text-xs">{error}</p>}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              className="rounded-2xl border border-default-200 bg-default-50 px-4 py-3 shadow-sm"
              key={`top-participants-widget-skeleton-${index + 1}`}
            >
              <Skeleton className="h-4 w-44 rounded-md" />
              <Skeleton className="mt-2 h-3 w-52 rounded-md" />
            </div>
          ))}
        </div>
      )}
      {!loading && data.length > 0 && (
        <ul className="space-y-3 text-foreground text-sm">
          {data.map((item) => {
            const displayName =
              item.bankAccountHolder || item.displayName || item.participant || "Sin información";
            const rutValue =
              item.identificationNumber && typeof item.identificationNumber === "string"
                ? formatRut(item.identificationNumber)
                : "";
            const rut = rutValue || "-";
            const account = item.bankAccountNumber || item.withdrawId || "-";
            return (
              <li
                className="flex items-center justify-between gap-3 rounded-2xl border border-default-200 bg-default-50 px-4 py-3 shadow-sm"
                key={`${item.participant}-${item.withdrawId ?? ""}`}
              >
                <div>
                  <p className="font-medium text-foreground">{displayName}</p>
                  <p className="text-foreground/90 text-xs">
                    RUT {rut} · Cuenta {account}
                  </p>
                  <p className="text-default-700 text-xs uppercase tracking-wide">
                    {item.outgoingCount} retiros
                  </p>
                </div>
                <span className="font-semibold text-default-600 text-xs">
                  {fmtCLP(item.outgoingAmount)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {!loading && data.length === 0 && (
        <p className="text-foreground text-xs">Aún no hay retiros registrados.</p>
      )}
    </article>
  );
}

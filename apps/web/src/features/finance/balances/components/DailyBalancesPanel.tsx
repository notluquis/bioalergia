import dayjs from "dayjs";

import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { fmtCLP } from "@/lib/format";

import type { BalanceDraft, BalancesApiResponse } from "../types";
import { formatBalanceInput } from "../utils";

type Props = {
  report: BalancesApiResponse | null;
  drafts: Record<string, BalanceDraft>;
  onDraftChange: (date: string, patch: Partial<BalanceDraft>) => void;
  onSave: (date: string) => void;
  saving: Record<string, boolean>;
  loading: boolean;
  error: string | null;
};

const formatDifference = (diff: number | null) => {
  if (diff == null) return "—";
  return diff >= 0 ? fmtCLP(diff) : `-${fmtCLP(Math.abs(diff))}`;
};

export const DailyBalancesPanel = function DailyBalancesPanel({
  report,
  drafts,
  onDraftChange,
  onSave,
  saving,
  loading,
  error,
}: Props) {
  return (
    <section className="card bg-base-100 shadow-sm">
      <div className="card-body">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="card-title text-primary text-lg">Registro de saldos</h2>
          {report?.previous && (
            <div className="badge badge-outline badge-lg gap-2">
              <span className="text-xs">Saldo previo ({dayjs(report.previous.date).format("DD/MM")}):</span>
              <span className="font-semibold">{fmtCLP(report.previous.balance)}</span>
            </div>
          )}
        </div>

        {error && (
          <Alert variant="error" className="text-xs">
            {error}
          </Alert>
        )}

        {renderContent()}
      </div>
    </section>
  );

  function renderContent() {
    if (loading) {
      return (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={`skeleton-balance-${idx}`}
              className="border-base-300 bg-base-200/60 flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3"
            >
              <span className="skeleton-line w-24" />
              <span className="skeleton-line w-16" />
              <span className="skeleton-line w-24" />
              <span className="skeleton-line min-w-30 flex-1" />
              <span className="skeleton-line w-16" />
            </div>
          ))}
        </div>
      );
    }
    if (!report) {
      return (
        <p className="text-base-content px-4 py-3 text-sm">
          Selecciona un rango con movimientos para conciliar los saldos diarios.
        </p>
      );
    }
    if (report.days.length === 0) {
      return <p className="text-base-content px-4 py-3 text-sm">No hay días registrados en el rango actual.</p>;
    }
    return (
      <div className="-mx-6 overflow-x-auto">
        <table className="table-sm table-zebra table">
          <thead>
            <tr>
              <th className="text-xs">Fecha</th>
              <th className="text-right text-xs">Ingresos</th>
              <th className="text-right text-xs">Egresos</th>
              <th className="text-right text-xs">Neto</th>
              <th className="text-right text-xs">Esperado</th>
              <th className="text-xs">Registrado</th>
              <th className="text-right text-xs">Dif.</th>
              <th className="text-xs">Nota</th>
              <th className="text-xs"></th>
            </tr>
          </thead>
          <tbody>
            {report.days.map((day) => {
              const draft = drafts[day.date] ?? { value: "", note: "" };
              const defaultValue = day.recordedBalance == null ? "" : formatBalanceInput(day.recordedBalance);
              const defaultNote = day.note ?? "";
              const isSaving = Boolean(saving[day.date]);
              const isDirty = draft.value !== defaultValue || draft.note !== defaultNote;
              const hasValue = draft.value.trim().length > 0 || defaultValue.trim().length > 0;
              const canSave = isDirty && hasValue && !isSaving;
              const mismatch = day.difference != null && Math.abs(day.difference) > 1;

              return (
                <tr key={day.date}>
                  <td className="text-xs font-medium">
                    <div className="flex flex-col gap-0.5">
                      <span>{dayjs(day.date).format("DD/MM/YY")}</span>
                      {day.hasCashback && <span className="badge badge-warning badge-xs">CB</span>}
                    </div>
                  </td>
                  <td className="text-success text-right text-xs">{fmtCLP(Math.abs(day.totalIn))}</td>
                  <td className="text-error text-right text-xs">-{fmtCLP(Math.abs(day.totalOut))}</td>
                  <td
                    className={`text-right text-xs font-semibold ${day.netChange >= 0 ? "text-success" : "text-error"}`}
                  >
                    {day.netChange >= 0 ? fmtCLP(day.netChange) : `-${fmtCLP(Math.abs(day.netChange))}`}
                  </td>
                  <td className="text-right text-xs">
                    {day.expectedBalance == null ? "—" : fmtCLP(day.expectedBalance)}
                  </td>
                  <td>
                    <Input
                      type="text"
                      value={draft.value}
                      onChange={(event) => onDraftChange(day.date, { value: event.target.value })}
                      className="input-xs w-28"
                      placeholder="0"
                      inputMode="decimal"
                    />
                  </td>
                  <td className={`text-right text-xs font-semibold ${mismatch ? "text-error" : ""}`}>
                    {formatDifference(day.difference)}
                  </td>
                  <td>
                    <Input
                      as="textarea"
                      rows={1}
                      value={draft.note}
                      onChange={(event) => onDraftChange(day.date, { note: event.target.value })}
                      className="textarea-xs w-32 text-xs"
                      placeholder="Nota"
                    />
                  </td>
                  <td>
                    <Button type="button" size="xs" onClick={() => onSave(day.date)} disabled={!canSave}>
                      {isSaving ? "..." : "💾"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
};

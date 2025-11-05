import dayjs from "dayjs";
import { memo } from "react";
import Alert from "../../../components/Alert";
import Button from "../../../components/Button";
import { fmtCLP } from "../../../lib/format";
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

export const DailyBalancesPanel = memo(function DailyBalancesPanel({
  report,
  drafts,
  onDraftChange,
  onSave,
  saving,
  loading,
  error,
}: Props) {
  return (
    <section className="space-y-4 p-6 bg-base-100">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-primary drop-shadow-sm">Saldos diarios</h2>
          <p className="text-xs text-base-content/90">
            Registra el saldo de la cuenta a las 23:59 de cada día para conciliar los movimientos.
          </p>
        </div>
        {report?.previous && (
          <div className="rounded-xl border border-base-300 bg-base-200 px-4 py-2 text-xs font-medium text-base-content shadow-inner">
            Saldo cierre previo ({dayjs(report.previous.date).format("DD-MM-YYYY")})
            <span className="ml-2 font-semibold text-base-content">{fmtCLP(report.previous.balance)}</span>
          </div>
        )}
      </div>

      {error && (
        <Alert variant="error" className="text-xs">
          {error}
        </Alert>
      )}

      {loading ? (
        <p className="px-4 py-3 text-sm text-primary">Cargando saldos diarios...</p>
      ) : !report ? (
        <p className="px-4 py-3 text-sm text-base-content">
          Selecciona un rango con movimientos para conciliar los saldos diarios.
        </p>
      ) : report.days.length === 0 ? (
        <p className="px-4 py-3 text-sm text-base-content">No hay días registrados en el rango actual.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-base-content">
            <thead className="bg-base-100/60 text-primary">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Ingresos</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Egresos</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Variación neta</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Saldo esperado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Saldo registrado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Diferencia</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Nota</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {report.days.map((day) => {
                const draft = drafts[day.date] ?? { value: "", note: "" };
                const defaultValue = day.recordedBalance != null ? formatBalanceInput(day.recordedBalance) : "";
                const defaultNote = day.note ?? "";
                const isSaving = Boolean(saving[day.date]);
                const isDirty = draft.value !== defaultValue || draft.note !== defaultNote;
                const hasValue = draft.value.trim().length > 0 || defaultValue.trim().length > 0;
                const canSave = isDirty && hasValue && !isSaving;
                const mismatch = day.difference != null && Math.abs(day.difference) > 1;

                return (
                  <tr
                    key={day.date}
                    className="align-top border-b border-base-300 bg-base-200 last:border-none even:bg-base-300"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-base-content">
                      <div className="flex flex-col gap-1">
                        <span>{dayjs(day.date).format("DD-MM-YYYY")}</span>
                        {day.hasCashback && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/70 bg-amber-50/70 px-2 py-0.5 text-xs font-medium text-amber-700 shadow-sm">
                            Cashback excluido
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-success">{fmtCLP(Math.abs(day.totalIn))}</td>
                    <td className="px-4 py-3 text-error">-{fmtCLP(Math.abs(day.totalOut))}</td>
                    <td className={`px-4 py-3 font-semibold ${day.netChange >= 0 ? "text-success" : "text-error"}`}>
                      {day.netChange >= 0 ? fmtCLP(day.netChange) : `-${fmtCLP(Math.abs(day.netChange))}`}
                    </td>
                    <td className="px-4 py-3 text-base-content">
                      {day.expectedBalance != null ? fmtCLP(day.expectedBalance) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={draft.value}
                        onChange={(event) => onDraftChange(day.date, { value: event.target.value })}
                        className="input input-bordered w-full text-sm"
                        placeholder="0"
                      />
                    </td>
                    <td className={`px-4 py-3 font-semibold ${mismatch ? "text-error" : "text-base-content"}`}>
                      {day.difference != null
                        ? day.difference >= 0
                          ? fmtCLP(day.difference)
                          : `-${fmtCLP(Math.abs(day.difference))}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <textarea
                        rows={2}
                        value={draft.note}
                        onChange={(event) => onDraftChange(day.date, { note: event.target.value })}
                        className="textarea textarea-bordered w-full text-xs"
                        placeholder="Comentario opcional"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Button type="button" size="xs" onClick={() => onSave(day.date)} disabled={!canSave}>
                        {isSaving ? "Guardando..." : "Guardar"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
});

import dayjs from "dayjs";

import { DataTable } from "@/components/data-table/DataTable";
import Alert from "@/components/ui/Alert";
import { fmtCLP } from "@/lib/format";

import type { BalanceDraft, BalancesApiResponse } from "../types";
import { columns } from "./DailyBalancesColumns";

type Props = {
  report: BalancesApiResponse | null;
  drafts: Record<string, BalanceDraft>;
  onDraftChange: (date: string, patch: Partial<BalanceDraft>) => void;
  onSave: (date: string) => void;
  saving: Record<string, boolean>;
  loading: boolean;
  error: string | null;
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
      <div className="-mx-6 overflow-hidden">
        <DataTable
          data={report.days}
          columns={columns}
          meta={{
            drafts,
            saving,
            onDraftChange,
            onSave,
          }}
          enableToolbar={false}
          enableVirtualization={false} // Important for inputs
          pagination={undefined} // Show all days in range (usually 7-30)
          pageCount={-1}
        />
      </div>
    );
  }
};

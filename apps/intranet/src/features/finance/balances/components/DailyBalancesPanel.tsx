import { Alert, Card, Chip, Skeleton } from "@heroui/react";
import dayjs from "dayjs";

import { DataTable } from "@/components/data-table/DataTable";
import { fmtCLP } from "@/lib/format";

import type { BalanceDraft, BalancesApiResponse } from "../types";

import { columns } from "./DailyBalancesColumns";

interface Props {
  drafts: Record<string, BalanceDraft>;
  error: null | string;
  loading: boolean;
  onDraftChange: (date: string, patch: Partial<BalanceDraft>) => void;
  onSave: (date: string) => void;
  report: BalancesApiResponse | null;
  saving: Record<string, boolean>;
}

export const DailyBalancesPanel = function DailyBalancesPanel({
  drafts,
  error,
  loading,
  onDraftChange,
  onSave,
  report,
  saving,
}: Props) {
  return (
    <Card className="shadow-sm">
      <Card.Content className="space-y-4 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-primary">Registro de saldos</h2>
          {report?.previous && (
            <Chip className="gap-2" size="lg" variant="tertiary">
              <span className="text-xs">
                Saldo previo ({dayjs(report.previous.date, "YYYY-MM-DD").format("DD/MM")}):
              </span>
              <span className="font-semibold">{fmtCLP(report.previous.balance)}</span>
            </Chip>
          )}
        </div>

        {error && (
          <Alert className="text-xs" status="danger">
            <Alert.Content>
              <Alert.Description>{error}</Alert.Description>
            </Alert.Content>
          </Alert>
        )}

        {renderContent()}
      </Card.Content>
    </Card>
  );

  function renderContent() {
    if (loading) {
      const skeletonKeys = Array.from({ length: 6 }, () => globalThis.crypto.randomUUID());
      return (
        <div className="space-y-2">
          {skeletonKeys.map((key) => (
            <div
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-default-200 bg-default-50/60 px-4 py-3"
              key={key}
            >
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="h-4 w-16 rounded-md" />
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="h-4 min-w-30 flex-1 rounded-md" />
              <Skeleton className="h-4 w-16 rounded-md" />
            </div>
          ))}
        </div>
      );
    }
    if (!report) {
      return (
        <p className="px-4 py-3 text-foreground text-sm">
          Selecciona un rango con movimientos para conciliar los saldos diarios.
        </p>
      );
    }
    if (report.days.length === 0) {
      return (
        <p className="px-4 py-3 text-foreground text-sm">
          No hay días registrados en el rango actual.
        </p>
      );
    }

    return (
      <div className="-mx-6 overflow-hidden">
        <DataTable
          columns={columns}
          data={report.days}
          containerVariant="plain"
          enableToolbar={false}
          enableVirtualization={false} // Important for inputs
          meta={{
            drafts,
            onDraftChange,
            onSave,
            saving,
          }}
          pageCount={-1}
          pagination={undefined} // Show all days in range (usually 7-30)
          scrollMaxHeight="min(56dvh, 640px)"
        />
      </div>
    );
  }
};

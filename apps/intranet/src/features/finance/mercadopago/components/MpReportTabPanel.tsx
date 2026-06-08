import { formatChile } from "@/lib/dates";
import { Card, Description, Skeleton } from "@heroui/react";
import type {
  ColumnDef,
  OnChangeFn,
  PaginationState,
  VisibilityState,
} from "@tanstack/react-table";
import { Clock, FileText } from "lucide-react";

import { DataTable } from "@/components/data-table/DataTable";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import type { MPReport, MpReportType } from "@/services/mercadopago";

const resolveLastReportLabel = (reports: MPReport[]) => {
  const lastReport = reports[0];
  if (!lastReport) {
    return "N/A";
  }

  const date = lastReport.date_created ?? lastReport.begin_date;
  return date ? formatChile(date, "D MMM, HH:mm") : "N/A";
};

const resolveReportTypeLabel = (reportType: MpReportType) =>
  reportType === "release" ? "Liberación" : "Conciliación";

interface MpReportTabPanelProps {
  readonly columns: ColumnDef<MPReport>[];
  readonly columnVisibility: VisibilityState;
  readonly errorMessage: string | null;
  readonly isLoading: boolean;
  readonly onColumnVisibilityChange: OnChangeFn<VisibilityState>;
  readonly onPaginationChange: OnChangeFn<PaginationState>;
  readonly pageCount: number;
  readonly pagination: PaginationState;
  readonly reports: MPReport[];
  readonly reportTotal: number;
  readonly reportType: MpReportType;
}

export function MpReportTabPanel({
  columns,
  columnVisibility,
  errorMessage,
  isLoading,
  onColumnVisibilityChange,
  onPaginationChange,
  pageCount,
  pagination,
  reports,
  reportTotal,
  reportType,
}: MpReportTabPanelProps) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Last Report Card */}
        <Card className="h-full p-6" variant="secondary">
          <Card.Header className="items-start justify-between p-0">
            <div>
              <Card.Description className="font-semibold text-default-600 text-xs uppercase tracking-wide">
                Último Reporte
              </Card.Description>
              <Card.Title
                aria-busy={isLoading || undefined}
                aria-label={isLoading ? "Cargando último reporte" : undefined}
                className="mt-2 line-clamp-1 text-lg"
              >
                {isLoading ? (
                  <Skeleton aria-hidden="true" className="h-5 w-28 rounded-lg" />
                ) : (
                  resolveLastReportLabel(reports)
                )}
              </Card.Title>
            </div>
            <Clock className="text-primary size-5" />
          </Card.Header>
          <Card.Content className="p-0 pt-4">
            <Description className="truncate text-default-600 text-xs">
              {isLoading
                ? "Obteniendo últimos reportes..."
                : (reports[0]?.file_name ?? "Sin reportes recientes")}
            </Description>
          </Card.Content>
        </Card>

        {/* Total Reports Card */}
        <Card className="h-full p-6" variant="secondary">
          <Card.Header className="items-start justify-between p-0">
            <div>
              <Card.Title className="text-sm">Total Reportes</Card.Title>
              <Card.Description>{`Tipo: ${resolveReportTypeLabel(reportType)}`}</Card.Description>
            </div>
            <FileText className="text-primary size-5" />
          </Card.Header>
          <Card.Content className="p-0 pt-3">
            <p className="font-semibold text-3xl">{isLoading ? "..." : reportTotal}</p>
          </Card.Content>
        </Card>
      </div>

      <ErrorAlert message={errorMessage} />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2">
            <FileText className="text-primary size-4" />
            <div>
              <span className="block font-semibold text-lg">Historial de Reportes</span>
              <span className="block text-default-500 text-xs">Total: {reportTotal}</span>
            </div>
          </div>
        </div>

        <DataTable
          columns={columns}
          containerVariant="plain"
          columnVisibility={columnVisibility}
          data={reports}
          enableExport={false}
          enableGlobalFilter={false}
          isLoading={isLoading}
          key={`mp-reports-${reportType}-${pagination.pageIndex}-${reports.length}`}
          pageSizeOptions={[10, 25, 50]}
          pagination={pagination}
          onPaginationChange={onPaginationChange}
          onColumnVisibilityChange={onColumnVisibilityChange}
          pageCount={pageCount}
          noDataMessage={
            isLoading
              ? "Cargando reportes de MercadoPago..."
              : "Aún no hay reportes. Genera uno para comenzar."
          }
          scrollMaxHeight="min(68dvh, 760px)"
        />
      </div>
    </>
  );
}

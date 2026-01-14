import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { Download, Loader2, RefreshCw } from "lucide-react";

import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { MPReport } from "@/services/mercadopago";

export const getMpReportColumns = (
  handleDownload: (e: React.MouseEvent, fileName: string) => void,
  handleProcess: (e: React.MouseEvent, fileName: string) => void,
  downloadPending: boolean,
  processPending: boolean,
  processingFile: string | null
): ColumnDef<MPReport>[] => [
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => <span className="text-base-content/60 font-mono text-xs">#{row.original.id}</span>,
  },
  {
    accessorFn: (row) => row.date_created || row.begin_date,
    id: "date",
    header: "Creado",
    cell: ({ row }) => {
      const date = row.original.date_created || row.original.begin_date;
      return <span className="text-sm whitespace-nowrap">{date ? dayjs(date).format("DD/MM/YY HH:mm") : "-"}</span>;
    },
  },
  {
    accessorKey: "begin_date",
    header: "Desde",
    cell: ({ row }) => (
      <span className="text-base-content/70 text-sm whitespace-nowrap">
        {row.original.begin_date ? dayjs(row.original.begin_date).format("DD/MM/YYYY") : "-"}
      </span>
    ),
  },
  {
    accessorKey: "end_date",
    header: "Hasta",
    cell: ({ row }) => (
      <span className="text-base-content/70 text-sm whitespace-nowrap">
        {row.original.end_date ? dayjs(row.original.end_date).format("DD/MM/YYYY") : "-"}
      </span>
    ),
  },
  {
    accessorKey: "file_name",
    header: "Archivo",
    cell: ({ row }) => (
      <div className="text-base-content/70 max-w-40 truncate font-mono text-xs" title={row.original.file_name}>
        {row.original.file_name || <span className="opacity-50">-</span>}
      </div>
    ),
  },
  {
    id: "source",
    header: "Origen",
    cell: ({ row }) => (
      <span
        className={cn(
          "badge badge-sm font-medium",
          row.original.created_from === "schedule" ? "badge-outline opacity-80" : "badge-ghost"
        )}
      >
        {row.original.created_from === "schedule" ? "Automático" : "Manual"}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Estado",
    cell: ({ row }) =>
      row.original.status === "pending" ? (
        <span className="text-warning bg-warning/10 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium">
          <Loader2 className="h-3 w-3 animate-spin" />
          Generando...
        </span>
      ) : (
        <span className="text-success bg-success/10 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium">
          <span className="bg-success h-1.5 w-1.5 rounded-full"></span>
          Disponible
        </span>
      ),
  },
  {
    id: "actions",
    header: () => <div className="text-right">Acciones</div>,
    cell: ({ row }) => {
      const report = row.original;
      return (
        <div className="flex justify-end gap-1 text-right">
          <Button
            variant="ghost"
            className="h-9 w-9 p-0 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100"
            onClick={(e) => report.file_name && handleDownload(e, report.file_name)}
            disabled={downloadPending || report.status === "pending" || !report.file_name}
            title={report.status === "pending" ? "Reporte aún generándose" : "Descargar"}
          >
            {downloadPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
          </Button>
          <Button
            variant="ghost"
            className="h-9 w-9 p-0 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100"
            onClick={(e) => report.file_name && handleProcess(e, report.file_name)}
            disabled={processPending || report.status === "pending" || !report.file_name}
            title={report.status === "pending" ? "Reporte aún generándose" : "Sincronizar a BD"}
          >
            {processPending && processingFile === (report.file_name ?? null) ? (
              <Loader2 className="text-primary h-5 w-5 animate-spin" />
            ) : (
              <RefreshCw className="h-5 w-5" />
            )}
          </Button>
        </div>
      );
    },
  },
];

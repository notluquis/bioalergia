import { Chip } from "@heroui/react";
import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { Download, Loader2, RefreshCw } from "lucide-react";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { MPReport } from "@/services/mercadopago";

const REPORT_PENDING_REGEX = /processing|pending|in_progress|waiting|generating|queued|creating/i;

export const getMpReportColumns = (
  handleDownload: (e: React.MouseEvent, fileName: string) => void,
  handleProcess: (e: React.MouseEvent, fileName: string) => void,
  downloadPending: boolean,
  processPending: boolean,
  processingFile: null | string,
): ColumnDef<MPReport>[] => [
  {
    accessorKey: "id",
    cell: ({ row }) => (
      <span className="font-mono text-default-500 text-xs">#{row.original.id}</span>
    ),
    header: "ID",
  },
  {
    accessorFn: (row) => row.date_created ?? row.begin_date,
    cell: ({ row }) => {
      const date = row.original.date_created ?? row.original.begin_date;
      return (
        <span className="whitespace-nowrap text-sm">
          {date ? dayjs(date).format("DD/MM/YY HH:mm") : "-"}
        </span>
      );
    },
    header: "Creado",
    id: "date",
  },
  {
    accessorKey: "begin_date",
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-default-600 text-sm">
        {row.original.begin_date ? dayjs(row.original.begin_date).format("DD/MM/YYYY") : "-"}
      </span>
    ),
    header: "Desde",
  },
  {
    accessorKey: "end_date",
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-default-600 text-sm">
        {row.original.end_date ? dayjs(row.original.end_date).format("DD/MM/YYYY") : "-"}
      </span>
    ),
    header: "Hasta",
  },
  {
    accessorKey: "file_name",
    cell: ({ row }) => (
      <div
        className="max-w-40 truncate font-mono text-default-600 text-xs"
        title={row.original.file_name}
      >
        {row.original.file_name ?? <span className="opacity-50">-</span>}
      </div>
    ),
    header: "Archivo",
  },
  {
    cell: ({ row }) => (
      <Chip
        className={cn("font-medium", row.original.created_from === "schedule" && "opacity-80")}
        size="sm"
        variant={row.original.created_from === "schedule" ? "tertiary" : "secondary"}
      >
        {row.original.created_from === "schedule" ? "Automático" : "Manual"}
      </Chip>
    ),
    header: "Origen",
    id: "source",
  },
  {
    accessorKey: "status",
    cell: ({ row }) =>
      isReportPending(row.original.status) ? (
        <Chip className="gap-1.5" color="warning" size="sm" variant="soft">
          <Loader2 className="h-3 w-3 animate-spin" />
          Generando...
        </Chip>
      ) : (
        <Chip className="gap-1.5" color="success" size="sm" variant="soft">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          Disponible
        </Chip>
      ),
    header: "Estado",
  },
  {
    cell: ({ row }) => {
      const report = row.original;
      const pending = isReportPending(report.status);
      return (
        <div className="flex justify-end gap-1 text-right">
          <Button
            className="h-9 w-9 p-0 transition-opacity sm:opacity-70 sm:group-hover:opacity-100"
            disabled={downloadPending || pending || !report.file_name}
            onClick={(e) => {
              if (report.file_name) {
                handleDownload(e, report.file_name);
              }
            }}
            title={pending ? "Reporte aún generándose" : "Descargar"}
            variant="ghost"
          >
            {downloadPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Download className="h-5 w-5" />
            )}
          </Button>
          <Button
            className="h-9 w-9 p-0 transition-opacity sm:opacity-70 sm:group-hover:opacity-100"
            disabled={processPending || pending || !report.file_name}
            onClick={(e) => {
              if (report.file_name) {
                handleProcess(e, report.file_name);
              }
            }}
            title={pending ? "Reporte aún generándose" : "Sincronizar a BD"}
            variant="ghost"
          >
            {processPending && processingFile === (report.file_name ?? null) ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : (
              <RefreshCw className="h-5 w-5" />
            )}
          </Button>
        </div>
      );
    },
    header: () => <div className="text-right">Acciones</div>,
    id: "actions",
  },
];

function isReportPending(status?: string) {
  if (!status) {
    return false;
  }
  return REPORT_PENDING_REGEX.test(status);
}

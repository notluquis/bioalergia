import { Chip } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { ClipboardList, ExternalLink } from "lucide-react";
import { DataTable } from "@/components/data-table/DataTable";
import { Page } from "@/components/layouts/Page";
import { PageHeader } from "@/components/layouts/PageHeader";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { intakeORPCClient, toIntakeApiError } from "@/features/intake/orpc";
import {
  intakeSubmissionsResponseSchema,
  type IntakeSubmissionRow,
} from "@/features/intake/schemas";
import { formatChile, fromNow } from "@/lib/dates";

const KEY = ["intake", "submissions"] as const;

function prevision(row: IntakeSubmissionRow): string {
  if (!row.healthInsurance) return "—";
  return row.isapreName ? `${row.healthInsurance} · ${row.isapreName}` : row.healthInsurance;
}

export function IntakeSubmissionsPage() {
  const { data, isLoading } = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      try {
        const res = await intakeORPCClient.list({ page: 0, pageSize: 100 });
        return intakeSubmissionsResponseSchema.parse(res);
      } catch (error) {
        throw toIntakeApiError(error);
      }
    },
  });

  const columns: ColumnDef<IntakeSubmissionRow>[] = [
    {
      header: "Paciente",
      accessorKey: "patientName",
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-sm">{row.original.patientName}</span>
          <span className="text-default-400 text-xs">{row.original.patientPhone}</span>
        </div>
      ),
    },
    {
      header: "RUT",
      accessorKey: "patientRut",
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.original.patientRut ?? "—"}</span>
      ),
    },
    {
      header: "Previsión",
      accessorKey: "healthInsurance",
      cell: ({ row }) => <span className="text-sm">{prevision(row.original)}</span>,
    },
    {
      header: "Fecha cita",
      accessorKey: "appointmentDate",
      cell: ({ row }) =>
        row.original.appointmentDate ? (
          <span className="text-sm">
            {formatChile(row.original.appointmentDate, "DD/MM/YYYY HH:mm")}
          </span>
        ) : (
          <span className="text-default-400 text-sm">—</span>
        ),
    },
    {
      header: "Comprobante",
      accessorKey: "comprobanteUrl",
      enableSorting: false,
      cell: ({ row }) =>
        row.original.comprobanteUrl ? (
          <a
            href={row.original.comprobanteUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary text-sm hover:underline"
          >
            Ver <ExternalLink size={12} aria-hidden="true" />
          </a>
        ) : (
          <span className="text-default-400 text-sm">—</span>
        ),
    },
    {
      header: "Aviso staff",
      accessorKey: "staffNotifiedAt",
      cell: ({ row }) =>
        row.original.staffNotifiedAt ? (
          <Chip size="sm" color="success" variant="soft">
            <Chip.Label>Enviado · {fromNow(row.original.staffNotifiedAt)}</Chip.Label>
          </Chip>
        ) : (
          <Chip size="sm" color="warning" variant="soft">
            <Chip.Label>Pendiente</Chip.Label>
          </Chip>
        ),
    },
    {
      header: "Recibida",
      accessorKey: "submittedAt",
      cell: ({ row }) => (
        <span className="text-default-500 text-sm">
          {formatChile(row.original.submittedAt, "DD/MM/YYYY HH:mm")}
        </span>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Fichas de ingreso"
        description="Fichas enviadas por los pacientes vía el formulario de WhatsApp (Flow). Panel de sólo lectura — red de seguridad cuando el aviso automático al staff no llega."
        icon={<ClipboardList size={22} />}
      />

      {isLoading ? (
        <div className="flex justify-center py-10">
          <LoadingSpinner label="Cargando fichas de ingreso" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          enableExport={false}
          noDataMessage="Sin fichas de ingreso registradas"
        />
      )}
    </Page>
  );
}

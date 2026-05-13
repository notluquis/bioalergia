import { Chip } from "@heroui/react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { Activity } from "lucide-react";
import { DataTable } from "@/components/data-table/DataTable";
import { fetchPatientClinicalSeries } from "../api";

type Series = Awaited<ReturnType<typeof fetchPatientClinicalSeries>>["items"][number];

const KIND_LABEL: Record<string, string> = {
  PATCH_TEST: "Parche",
  SKIN_TEST: "Test",
  SUBCUTANEOUS_TREATMENT: "Subcutáneo",
};

const KIND_COLOR: Record<string, "warning" | "accent" | "success" | "default"> = {
  PATCH_TEST: "warning",
  SKIN_TEST: "accent",
  SUBCUTANEOUS_TREATMENT: "success",
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Activa",
  CANCELLED: "Cancelada",
  COMPLETED: "Completada",
  INACTIVE: "Inactiva",
  PLANNED: "Planificada",
};

const STATUS_COLOR: Record<string, "success" | "warning" | "danger" | "default"> = {
  ACTIVE: "success",
  CANCELLED: "danger",
  COMPLETED: "default",
  INACTIVE: "warning",
  PLANNED: "default",
};

const columns: ColumnDef<Series>[] = [
  {
    header: "Tipo",
    accessorKey: "kind",
    cell: ({ row }) => (
      <Chip size="sm" variant="soft" color={KIND_COLOR[row.original.kind] ?? "default"}>
        {KIND_LABEL[row.original.kind] ?? row.original.kind}
      </Chip>
    ),
  },
  {
    header: "Nombre",
    accessorKey: "displayName",
    cell: ({ row }) => (
      <span className="text-sm">{row.original.displayName ?? row.original.patientName ?? "—"}</span>
    ),
  },
  {
    header: "Estado",
    accessorKey: "status",
    cell: ({ row }) => (
      <Chip size="sm" variant="soft" color={STATUS_COLOR[row.original.status] ?? "default"}>
        {STATUS_LABEL[row.original.status] ?? row.original.status}
      </Chip>
    ),
  },
  {
    header: "Sesiones",
    accessorKey: "eventsCount",
    cell: ({ row }) => <span className="text-sm">{row.original.eventsCount}</span>,
  },
  {
    header: "Tests",
    accessorKey: "skinTestsCount",
    cell: ({ row }) => <span className="text-sm">{row.original.skinTestsCount}</span>,
  },
  {
    header: "Creada",
    accessorKey: "createdAt",
    cell: ({ row }) => dayjs(row.original.createdAt).format("DD/MM/YYYY"),
  },
];

export function ClinicalSeriesList({ patientId }: { patientId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["patient-clinical-series", patientId],
    queryFn: () => fetchPatientClinicalSeries(patientId),
    staleTime: 1000 * 60,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner label="Cargando series clínicas" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-default-600 text-sm">
        <Activity size={16} />
        {data?.items.length ?? 0} serie(s) clínica(s) vinculadas
      </div>
      <div data-phi-block>
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          enablePagination={false}
          enableToolbar={false}
          noDataMessage="No hay series clínicas vinculadas a este paciente."
          scrollMaxHeight="min(56dvh, 640px)"
        />
      </div>
    </div>
  );
}

import { Chip, Spinner } from "@heroui/react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { FlaskConical } from "lucide-react";
import { DataTable } from "@/components/data-table/DataTable";
import { fetchPatientSkinTests } from "../api";

type SkinTest = Awaited<ReturnType<typeof fetchPatientSkinTests>>["items"][number];

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

const columns: ColumnDef<SkinTest>[] = [
  {
    header: "Fecha",
    accessorKey: "testDate",
    cell: ({ row }) => dayjs(row.original.testDate).format("DD/MM/YYYY"),
  },
  {
    header: "Panel",
    accessorKey: "panelTitle",
    cell: ({ row }) => <span className="text-sm">{row.original.panelTitle ?? "—"}</span>,
  },
  {
    header: "Tipo",
    accessorKey: "seriesKind",
    cell: ({ row }) => (
      <Chip size="sm" variant="soft" color={KIND_COLOR[row.original.seriesKind] ?? "default"}>
        {KIND_LABEL[row.original.seriesKind] ?? row.original.seriesKind}
      </Chip>
    ),
  },
  {
    header: "Resultados",
    accessorKey: "resultsCount",
    cell: ({ row }) => <span className="text-sm">{row.original.resultsCount}</span>,
  },
  {
    header: "Médico",
    accessorKey: "physicianName",
    cell: ({ row }) => (
      <span className="text-default-600 text-sm">{row.original.physicianName ?? "—"}</span>
    ),
  },
];

export function SkinTestsList({ patientId }: { patientId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["patient-skin-tests", patientId],
    queryFn: () => fetchPatientSkinTests(patientId),
    staleTime: 1000 * 60,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner label="Cargando tests cutáneos" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-default-600 text-sm">
        <FlaskConical size={16} />
        {data?.items.length ?? 0} test(s) cutáneo(s) vinculados
      </div>
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        enablePagination={false}
        enableToolbar={false}
        noDataMessage="No hay tests cutáneos vinculados a este paciente."
        scrollMaxHeight="min(56dvh, 640px)"
      />
    </div>
  );
}

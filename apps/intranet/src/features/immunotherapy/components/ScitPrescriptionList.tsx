import { Chip } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Syringe } from "lucide-react";
import { DataTable } from "@/components/data-table/DataTable";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatChile } from "@/lib/dates";
import { listScitPrescriptions } from "../api";
import { immunoKeys } from "../queries";

type ScitItem = Awaited<ReturnType<typeof listScitPrescriptions>>[number];

const PROVIDER_LABEL: Record<string, string> = {
  inmunotek: "Inmunotek",
  roxall: "Roxall",
  diater: "Diater",
};

const PROVIDER_COLOR: Record<string, "accent" | "success" | "warning" | "default"> = {
  inmunotek: "accent",
  roxall: "success",
  diater: "warning",
};

const columns: ColumnDef<ScitItem>[] = [
  {
    header: "Fecha",
    accessorKey: "createdAt",
    cell: ({ row }) => (
      <span className="text-sm">{formatChile(row.original.createdAt, "DD/MM/YYYY HH:mm")}</span>
    ),
  },
  {
    header: "Laboratorio",
    accessorKey: "provider",
    cell: ({ row }) => (
      <Chip size="sm" variant="soft" color={PROVIDER_COLOR[row.original.provider] ?? "default"}>
        {PROVIDER_LABEL[row.original.provider] ?? row.original.provider}
      </Chip>
    ),
  },
  {
    header: "Viales",
    accessorKey: "vials",
    cell: ({ row }) => (
      <span className="text-sm">
        {Array.isArray(row.original.vials) ? row.original.vials.length : 0}
      </span>
    ),
  },
  {
    header: "Resumen",
    accessorKey: "summary",
    cell: ({ row }) => (
      <span className="text-default-600 text-sm">{row.original.summary ?? "—"}</span>
    ),
  },
];

export function ScitPrescriptionList({ patientId }: { patientId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: immunoKeys.scitPrescriptions(patientId),
    queryFn: () => listScitPrescriptions(patientId),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner label="Cargando prescripciones SCIT" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-default-600 text-sm">
        <Syringe size={16} />
        {data?.length ?? 0} prescripción(es) SCIT guardada(s)
      </div>
      <div data-phi-block>
        <DataTable
          columns={columns}
          data={data ?? []}
          enablePagination={false}
          enableToolbar={false}
          noDataMessage="No hay prescripciones SCIT guardadas para este paciente."
          scrollMaxHeight="min(40dvh, 420px)"
        />
      </div>
    </div>
  );
}

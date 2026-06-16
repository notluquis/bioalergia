import { Button, Chip } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { ShieldAlert } from "lucide-react";
import { DataTable } from "@/components/data-table/DataTable";
import { confirmAction } from "@/components/ui/ConfirmDialog";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { PAGE_CONTAINER } from "@/lib/styles";
import { formatChile } from "@/lib/dates";
import { toast } from "@/lib/toast-interceptor";
import { listAdverseReactions, markIspReported } from "../api";
import { immunoKeys } from "../queries";

type Ram = Awaited<ReturnType<typeof listAdverseReactions>>[number];

const WAO: Record<number, { label: string; color: "default" | "warning" | "danger" }> = {
  1: { label: "WAO 1 (leve)", color: "default" },
  2: { label: "WAO 2 (moderada)", color: "warning" },
  3: { label: "WAO 3 (resp/CV)", color: "warning" },
  4: { label: "WAO 4 (shock)", color: "danger" },
  5: { label: "WAO 5 (muerte)", color: "danger" },
};

export function FarmacovigilanciaPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: immunoKeys.adverseReactions,
    queryFn: listAdverseReactions,
  });

  const markMutation = useMutation({
    mutationFn: (vars: { id: string; reported: boolean }) =>
      markIspReported({ id: vars.id, reportedToIsp: vars.reported }),
    onSuccess: () => {
      toast.success("Estado de notificación actualizado");
      void queryClient.invalidateQueries({ queryKey: immunoKeys.adverseReactions });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar");
    },
  });

  const onToggleIsp = async (row: Ram) => {
    if (row.reportedToIsp) {
      markMutation.mutate({ id: row.id, reported: false });
      return;
    }
    const ok = await confirmAction({
      title: "Notificar RAM al ISP",
      description: `Confirmas que esta reacción adversa de ${row.patientName} fue notificada al ISP (Norma 140)? Se registrará la fecha de notificación.`,
      confirmLabel: "Marcar notificada",
    });
    if (ok) markMutation.mutate({ id: row.id, reported: true });
  };

  const columns: ColumnDef<Ram>[] = [
    {
      header: "Paciente",
      accessorKey: "patientName",
      cell: ({ row }) => <span className="font-medium text-sm">{row.original.patientName}</span>,
    },
    {
      header: "Fecha",
      accessorKey: "administeredAt",
      cell: ({ row }) => (
        <span className="text-sm">{formatChile(row.original.administeredAt, "DD/MM/YYYY")}</span>
      ),
    },
    {
      header: "Producto / dosis",
      accessorKey: "vialDescription",
      cell: ({ row }) => (
        <span className="text-default-600 text-sm">
          {[row.original.doseLabel, row.original.vialDescription, row.original.vialLot]
            .filter(Boolean)
            .join(" · ") || "—"}
        </span>
      ),
    },
    {
      header: "Reacción",
      accessorKey: "systemicReactionGrade",
      cell: ({ row }) => {
        const g = row.original.systemicReactionGrade;
        return (
          <div className="flex flex-wrap gap-1">
            {g != null && g >= 1 && (
              <Chip size="sm" variant="soft" color={WAO[g]?.color ?? "default"}>
                {WAO[g]?.label ?? `WAO ${g}`}
              </Chip>
            )}
            {row.original.hadLocalReaction && (
              <Chip size="sm" variant="soft" color="default">
                Local
              </Chip>
            )}
          </div>
        );
      },
    },
    {
      header: "ISP",
      accessorKey: "reportedToIsp",
      cell: ({ row }) =>
        row.original.reportedToIsp ? (
          <div className="flex items-center gap-2">
            <Chip size="sm" variant="soft" color="success">
              Notificada{" "}
              {row.original.ispReportedAt
                ? formatChile(row.original.ispReportedAt, "DD/MM/YY")
                : ""}
            </Chip>
            <Button size="sm" variant="ghost" onPress={() => void onToggleIsp(row.original)}>
              Deshacer
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onPress={() => void onToggleIsp(row.original)}>
            Notificar ISP
          </Button>
        ),
    },
  ];

  return (
    <div className={PAGE_CONTAINER}>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-danger/10 text-danger">
          <ShieldAlert size={22} />
        </div>
        <div>
          <h1 className="font-bold text-foreground text-xl tracking-tight">Farmacovigilancia</h1>
          <p className="text-default-500 text-sm">
            Reacciones adversas (RAM) de inmunoterapia y su notificación al ISP (Norma 140).
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner label="Cargando reacciones adversas" />
        </div>
      ) : (
        <div data-phi-block>
          <DataTable
            columns={columns}
            data={data ?? []}
            noDataMessage="No hay reacciones adversas registradas en el carnet de inmunoterapia."
            scrollMaxHeight="min(64dvh, 720px)"
          />
        </div>
      )}
    </div>
  );
}

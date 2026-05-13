// oxlint-disable typescript/no-non-null-assertion -- TODO(strict-null): refactor each `!` to invariant() or explicit guard. Tracked in repo-wide non-null cleanup.
import { Button, Chip } from "@heroui/react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { Activity, PackageCheck, PlusCircle, Printer, Truck } from "lucide-react";
import { useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { toast } from "@/lib/toast-interceptor";
import { CreateShipmentWizard } from "./CreateShipmentWizard";
import { ShipmentTrackingModal } from "./ShipmentTrackingModal";
import { fetchShipments, reprintLabel } from "../api";

type Shipment = Awaited<ReturnType<typeof fetchShipments>>["shipments"][number];

const CLP = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" });

const STATUS_COLOR: Record<string, "success" | "warning" | "default"> = {
  CREATED: "success",
  PENDING: "warning",
};

function buildColumns(
  onTrack: (shipment: Shipment) => void,
  onReprint: (shipmentId: number, otNumber: string) => void,
  reprintPendingId: number | null
): ColumnDef<Shipment>[] {
  return [
    {
      header: "OT",
      accessorKey: "otNumber",
      cell: ({ row }) => (
        <span className="font-mono font-medium text-primary text-sm">{row.original.otNumber}</span>
      ),
    },
    {
      header: "Servicio",
      accessorKey: "serviceDescription",
      cell: ({ row }) => <span className="text-sm">{row.original.serviceDescription}</span>,
    },
    {
      header: "Destinatario",
      accessorKey: "recipientName",
      cell: ({ row }) => <span data-phi>{row.original.recipientName}</span>,
    },
    {
      header: "Sucursal",
      accessorKey: "commercialOfficeName",
      cell: ({ row }) => (
        <span className="text-default-600 text-sm">{row.original.commercialOfficeName}</span>
      ),
    },
    {
      header: "Pago",
      id: "payment",
      cell: ({ row }) =>
        Number(row.original.cashOnDelivery) > 0 ? (
          <Chip size="sm" variant="soft" color="warning">
            Por cobrar {CLP.format(Number(row.original.cashOnDelivery))}
          </Chip>
        ) : (
          <Chip size="sm" variant="soft" color="default">
            Prepagado
          </Chip>
        ),
    },
    {
      header: "Estado",
      accessorKey: "status",
      cell: ({ row }) => (
        <Chip size="sm" variant="soft" color={STATUS_COLOR[row.original.status] ?? "default"}>
          {row.original.status}
        </Chip>
      ),
    },
    {
      header: "Fecha",
      accessorKey: "createdAt",
      cell: ({ row }) => dayjs(row.original.createdAt).format("DD/MM/YYYY HH:mm"),
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="tertiary"
            isIconOnly
            aria-label="Tracking"
            onPress={() => onTrack(row.original)}
          >
            <Activity size={14} />
          </Button>
          {row.original.labelBase64 ? (
            <Button
              size="sm"
              variant="tertiary"
              isIconOnly
              aria-label="Descargar etiqueta guardada"
              onPress={() => downloadLabel(row.original.otNumber, row.original.labelBase64!)}
            >
              <PackageCheck size={14} />
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="tertiary"
            isIconOnly
            aria-label="Reimprimir etiqueta desde Chilexpress"
            isPending={reprintPendingId === row.original.id}
            onPress={() => onReprint(row.original.id, row.original.otNumber)}
          >
            <Printer size={14} />
          </Button>
        </div>
      ),
    },
  ];
}

function downloadLabel(otNumber: string, base64: string) {
  const byteChars = atob(base64);
  const byteNums = Array.from({ length: byteChars.length }, (_, i) => byteChars.charCodeAt(i));
  const blob = new Blob([new Uint8Array(byteNums)], { type: "image/png" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `etiqueta-${otNumber}.png`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ShipmentsList({
  patientId,
  patientName,
}: {
  patientId: number;
  patientName: string;
}) {
  const queryClient = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [tracking, setTracking] = useState<{ id: number; otNumber: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["shipments", patientId],
    queryFn: () => fetchShipments(patientId),
    staleTime: 1000 * 60,
  });

  // Refetches a fresh label from Chilexpress, decodes the base64 and
  // triggers an immediate download. The server also caches the fresh
  // label on the shipment row so the next "Descargar etiqueta
  // guardada" button stays in sync.
  const reprintMutation = useMutation({
    mutationFn: (shipmentId: number) => reprintLabel(shipmentId),
    onSuccess: (res, shipmentId) => {
      const ot =
        data?.shipments.find((s) => s.id === shipmentId)?.otNumber ?? `shipment-${shipmentId}`;
      const label = res.result.label;
      if (label) {
        downloadLabel(ot, label);
        toast.success("Etiqueta regenerada desde Chilexpress");
      } else {
        toast.error("Chilexpress no devolvió etiqueta. Intenta de nuevo.");
      }
      void queryClient.invalidateQueries({ queryKey: ["shipments", patientId] });
    },
    onError: (err) => toast.error(`Reimpresión: ${(err as Error).message}`),
  });

  const columns = buildColumns(
    (s) => setTracking({ id: s.id, otNumber: s.otNumber }),
    (shipmentId) => reprintMutation.mutate(shipmentId),
    reprintMutation.isPending ? (reprintMutation.variables ?? null) : null
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner label="Cargando despachos" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-default-600 text-sm">
            <Truck size={16} />
            {data?.shipments.length ?? 0} despacho(s) registrados
          </div>
          <Button size="sm" className="gap-2" onPress={() => setWizardOpen(true)}>
            <PlusCircle size={16} />
            Nuevo Despacho
          </Button>
        </div>

        <div data-phi-block>
          <DataTable
            columns={columns}
            data={data?.shipments ?? []}
            enablePagination={false}
            enableToolbar={false}
            noDataMessage="No hay despachos registrados para este paciente."
            scrollMaxHeight="min(56dvh, 640px)"
          />
        </div>
      </div>

      {wizardOpen && (
        <CreateShipmentWizard
          isOpen={wizardOpen}
          onClose={() => setWizardOpen(false)}
          patientId={patientId}
          patientName={patientName}
        />
      )}

      <ShipmentTrackingModal
        isOpen={tracking !== null}
        onClose={() => setTracking(null)}
        shipmentId={tracking?.id ?? null}
        otNumber={tracking?.otNumber ?? null}
      />
    </>
  );
}

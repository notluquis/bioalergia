import { Button, Chip, Spinner } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { PackageCheck, PlusCircle, Truck } from "lucide-react";
import { useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { CreateShipmentWizard } from "./CreateShipmentWizard";
import { fetchShipments } from "../api";

type Shipment = Awaited<ReturnType<typeof fetchShipments>>["shipments"][number];

const CLP = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" });

const STATUS_COLOR: Record<string, "success" | "warning" | "default"> = {
  CREATED: "success",
  PENDING: "warning",
};

const columns: ColumnDef<Shipment>[] = [
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
    id: "label",
    cell: ({ row }) =>
      row.original.labelBase64 ? (
        <Button
          size="sm"
          variant="ghost"
          isIconOnly
          onPress={() => downloadLabel(row.original.otNumber, row.original.labelBase64!)}
        >
          <PackageCheck size={16} />
        </Button>
      ) : null,
  },
];

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
  const [wizardOpen, setWizardOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["shipments", patientId],
    queryFn: () => fetchShipments(patientId),
    staleTime: 1000 * 60,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner aria-label="Cargando despachos" />
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

        <DataTable
          columns={columns}
          data={data?.shipments ?? []}
          enablePagination={false}
          enableToolbar={false}
          noDataMessage="No hay despachos registrados para este paciente."
          scrollMaxHeight="min(56dvh, 640px)"
        />
      </div>

      {wizardOpen && (
        <CreateShipmentWizard
          isOpen={wizardOpen}
          onClose={() => setWizardOpen(false)}
          patientId={patientId}
          patientName={patientName}
        />
      )}
    </>
  );
}

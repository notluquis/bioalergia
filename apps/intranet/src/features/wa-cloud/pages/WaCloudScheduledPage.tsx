import { formatChile } from "@/lib/dates";
import { Button, Card, Chip } from "@heroui/react";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarClock, X } from "lucide-react";
import { useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { confirmAction } from "@/components/ui/ConfirmDialog";
import { SelectInput } from "@/features/outreach/components/FormField";
import { toast } from "@/lib/toast-interceptor";
import { useAllScheduled, useCancelScheduled } from "../hooks/useWaCloud";

const STATUS_COLOR: Record<string, "success" | "warning" | "danger" | "default"> = {
  PENDING: "warning",
  SENT: "success",
  FAILED: "danger",
  CANCELLED: "default",
};

const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "PENDING", label: "Pendientes" },
  { value: "SENT", label: "Enviados" },
  { value: "FAILED", label: "Fallidos" },
  { value: "CANCELLED", label: "Cancelados" },
];

export function WaCloudScheduledPage() {
  const [status, setStatus] = useState<"" | "PENDING" | "SENT" | "FAILED" | "CANCELLED">("");
  const all = useAllScheduled(
    status
      ? { status: status as "PENDING" | "SENT" | "FAILED" | "CANCELLED", limit: 200 }
      : undefined
  );
  const cancel = useCancelScheduled();
  const items = all.data?.scheduled ?? [];
  type ScheduledRow = (typeof items)[number];

  const columns: ColumnDef<ScheduledRow>[] = [
    {
      id: "scheduledAt",
      header: "Fecha",
      cell: ({ row }) => (
        <span className="font-mono text-default-700 text-xs">
          {formatChile(row.original.scheduledAt, "DD-MM HH:mm")}
        </span>
      ),
    },
    {
      id: "contact",
      header: "Contacto",
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-sm">
            {row.original.contactName ?? row.original.phoneE164}
          </p>
          <p className="font-mono text-default-400 text-xs">{row.original.phoneE164}</p>
        </div>
      ),
    },
    {
      id: "type",
      header: "Tipo",
      cell: ({ row }) => (
        <Chip size="sm" variant="soft" color="default">
          <Chip.Label>{row.original.type}</Chip.Label>
        </Chip>
      ),
    },
    {
      id: "body",
      header: "Mensaje",
      cell: ({ row }) => (
        <p className="line-clamp-2 max-w-md text-default-700 text-xs">
          {row.original.body ??
            (row.original.templateName ? `[plantilla] ${row.original.templateName}` : "—")}
        </p>
      ),
    },
    {
      id: "status",
      header: "Estado",
      cell: ({ row }) => (
        <>
          <Chip size="sm" color={STATUS_COLOR[row.original.status]} variant="soft">
            <Chip.Label>{row.original.status}</Chip.Label>
          </Chip>
          {row.original.errorMessage && (
            <p className="mt-0.5 line-clamp-1 text-danger text-xs">{row.original.errorMessage}</p>
          )}
        </>
      ),
    },
    {
      id: "actions",
      header: "Acción",
      cell: ({ row }) => {
        const s = row.original;
        if (s.status !== "PENDING") return null;
        return (
          <Button
            size="sm"
            variant="danger-soft"
            isIconOnly
            aria-label="Cancelar"
            isPending={cancel.isPending}
            onPress={() => {
              void (async () => {
                const ok = await confirmAction({
                  title: "Cancelar envío programado",
                  description: "El mensaje no se enviará. Esta acción no se puede deshacer.",
                  confirmLabel: "Cancelar envío",
                  cancelLabel: "Volver",
                  variant: "danger",
                });
                if (!ok) return;
                cancel.mutate(s.id, {
                  onSuccess: () => toast.success("Cancelado"),
                  onError: (e) => toast.error(`Error: ${String(e)}`),
                });
              })();
            }}
          >
            <X size={12} />
          </Button>
        );
      },
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-lg">
          <CalendarClock size={18} className="text-warning" />
          Mensajes programados
        </h2>
        <div className="w-56">
          <SelectInput
            label=""
            value={status}
            onValueChange={(v) => setStatus(v as "" | "PENDING" | "SENT" | "FAILED" | "CANCELLED")}
            options={STATUS_OPTIONS}
          />
        </div>
      </div>

      <Card>
        <Card.Content className="p-0">
          <DataTable
            enableToolbar={false}
            columns={columns}
            data={items}
            isLoading={all.isLoading}
            noDataMessage="Sin mensajes programados."
          />
        </Card.Content>
      </Card>
    </div>
  );
}

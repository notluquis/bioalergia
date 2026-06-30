import { Button, Chip } from "@heroui/react";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, PackageCheck, RotateCcw, XCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { OrderStatus, OrderSummary } from "../types";

export interface OrdersTableMeta {
  /** `can("update", "ShopOrder")` — gates the "Marcar despachado" action. */
  canUpdate: boolean;
  /** Open the read-only detail modal for a row. */
  onView: (id: number) => void;
  /** Mark a PAID order as FULFILLED (confirmed upstream). */
  onFulfill: (id: number) => void;
  /** Id currently being fulfilled (drives the per-row pending state). */
  fulfillingId: number | null;
  /** Cancel a PENDING order (releases stock, sets CANCELLED). */
  onCancel: (id: number) => void;
  /** Id currently being cancelled (drives the per-row pending state). */
  cancellingId: number | null;
  /** Refund a PAID order (MercadoPago refund + restock + REFUNDED). */
  onRefund: (id: number) => void;
  /** Id currently being refunded (drives the per-row pending state). */
  refundingId: number | null;
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pendiente",
  PAID: "Pagado",
  FULFILLED: "Despachado",
  CANCELLED: "Cancelado",
  REFUNDED: "Reembolsado",
};

const STATUS_COLOR: Record<OrderStatus, "success" | "warning" | "danger" | "accent" | "default"> = {
  PENDING: "warning",
  PAID: "accent",
  FULFILLED: "success",
  CANCELLED: "danger",
  REFUNDED: "default",
};

export const columns: ColumnDef<OrderSummary>[] = [
  {
    accessorKey: "number",
    cell: ({ row }) => (
      <span className="font-medium font-mono text-primary text-sm">{row.original.number}</span>
    ),
    header: "Número",
  },
  {
    accessorKey: "customer_name",
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-medium text-foreground text-sm">{row.original.customer_name}</span>
        <span
          className="block max-w-56 truncate text-default-400 text-xs"
          title={row.original.customer_email}
        >
          {row.original.customer_email}
        </span>
      </div>
    ),
    header: "Cliente",
    minSize: 190,
    size: 220,
  },
  {
    accessorKey: "total_clp",
    cell: ({ row }) => (
      <span className="font-medium text-foreground tabular-nums">
        {formatCurrency(row.original.total_clp)}
      </span>
    ),
    header: () => <div className="text-right">Total</div>,
    meta: { className: "text-right" },
  },
  {
    accessorKey: "status",
    cell: ({ row }) => (
      <Chip
        className="font-medium"
        color={STATUS_COLOR[row.original.status]}
        size="sm"
        variant="soft"
      >
        {STATUS_LABEL[row.original.status]}
      </Chip>
    ),
    header: "Estado",
  },
  {
    cell: ({ row }) => {
      const { billing_type, dte_folio, dte_type } = row.original;
      const docLabel = billing_type === "BOLETA" ? "Boleta" : "Factura";
      return (
        <div className="flex flex-col">
          <span className="text-foreground text-sm">{docLabel}</span>
          <span className="font-mono text-default-400 text-xs">
            {dte_folio ? `${dte_type ?? "DTE"} · ${dte_folio}` : "Sin folio"}
          </span>
        </div>
      );
    },
    header: "Documento",
    id: "billing",
    minSize: 150,
  },
  {
    accessorKey: "created_at",
    cell: ({ row }) => (
      <span className="text-default-600 text-sm">
        {row.original.created_at.toLocaleDateString("es-CL")}
      </span>
    ),
    header: "Fecha",
  },
  {
    cell: ({ row, table }) => {
      const meta = table.options.meta as OrdersTableMeta;
      const order = row.original;
      const showFulfill = meta.canUpdate && order.status === "PAID";
      const showCancel = meta.canUpdate && order.status === "PENDING";
      const showRefund = meta.canUpdate && order.status === "PAID";

      return (
        <div className="flex justify-end gap-2 whitespace-nowrap">
          <Button
            onPress={() => {
              meta.onView(order.id);
            }}
            size="sm"
            variant="outline"
          >
            <Eye className="size-4" />
            Ver
          </Button>
          {showCancel ? (
            <Button
              isPending={meta.cancellingId === order.id}
              onPress={() => {
                meta.onCancel(order.id);
              }}
              size="sm"
              variant="secondary"
            >
              <XCircle className="size-4" />
              Cancelar
            </Button>
          ) : null}
          {showFulfill ? (
            <Button
              isPending={meta.fulfillingId === order.id}
              onPress={() => {
                meta.onFulfill(order.id);
              }}
              size="sm"
              variant="primary"
            >
              <PackageCheck className="size-4" />
              Marcar despachado
            </Button>
          ) : null}
          {showRefund ? (
            <Button
              isPending={meta.refundingId === order.id}
              onPress={() => {
                meta.onRefund(order.id);
              }}
              size="sm"
              variant="danger"
            >
              <RotateCcw className="size-4" />
              Reembolsar
            </Button>
          ) : null}
        </div>
      );
    },
    header: () => <div className="text-right">Acciones</div>,
    id: "actions",
  },
];

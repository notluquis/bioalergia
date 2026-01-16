import { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { ArrowDownToLine, ArrowUpFromLine, ChevronDown, ChevronRight } from "lucide-react";

import { formatAmount } from "@/features/finance/utils";

import { ReleaseTransaction } from "../types";

const moneyColumn = (
  accessorKey: keyof ReleaseTransaction,
  header: string,
  align: "right" | "center" = "right",
  isNegative = false
): ColumnDef<ReleaseTransaction> => ({
  accessorKey,
  header,
  minSize: 100,
  cell: ({ row }) => {
    const amount = row.getValue(accessorKey) as number | null;
    const currency = row.original.currency;
    if (!amount) return <div className={`text-${align}`}>-</div>;
    let className = `text-${align}`;
    if (isNegative) className += " text-error";
    return <div className={className}>{formatAmount(amount, currency)}</div>;
  },
});

export const columns: ColumnDef<ReleaseTransaction>[] = [
  {
    id: "expander",
    header: () => null,
    size: 40,
    enableResizing: false,
    enablePinning: true,
    cell: ({ row }) => {
      return row.getCanExpand() ? (
        <button
          {...{
            onClick: row.getToggleExpandedHandler(),
            style: { cursor: "pointer" },
          }}
          className="btn btn-ghost btn-xs hover:bg-base-200 h-6 w-6 rounded-md p-0"
        >
          {row.getIsExpanded() ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
      ) : null;
    },
  },
  {
    accessorKey: "sourceId",
    header: "ID Origen",
    enablePinning: true,
    minSize: 180,
    cell: ({ row }) => (
      <span className="block max-w-37.5 truncate font-medium" title={row.original.sourceId}>
        {" "}
        {row.original.sourceId}
      </span>
    ),
  },
  {
    accessorKey: "date",
    header: "Fecha",
    minSize: 120,
    cell: ({ row }) => dayjs(row.getValue("date")).format("DD/MM/YY HH:mm"),
  },
  {
    accessorKey: "recordType",
    header: "Tipo",
    minSize: 150,
    cell: ({ row }) => (
      <span className="badge badge-outline badge-sm whitespace-nowrap">{row.original.recordType}</span>
    ),
  },
  {
    accessorKey: "description",
    header: "Descripción",
    minSize: 200,
    cell: ({ row }) => (
      <span className="block max-w-50 truncate" title={row.original.description || ""}>
        {" "}
        {row.original.description}
      </span>
    ),
  },
  { accessorKey: "paymentMethod", header: "Método", minSize: 100 },
  { accessorKey: "paymentMethodType", header: "Tipo Método", minSize: 120 },
  {
    accessorKey: "netCreditAmount",
    header: "Crédito",
    minSize: 120,
    cell: ({ row }) => {
      const val = row.original.netCreditAmount;
      if (val && Number(val) > 0) {
        return (
          <div className="text-success flex items-center justify-end gap-1">
            <ArrowDownToLine className="h-3 w-3" />
            {formatAmount(val, row.original.currency)}
          </div>
        );
      }
      return <div className="text-right">-</div>;
    },
  },
  {
    accessorKey: "netDebitAmount",
    header: "Débito",
    minSize: 120,
    cell: ({ row }) => {
      const val = row.original.netDebitAmount;
      if (val && Number(val) > 0) {
        return (
          <div className="text-error flex items-center justify-end gap-1">
            <ArrowUpFromLine className="h-3 w-3" />
            {formatAmount(val, row.original.currency)}
          </div>
        );
      }
      return <div className="text-right">-</div>;
    },
  },
  moneyColumn("grossAmount", "Bruto"),
  moneyColumn("sellerAmount", "Vendedor"),
  moneyColumn("mpFeeAmount", "Comisión MP", "right", true),
  moneyColumn("financingFeeAmount", "Costo Fin.", "right", true),
  moneyColumn("shippingFeeAmount", "Costo Envío", "right", true),
  moneyColumn("taxesAmount", "Impuestos", "right", true),
  moneyColumn("couponAmount", "Cupón"),
  moneyColumn("balanceAmount", "Balance"),
  {
    accessorKey: "installments",
    header: "Cuotas",
    size: 80,
    cell: ({ row }) => <div className="text-center">{row.original.installments}</div>,
  },
  { accessorKey: "posName", header: "POS", minSize: 150 },
  { accessorKey: "storeName", header: "Tienda", minSize: 150 },
  {
    accessorKey: "externalReference",
    header: "Ref. Externa",
    minSize: 150,
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.externalReference}</span>,
  },
  {
    accessorKey: "orderId",
    header: "ID Orden",
    minSize: 120,
    cell: ({ row }) => <span className="font-mono text-xs">{String(row.original.orderId || "-")}</span>,
  },
  {
    accessorKey: "shippingId",
    header: "ID Envío",
    minSize: 120,
    cell: ({ row }) => <span className="font-mono text-xs">{String(row.original.shippingId || "-")}</span>,
  },

  // New columns
  moneyColumn("effectiveCouponAmount", "Cupón Efec."),
  moneyColumn("taxAmountTelco", "Imp. Telco", "right", true),
  {
    accessorKey: "transactionApprovalDate",
    header: "Fecha Aprob.",
    minSize: 120,
    cell: ({ row }) =>
      row.original.transactionApprovalDate ? dayjs(row.original.transactionApprovalDate).format("DD/MM/YY HH:mm") : "-",
  },
  { accessorKey: "transactionIntentId", header: "Intent ID", minSize: 150 },
  { accessorKey: "posId", header: "ID POS", minSize: 120 },
  { accessorKey: "externalPosId", header: "Ext. POS ID", minSize: 120 },
  { accessorKey: "storeId", header: "ID Tienda", minSize: 120 },
  { accessorKey: "externalStoreId", header: "Ext. Store ID", minSize: 120 },
  { accessorKey: "shipmentMode", header: "Modo Envío", size: 100 },
  { accessorKey: "shippingOrderId", header: "ID Orden Envío", minSize: 150 },
  {
    accessorKey: "packId",
    header: "ID Paquete",
    minSize: 120,
    cell: ({ row }) => <span className="font-mono text-xs">{String(row.original.packId || "-")}</span>,
  },
  { accessorKey: "poiId", header: "POI ID", minSize: 120 },
  { accessorKey: "itemId", header: "Item ID", minSize: 120 },
  { accessorKey: "cardInitialNumber", header: "BIN Tarjeta", size: 90 },
  { accessorKey: "lastFourDigits", header: "Últimos 4", size: 90 },
  { accessorKey: "franchise", header: "Franquicia", minSize: 120 },
  { accessorKey: "issuerName", header: "Emisor", minSize: 150 },
  { accessorKey: "poiBankName", header: "Banco POI", minSize: 150 },
  { accessorKey: "poiWalletName", header: "Wallet", minSize: 150 },
  { accessorKey: "businessUnit", header: "Unidad Negocio", minSize: 120 },
  { accessorKey: "subUnit", header: "Sub Unidad", minSize: 120 },
  { accessorKey: "payoutBankAccountNumber", header: "Cta. Pago", minSize: 150 },
  { accessorKey: "productSku", header: "SKU", minSize: 150 },
  { accessorKey: "saleDetail", header: "Detalle Venta", minSize: 200 },
  { accessorKey: "orderMp", header: "Orden MP", minSize: 150 },
  { accessorKey: "purchaseId", header: "ID Compra", minSize: 150 },
  { accessorKey: "taxDetail", header: "Detalle Imp.", minSize: 120 },
];

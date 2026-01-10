import { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

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
    accessorKey: "sourceId",
    header: "ID Origen",
    cell: ({ row }) => (
      <span className="block max-w-[150px] truncate" title={row.original.sourceId}>
        {row.original.sourceId}
      </span>
    ),
  },
  {
    accessorKey: "date",
    header: "Fecha",
    cell: ({ row }) => dayjs(row.getValue("date")).format("DD/MM/YY HH:mm"),
  },
  {
    accessorKey: "recordType",
    header: "Tipo",
    cell: ({ row }) => (
      <span className="badge badge-outline badge-sm whitespace-nowrap">{row.original.recordType}</span>
    ),
  },
  {
    accessorKey: "description",
    header: "Descripción",
    cell: ({ row }) => (
      <span className="block max-w-[200px] truncate" title={row.original.description || ""}>
        {row.original.description}
      </span>
    ),
  },
  { accessorKey: "paymentMethod", header: "Método" },
  { accessorKey: "paymentMethodType", header: "Tipo Método" },
  {
    accessorKey: "netCreditAmount",
    header: "Crédito",
    cell: ({ row }) => {
      const val = row.original.netCreditAmount;
      if (val && val > 0) {
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
    cell: ({ row }) => {
      const val = row.original.netDebitAmount;
      if (val && val > 0) {
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
    cell: ({ row }) => <div className="text-center">{row.original.installments}</div>,
  },
  { accessorKey: "posName", header: "POS" },
  { accessorKey: "storeName", header: "Tienda" },
  {
    accessorKey: "externalReference",
    header: "Ref. Externa",
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.externalReference}</span>,
  },
  {
    accessorKey: "orderId",
    header: "ID Orden",
    cell: ({ row }) => <span className="font-mono text-xs">{String(row.original.orderId || "-")}</span>,
  },
  {
    accessorKey: "shippingId",
    header: "ID Envío",
    cell: ({ row }) => <span className="font-mono text-xs">{String(row.original.shippingId || "-")}</span>,
  },

  // New columns
  moneyColumn("effectiveCouponAmount", "Cupón Efec."),
  moneyColumn("taxAmountTelco", "Imp. Telco", "right", true),
  {
    accessorKey: "transactionApprovalDate",
    header: "Fecha Aprob.",
    cell: ({ row }) =>
      row.original.transactionApprovalDate ? dayjs(row.original.transactionApprovalDate).format("DD/MM/YY HH:mm") : "-",
  },
  { accessorKey: "transactionIntentId", header: "Intent ID" },
  { accessorKey: "posId", header: "ID POS" },
  { accessorKey: "externalPosId", header: "Ext. POS ID" },
  { accessorKey: "storeId", header: "ID Tienda" },
  { accessorKey: "externalStoreId", header: "Ext. Store ID" },
  { accessorKey: "shipmentMode", header: "Modo Envío" },
  { accessorKey: "shippingOrderId", header: "ID Orden Envío" },
  {
    accessorKey: "packId",
    header: "ID Paquete",
    cell: ({ row }) => <span className="font-mono text-xs">{String(row.original.packId || "-")}</span>,
  },
  { accessorKey: "poiId", header: "POI ID" },
  { accessorKey: "itemId", header: "Item ID" },
  { accessorKey: "cardInitialNumber", header: "BIN Tarjeta" },
  { accessorKey: "lastFourDigits", header: "Últimos 4" },
  { accessorKey: "franchise", header: "Franquicia" },
  { accessorKey: "issuerName", header: "Emisor" },
  { accessorKey: "poiBankName", header: "Banco POI" },
  { accessorKey: "poiWalletName", header: "Wallet" },
  { accessorKey: "businessUnit", header: "Unidad Negocio" },
  { accessorKey: "subUnit", header: "Sub Unidad" },
  { accessorKey: "payoutBankAccountNumber", header: "Cta. Pago" },
  { accessorKey: "productSku", header: "SKU" },
  { accessorKey: "saleDetail", header: "Detalle Venta" },
  { accessorKey: "orderMp", header: "Orden MP" },
  { accessorKey: "purchaseId", header: "ID Compra" },
  { accessorKey: "taxDetail", header: "Detalle Imp." },
];

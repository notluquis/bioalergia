import { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { ChevronDown, ChevronRight } from "lucide-react";

import { formatAmount } from "@/features/finance/utils";

import { SettlementTransaction } from "../types";

const moneyColumn = (
  accessorKey: keyof SettlementTransaction,
  header: string,
  align: "center" | "right" = "right",
  isNegative = false
): ColumnDef<SettlementTransaction> => ({
  accessorKey,
  cell: ({ row }) => {
    const amount = row.getValue(accessorKey);
    const currency = row.original.transactionCurrency;
    if (amount == null) return <div className={`text-${align}`}>-</div>;

    let className = `text-${align}`;
    if (accessorKey === "settlementNetAmount" && amount > 0) className += " text-success font-medium";
    if (isNegative) className += " text-error";

    return <div className={className}>{formatAmount(amount, currency)}</div>;
  },
  header,
  minSize: 100,
});

const dateColumn = (accessorKey: keyof SettlementTransaction, header: string): ColumnDef<SettlementTransaction> => ({
  accessorKey,
  cell: ({ row }) => {
    const val = row.getValue(accessorKey);
    if (!val) return "-";
    return dayjs(val).format("DD/MM/YY HH:mm");
  },
  header,
  minSize: 120,
});

export const columns: ColumnDef<SettlementTransaction>[] = [
  {
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
    enablePinning: true,
    enableResizing: false,
    header: () => null,
    id: "expander",
    size: 40,
  },
  {
    accessorKey: "sourceId",
    cell: ({ row }) => (
      <span className="block max-w-37.5 truncate font-medium" title={row.original.sourceId}>
        {row.original.sourceId}
      </span>
    ),
    enablePinning: true, // Hint for UI, logic handled in DataTable state
    header: "ID Origen",
    minSize: 180,
  },
  // ... rest of columns ...
  dateColumn("transactionDate", "Fecha Tx"),
  dateColumn("settlementDate", "Fecha Liq"),
  dateColumn("moneyReleaseDate", "Fecha Lib."),
  {
    accessorKey: "transactionType",
    cell: ({ row }) => (
      <span className="badge badge-outline badge-sm whitespace-nowrap">{row.original.transactionType}</span>
    ),
    header: "Tipo",
    minSize: 150,
  },
  { accessorKey: "paymentMethod", header: "Método", minSize: 100 },
  { accessorKey: "paymentMethodType", header: "Tipo Método", minSize: 120 },
  moneyColumn("transactionAmount", "Monto Tx"),
  {
    accessorKey: "transactionCurrency",
    cell: ({ row }) => <div className="text-center">{row.original.transactionCurrency}</div>,
    header: "Moneda",
    size: 80,
  },
  moneyColumn("feeAmount", "Comisión", "right", true),
  moneyColumn("settlementNetAmount", "Neto Liq"),
  {
    accessorKey: "settlementCurrency",
    cell: ({ row }) => <div className="text-center">{row.original.settlementCurrency}</div>,
    header: "Moneda Liq",
    size: 80,
  },
  moneyColumn("sellerAmount", "Monto Vendedor"),
  moneyColumn("realAmount", "Monto Real"),
  moneyColumn("couponAmount", "Cupón"),
  moneyColumn("mkpFeeAmount", "Comisión MKP", "right", true),
  moneyColumn("financingFeeAmount", "Costo Fin.", "right", true),
  moneyColumn("shippingFeeAmount", "Costo Envío", "right", true),
  moneyColumn("taxesAmount", "Impuestos", "right", true),
  {
    accessorKey: "installments",
    cell: ({ row }) => <div className="text-center">{row.original.installments}</div>,
    header: "Cuotas",
    size: 80,
  },
  {
    accessorKey: "description",
    cell: ({ row }) => (
      <span className="block max-w-50 truncate" title={row.original.description || ""}>
        {row.original.description}
      </span>
    ),
    header: "Descripción",
    minSize: 200,
  },
  { accessorKey: "cardInitialNumber", header: "BIN", size: 90 },
  { accessorKey: "lastFourDigits", header: "Últimos 4", size: 90 },
  { accessorKey: "issuerName", header: "Emisor", minSize: 150 },
  {
    accessorKey: "isReleased",
    cell: ({ row }) => (
      <div className="text-center">
        {row.original.isReleased ? (
          <span className="text-success text-xs font-bold">SÍ</span>
        ) : (
          <span className="text-warning text-xs">NO</span>
        )}
      </div>
    ),
    header: "Liberado",
    size: 90,
  },
  { accessorKey: "posName", header: "POS", minSize: 150 },
  { accessorKey: "storeName", header: "Tienda", minSize: 150 },
  { accessorKey: "externalReference", header: "Ref. Ext.", minSize: 150 },
  { accessorKey: "orderMp", header: "Orden MP", minSize: 150 },
  {
    accessorKey: "shippingId",
    cell: ({ row }) => <span className="font-mono text-xs">{String(row.original.shippingId || "-")}</span>,
    header: "ID Envío",
    minSize: 120,
  },
  {
    accessorKey: "orderId",
    cell: ({ row }) => <span className="font-mono text-xs">{String(row.original.orderId || "-")}</span>,
    header: "ID Orden",
    minSize: 120,
  },
  moneyColumn("tipAmount", "Propina"),
  moneyColumn("totalCouponAmount", "Total Cupón"),

  // New Columns
  { accessorKey: "userId", header: "User ID", minSize: 120 },
  { accessorKey: "site", header: "Sitio", size: 80 },
  { accessorKey: "businessUnit", header: "Unidad Negocio", minSize: 120 },
  { accessorKey: "subUnit", header: "Sub Unidad", minSize: 120 },
  { accessorKey: "productSku", header: "SKU", minSize: 150 },
  { accessorKey: "saleDetail", header: "Detalle Venta", minSize: 200 },
  { accessorKey: "transactionIntentId", header: "Intent ID", minSize: 150 },
  { accessorKey: "franchise", header: "Franquicia", minSize: 120 },
  { accessorKey: "invoicingPeriod", header: "Periodo Fac.", minSize: 120 },
  { accessorKey: "payBankTransferId", header: "ID Transf.", minSize: 150 },
  { accessorKey: "purchaseId", header: "ID Compra", minSize: 150 },
  { accessorKey: "posId", header: "ID POS", minSize: 120 },
  { accessorKey: "externalPosId", header: "Ext. POS ID", minSize: 120 },
  { accessorKey: "storeId", header: "ID Tienda", minSize: 120 },
  { accessorKey: "externalStoreId", header: "Ext. Store ID", minSize: 120 },
  { accessorKey: "poiId", header: "POI ID", minSize: 120 },
  { accessorKey: "shipmentMode", header: "Modo Envío", size: 100 },
  {
    accessorKey: "packId",
    cell: ({ row }) => <span className="font-mono text-xs">{String(row.original.packId || "-")}</span>,
    header: "ID Paquete",
    minSize: 120,
  },
  { accessorKey: "shippingOrderId", header: "ID Orden Envío", minSize: 150 },
  { accessorKey: "poiWalletName", header: "Wallet", minSize: 150 },
  { accessorKey: "poiBankName", header: "Banco POI", minSize: 150 },
  { accessorKey: "taxDetail", header: "Detalle Imp.", minSize: 120 },
];

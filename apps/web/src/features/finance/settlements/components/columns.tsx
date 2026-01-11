import { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { ChevronDown, ChevronRight } from "lucide-react";

import { formatAmount } from "@/features/finance/utils";

import { SettlementTransaction } from "../types";

const moneyColumn = (
  accessorKey: keyof SettlementTransaction,
  header: string,
  align: "right" | "center" = "right",
  isNegative = false
): ColumnDef<SettlementTransaction> => ({
  accessorKey,
  header,
  minSize: 100,
  cell: ({ row }) => {
    const amount = row.getValue(accessorKey) as number | null;
    const currency = row.original.transactionCurrency;
    if (amount == null) return <div className={`text-${align}`}>-</div>;

    let className = `text-${align}`;
    if (accessorKey === "settlementNetAmount" && amount > 0) className += " text-success font-medium";
    if (isNegative) className += " text-error";

    return <div className={className}>{formatAmount(amount, currency)}</div>;
  },
});

const dateColumn = (accessorKey: keyof SettlementTransaction, header: string): ColumnDef<SettlementTransaction> => ({
  accessorKey,
  header,
  minSize: 120,
  cell: ({ row }) => {
    const val = row.getValue(accessorKey) as string | null;
    if (!val) return "-";
    return dayjs(val).format("DD/MM/YY HH:mm");
  },
});

export const columns: ColumnDef<SettlementTransaction>[] = [
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
    enablePinning: true, // Hint for UI, logic handled in DataTable state
    minSize: 180,
    cell: ({ row }) => (
      <span className="block max-w-37.5 truncate font-medium" title={row.original.sourceId}>
        {row.original.sourceId}
      </span>
    ),
  },
  // ... rest of columns ...
  dateColumn("transactionDate", "Fecha Tx"),
  dateColumn("settlementDate", "Fecha Liq"),
  dateColumn("moneyReleaseDate", "Fecha Lib."),
  {
    accessorKey: "transactionType",
    header: "Tipo",
    minSize: 150,
    cell: ({ row }) => (
      <span className="badge badge-outline badge-sm whitespace-nowrap">{row.original.transactionType}</span>
    ),
  },
  { accessorKey: "paymentMethod", header: "Método", minSize: 100 },
  { accessorKey: "paymentMethodType", header: "Tipo Método", minSize: 120 },
  moneyColumn("transactionAmount", "Monto Tx"),
  {
    accessorKey: "transactionCurrency",
    header: "Moneda",
    size: 80,
    cell: ({ row }) => <div className="text-center">{row.original.transactionCurrency}</div>,
  },
  moneyColumn("feeAmount", "Comisión", "right", true),
  moneyColumn("settlementNetAmount", "Neto Liq"),
  {
    accessorKey: "settlementCurrency",
    header: "Moneda Liq",
    size: 80,
    cell: ({ row }) => <div className="text-center">{row.original.settlementCurrency}</div>,
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
    header: "Cuotas",
    size: 80,
    cell: ({ row }) => <div className="text-center">{row.original.installments}</div>,
  },
  {
    accessorKey: "description",
    header: "Descripción",
    minSize: 200,
    cell: ({ row }) => (
      <span className="block max-w-50 truncate" title={row.original.description || ""}>
        {row.original.description}
      </span>
    ),
  },
  { accessorKey: "cardInitialNumber", header: "BIN", size: 90 },
  { accessorKey: "lastFourDigits", header: "Últimos 4", size: 90 },
  { accessorKey: "issuerName", header: "Emisor", minSize: 150 },
  {
    accessorKey: "isReleased",
    header: "Liberado",
    size: 90,
    cell: ({ row }) => (
      <div className="text-center">
        {row.original.isReleased ? (
          <span className="text-success text-xs font-bold">SÍ</span>
        ) : (
          <span className="text-warning text-xs">NO</span>
        )}
      </div>
    ),
  },
  { accessorKey: "posName", header: "POS", minSize: 150 },
  { accessorKey: "storeName", header: "Tienda", minSize: 150 },
  { accessorKey: "externalReference", header: "Ref. Ext.", minSize: 150 },
  { accessorKey: "orderMp", header: "Orden MP", minSize: 150 },
  {
    accessorKey: "shippingId",
    header: "ID Envío",
    minSize: 120,
    cell: ({ row }) => <span className="font-mono text-xs">{String(row.original.shippingId || "-")}</span>,
  },
  {
    accessorKey: "orderId",
    header: "ID Orden",
    minSize: 120,
    cell: ({ row }) => <span className="font-mono text-xs">{String(row.original.orderId || "-")}</span>,
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
    header: "ID Paquete",
    minSize: 120,
    cell: ({ row }) => <span className="font-mono text-xs">{String(row.original.packId || "-")}</span>,
  },
  { accessorKey: "shippingOrderId", header: "ID Orden Envío", minSize: 150 },
  { accessorKey: "poiWalletName", header: "Wallet", minSize: 150 },
  { accessorKey: "poiBankName", header: "Banco POI", minSize: 150 },
  { accessorKey: "taxDetail", header: "Detalle Imp.", minSize: 120 },
];

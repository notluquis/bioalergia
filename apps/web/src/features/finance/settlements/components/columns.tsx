import { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";

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
  cell: ({ row }) => {
    const amount = row.getValue(accessorKey) as number | null;
    const currency = row.original.transactionCurrency;
    if (amount === null || amount === undefined) return <div className={`text-${align}`}>-</div>;

    let className = `text-${align}`;
    if (accessorKey === "settlementNetAmount" && amount > 0) className += " text-success font-medium";
    if (isNegative) className += " text-error";

    return <div className={className}>{formatAmount(amount, currency)}</div>;
  },
});

const dateColumn = (accessorKey: keyof SettlementTransaction, header: string): ColumnDef<SettlementTransaction> => ({
  accessorKey,
  header,
  cell: ({ row }) => {
    const val = row.getValue(accessorKey) as string | null;
    if (!val) return "-";
    return dayjs(val).format("DD/MM/YY HH:mm");
  },
});

export const columns: ColumnDef<SettlementTransaction>[] = [
  {
    accessorKey: "sourceId",
    header: "ID Origen",
    cell: ({ row }) => (
      <span className="block max-w-[150px] truncate" title={row.original.sourceId}>
        {row.original.sourceId}
      </span>
    ),
  },
  dateColumn("transactionDate", "Fecha Tx"),
  dateColumn("settlementDate", "Fecha Liq"),
  dateColumn("moneyReleaseDate", "Fecha Lib."),
  {
    accessorKey: "transactionType",
    header: "Tipo",
    cell: ({ row }) => (
      <span className="badge badge-outline badge-sm whitespace-nowrap">{row.original.transactionType}</span>
    ),
  },
  { accessorKey: "paymentMethod", header: "Método" },
  { accessorKey: "paymentMethodType", header: "Tipo Método" },
  moneyColumn("transactionAmount", "Monto Tx"),
  {
    accessorKey: "transactionCurrency",
    header: "Moneda",
    cell: ({ row }) => <div className="text-center">{row.original.transactionCurrency}</div>,
  },
  moneyColumn("feeAmount", "Comisión", "right", true),
  moneyColumn("settlementNetAmount", "Neto Liq"),
  {
    accessorKey: "settlementCurrency",
    header: "Moneda Liq",
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
    cell: ({ row }) => <div className="text-center">{row.original.installments}</div>,
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
  { accessorKey: "cardInitialNumber", header: "BIN" },
  { accessorKey: "lastFourDigits", header: "Últimos 4" },
  { accessorKey: "issuerName", header: "Emisor" },
  {
    accessorKey: "isReleased",
    header: "Liberado",
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
  { accessorKey: "posName", header: "POS" },
  { accessorKey: "storeName", header: "Tienda" },
  { accessorKey: "externalReference", header: "Ref. Ext." },
  { accessorKey: "orderMp", header: "Orden MP" },
  {
    accessorKey: "shippingId",
    header: "ID Envío",
    cell: ({ row }) => <span className="font-mono text-xs">{String(row.original.shippingId || "-")}</span>,
  },
  {
    accessorKey: "orderId",
    header: "ID Orden",
    cell: ({ row }) => <span className="font-mono text-xs">{String(row.original.orderId || "-")}</span>,
  },
  moneyColumn("tipAmount", "Propina"),
  moneyColumn("totalCouponAmount", "Total Cupón"),

  // New Columns
  { accessorKey: "userId", header: "User ID" },
  { accessorKey: "site", header: "Sitio" },
  { accessorKey: "businessUnit", header: "Unidad Negocio" },
  { accessorKey: "subUnit", header: "Sub Unidad" },
  { accessorKey: "productSku", header: "SKU" },
  { accessorKey: "saleDetail", header: "Detalle Venta" },
  { accessorKey: "transactionIntentId", header: "Intent ID" },
  { accessorKey: "franchise", header: "Franquicia" },
  { accessorKey: "invoicingPeriod", header: "Periodo Fac." },
  { accessorKey: "payBankTransferId", header: "ID Transf." },
  { accessorKey: "purchaseId", header: "ID Compra" },
  { accessorKey: "posId", header: "ID POS" },
  { accessorKey: "externalPosId", header: "Ext. POS ID" },
  { accessorKey: "storeId", header: "ID Tienda" },
  { accessorKey: "externalStoreId", header: "Ext. Store ID" },
  { accessorKey: "poiId", header: "POI ID" },
  { accessorKey: "shipmentMode", header: "Modo Envío" },
  {
    accessorKey: "packId",
    header: "ID Paquete",
    cell: ({ row }) => <span className="font-mono text-xs">{String(row.original.packId || "-")}</span>,
  },
  { accessorKey: "shippingOrderId", header: "ID Orden Envío" },
  { accessorKey: "poiWalletName", header: "Wallet" },
  { accessorKey: "poiBankName", header: "Banco POI" },
  { accessorKey: "taxDetail", header: "Detalle Imp." },
];

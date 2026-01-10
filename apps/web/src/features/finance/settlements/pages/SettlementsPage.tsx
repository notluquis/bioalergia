import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { ChevronLeft, ChevronRight, Columns3, Search } from "lucide-react";
import { useState } from "react";

import Button from "@/components/ui/Button";
import { apiClient } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

interface SettlementTransaction {
  id: number;
  sourceId: string;
  transactionDate: string;
  settlementDate: string | null;
  moneyReleaseDate: string | null;
  externalReference: string | null;
  userId: string | null;
  paymentMethodType: string | null;
  paymentMethod: string | null;
  site: string | null;
  transactionType: string | null;
  transactionAmount: number | null;
  transactionCurrency: string | null;
  sellerAmount: number | null;
  feeAmount: number | null;
  settlementNetAmount: number | null;
  settlementCurrency: string | null;
  realAmount: number | null;
  couponAmount: number | null;
  metadata: unknown;
  mkpFeeAmount: number | null;
  financingFeeAmount: number | null;
  shippingFeeAmount: number | null;
  taxesAmount: number | null;
  installments: number | null;
  taxDetail: string | null;
  taxesDisaggregated: unknown;
  description: string | null;
  cardInitialNumber: string | null;
  operationTags: unknown;
  businessUnit: string | null;
  subUnit: string | null;
  productSku: string | null;
  saleDetail: string | null;
  transactionIntentId: string | null;
  franchise: string | null;
  issuerName: string | null;
  lastFourDigits: string | null;
  orderMp: string | null;
  invoicingPeriod: string | null;
  payBankTransferId: string | null;
  isReleased: boolean | null;
  tipAmount: number | null;
  purchaseId: string | null;
  totalCouponAmount: number | null;
  posId: string | null;
  posName: string | null;
  externalPosId: string | null;
  storeId: string | null;
  storeName: string | null;
  externalStoreId: string | null;
  poiId: string | null;
  orderId: string | number | bigint | null;
  shippingId: string | number | bigint | null;
  shipmentMode: string | null;
  packId: string | number | bigint | null;
  shippingOrderId: string | null;
  poiWalletName: string | null;
  poiBankName: string | null;
}

interface ListResponse {
  status: string;
  data: SettlementTransaction[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const ALL_COLUMNS = [
  { key: "sourceId", label: "ID Origen" },
  { key: "transactionDate", label: "Fecha Tx" },
  { key: "settlementDate", label: "Fecha Liq" },
  { key: "moneyReleaseDate", label: "Fecha Lib. Dinero" },
  { key: "transactionType", label: "Tipo" },
  { key: "paymentMethod", label: "Método" },
  { key: "paymentMethodType", label: "Tipo Método" },
  { key: "transactionAmount", label: "Monto Tx" },
  { key: "transactionCurrency", label: "Moneda Tx" },
  { key: "feeAmount", label: "Comisión" },
  { key: "settlementNetAmount", label: "Neto Liq" },
  { key: "settlementCurrency", label: "Moneda Liq" },
  { key: "sellerAmount", label: "Monto Vendedor" },
  { key: "realAmount", label: "Monto Real" },
  { key: "couponAmount", label: "Cupón" },
  { key: "mkpFeeAmount", label: "Comisión MKP" },
  { key: "financingFeeAmount", label: "Costo Financiero" },
  { key: "shippingFeeAmount", label: "Costo Envío" },
  { key: "taxesAmount", label: "Impuestos" },
  { key: "installments", label: "Cuotas" },
  { key: "description", label: "Descripción" },
  { key: "cardInitialNumber", label: "BIN Tarjeta" },
  { key: "lastFourDigits", label: "Últimos 4" },
  { key: "issuerName", label: "Emisor" },
  { key: "isReleased", label: "Liberado" },
  { key: "posName", label: "POS" },
  { key: "storeName", label: "Tienda" },
  { key: "externalReference", label: "Ref. Externa" },
  { key: "orderMp", label: "Orden MP" },
  { key: "shippingId", label: "ID Envío" },
  { key: "orderId", label: "ID Orden" },
] as const;

type ColumnKey = (typeof ALL_COLUMNS)[number]["key"];

async function fetchSettlements(page: number, pageSize: number, search?: string): Promise<ListResponse> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) params.set("search", search);

  return apiClient.get<ListResponse>(`/api/settlement-transactions?${params.toString()}`);
}

function formatAmount(amount: number | null, currency: string | null = "CLP") {
  if (amount === null) return "-";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: currency || "CLP",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function SettlementsPage() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(new Set(ALL_COLUMNS.map((c) => c.key)));

  const { data, isLoading, error } = useQuery({
    queryKey: ["settlement-transactions", page, pageSize, search],
    queryFn: () => fetchSettlements(page, pageSize, search),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const isVisible = (key: ColumnKey) => visibleColumns.has(key);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search className="text-base-content/40 absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="input input-bordered input-sm w-full pl-10 sm:w-56"
            />
          </div>
          <Button type="submit" variant="ghost" size="sm">
            Buscar
          </Button>
        </form>

        <div className="flex-1" />

        {/* Stats inline */}
        {data && (
          <span className="text-base-content/60 text-sm">
            <span className="text-base-content font-medium">{data.total.toLocaleString()}</span> transacciones
            {data.total > 0 && (
              <span className="hidden sm:inline">
                {" "}
                • {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, data.total)}
              </span>
            )}
          </span>
        )}

        {/* Column Picker */}
        <div className="relative">
          <button type="button" className="btn btn-ghost btn-sm gap-1" onClick={() => setShowColumnPicker((v) => !v)}>
            <Columns3 className="h-4 w-4" />
            <span className="hidden sm:inline">Columnas</span>
          </button>
          {showColumnPicker && (
            <div
              className="bg-base-100 border-base-200 absolute right-0 z-50 mt-2 w-48 rounded-lg border p-2 shadow-lg"
              onMouseLeave={() => setShowColumnPicker(false)}
            >
              {ALL_COLUMNS.map((col) => (
                <label
                  key={col.key}
                  className="hover:bg-base-200 flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm"
                >
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={isVisible(col.key)}
                    onChange={() => toggleColumn(col.key)}
                  />
                  {col.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : error ? (
        <div className="bg-error/10 text-error rounded-lg p-4">Error al cargar las conciliaciones</div>
      ) : data && data.data.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed">
          <p className="text-base-content/60">No hay conciliaciones registradas</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="table-sm table w-full">
            <thead className="bg-base-200/50">
              <tr>
                {ALL_COLUMNS.map((col) => {
                  if (!isVisible(col.key)) return null;
                  const isRight = [
                    "transactionAmount",
                    "feeAmount",
                    "settlementNetAmount",
                    "sellerAmount",
                    "realAmount",
                    "couponAmount",
                    "mkpFeeAmount",
                    "financingFeeAmount",
                    "shippingFeeAmount",
                    "taxesAmount",
                    "tipAmount",
                    "totalCouponAmount",
                  ].includes(col.key);
                  const isCenter = ["transactionCurrency", "settlementCurrency", "installments", "isReleased"].includes(
                    col.key
                  );

                  return (
                    <th
                      key={col.key}
                      className={cn(
                        "text-xs font-semibold whitespace-nowrap",
                        isRight && "text-right",
                        isCenter && "text-center"
                      )}
                    >
                      {col.label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {data?.data.map((tx: SettlementTransaction) => (
                <tr key={tx.id} className="hover">
                  {ALL_COLUMNS.map((col) => {
                    if (!isVisible(col.key)) return null;

                    const isRight = [
                      "transactionAmount",
                      "feeAmount",
                      "settlementNetAmount",
                      "sellerAmount",
                      "realAmount",
                      "couponAmount",
                      "mkpFeeAmount",
                      "financingFeeAmount",
                      "shippingFeeAmount",
                      "taxesAmount",
                      "tipAmount", // Added missing numeric fields logic
                      "totalCouponAmount",
                    ].includes(col.key);
                    const isCenter = [
                      "transactionCurrency",
                      "settlementCurrency",
                      "installments",
                      "isReleased",
                    ].includes(col.key);

                    // Render Content
                    let content: React.ReactNode = "-";
                    const val = tx[col.key as keyof SettlementTransaction];

                    if (val === null || val === undefined) {
                      content = "-";
                    } else if (col.key === "transactionType") {
                      content = <span className="badge badge-outline badge-sm whitespace-nowrap">{String(val)}</span>;
                    } else if (col.key === "description" || col.key === "sourceId") {
                      content = (
                        <span className="block max-w-40 truncate" title={String(val)}>
                          {String(val)}
                        </span>
                      );
                    } else if (["transactionDate", "settlementDate", "moneyReleaseDate"].includes(col.key)) {
                      content = dayjs(val as string).format("DD/MM/YY");
                    } else if (typeof val === "boolean") {
                      content = val ? "Sí" : "No";
                    } else if (isRight) {
                      const num = val as number;
                      const isNegative = [
                        "feeAmount",
                        "mkpFeeAmount",
                        "financingFeeAmount",
                        "shippingFeeAmount",
                        "taxesAmount",
                      ].includes(col.key);

                      if (isNegative) {
                        content = (
                          <span className="text-error">-{formatAmount(Math.abs(num), tx.transactionCurrency)}</span>
                        );
                      } else if (col.key === "settlementNetAmount") {
                        content = (
                          <span className="text-success font-medium">{formatAmount(num, tx.transactionCurrency)}</span>
                        );
                      } else {
                        content = formatAmount(num, tx.transactionCurrency);
                      }
                    } else {
                      content = String(val);
                    }

                    return (
                      <td key={col.key} className={cn("text-xs", isRight && "text-right", isCenter && "text-center")}>
                        {content}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-base-content/60 text-sm">
            Página {page} de {data.totalPages}
          </p>
          <div className="join">
            <Button variant="ghost" className="join-item" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              className="join-item"
              disabled={page >= data.totalPages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

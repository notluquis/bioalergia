import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { ArrowDownToLine, ArrowUpFromLine, ChevronLeft, ChevronRight, Columns3, Search } from "lucide-react";
import { useState } from "react";

import Button from "@/components/ui/Button";
import { apiClient } from "@/lib/apiClient";

interface ReleaseTransaction {
  id: number;
  sourceId: string;
  date: string;
  externalReference: string | null;
  recordType: string | null;
  description: string | null;
  netCreditAmount: number | null;
  netDebitAmount: number | null;
  grossAmount: number | null;
  sellerAmount: number | null;
  mpFeeAmount: number | null;
  financingFeeAmount: number | null;
  shippingFeeAmount: number | null;
  taxesAmount: number | null;
  couponAmount: number | null;
  effectiveCouponAmount: number | null;
  balanceAmount: number | null;
  taxAmountTelco: number | null;
  installments: number | null;
  paymentMethod: string | null;
  paymentMethodType: string | null;
  taxDetail: string | null;
  taxesDisaggregated: unknown;
  posId: string | null;
  posName: string | null;
  storeId: string | null;
  storeName: string | null;
  orderId: string | number | bigint | null;
  currency: string | null;
  shippingId: string | number | bigint | null;
  shipmentMode: string | null;
}

interface ListResponse {
  status: string;
  data: ReleaseTransaction[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const ALL_COLUMNS = [
  { key: "sourceId", label: "ID Origen" },
  { key: "date", label: "Fecha" },
  { key: "recordType", label: "Tipo" },
  { key: "description", label: "Descripción" },
  { key: "paymentMethod", label: "Método" },
  { key: "paymentMethodType", label: "Tipo Método" },
  { key: "netCreditAmount", label: "Crédito" },
  { key: "netDebitAmount", label: "Débito" },
  { key: "grossAmount", label: "Bruto" },
  { key: "sellerAmount", label: "Vendedor" },
  { key: "mpFeeAmount", label: "Comisión MP" },
  { key: "financingFeeAmount", label: "Costo Fin." },
  { key: "shippingFeeAmount", label: "Costo Envío" },
  { key: "taxesAmount", label: "Impuestos" },
  { key: "couponAmount", label: "Cupón" },
  { key: "balanceAmount", label: "Balance" },
  { key: "installments", label: "Cuotas" },
  { key: "posName", label: "POS" },
  { key: "storeName", label: "Tienda" },
  { key: "externalReference", label: "Ref. Externa" },
  { key: "orderId", label: "ID Orden" },
  { key: "shippingId", label: "ID Envío" },
] as const;

type ColumnKey = (typeof ALL_COLUMNS)[number]["key"];

async function fetchReleases(page: number, pageSize: number, search?: string): Promise<ListResponse> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) params.set("search", search);

  return apiClient.get<ListResponse>(`/api/release-transactions?${params.toString()}`);
}

function formatAmount(amount: number | null, currency: string | null = "CLP") {
  if (amount === null) return "-";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: currency || "CLP",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function ReleasesPage() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(new Set(ALL_COLUMNS.map((c) => c.key)));

  const { data, isLoading, error } = useQuery({
    queryKey: ["release-transactions", page, pageSize, search],
    queryFn: () => fetchReleases(page, pageSize, search),
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
        <div className="bg-error/10 text-error rounded-lg p-4">Error al cargar las liberaciones</div>
      ) : data && data.data.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed">
          <p className="text-base-content/60">No hay liberaciones registradas</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="table-sm table w-full">
            <thead className="bg-base-200/50">
              <tr>
                {isVisible("date") && <th>Fecha</th>}
                {isVisible("recordType") && <th>Tipo</th>}
                {isVisible("description") && <th>Descripción</th>}
                {isVisible("paymentMethod") && <th>Método</th>}
                {isVisible("netCreditAmount") && <th className="text-right">Crédito</th>}
                {isVisible("netDebitAmount") && <th className="text-right">Débito</th>}
                {isVisible("grossAmount") && <th className="text-right">Bruto</th>}
                {isVisible("sellerAmount") && <th className="text-right">Vendedor</th>}
                {isVisible("externalReference") && <th>Ref. Externa</th>}
              </tr>
            </thead>
            <tbody>
              {data?.data.map((tx: ReleaseTransaction) => (
                <tr key={tx.id} className="hover">
                  {isVisible("sourceId") && (
                    <td className="max-w-24 truncate font-mono text-xs" title={tx.sourceId}>
                      {tx.sourceId}
                    </td>
                  )}
                  {isVisible("date") && (
                    <td className="whitespace-nowrap">{dayjs(tx.date).format("DD/MM/YY HH:mm")}</td>
                  )}
                  {isVisible("recordType") && (
                    <td>
                      <span className="badge badge-outline badge-sm">{tx.recordType || "-"}</span>
                    </td>
                  )}
                  {isVisible("description") && (
                    <td className="max-w-48 truncate" title={tx.description || ""}>
                      {tx.description || "-"}
                    </td>
                  )}
                  {isVisible("paymentMethod") && <td>{tx.paymentMethod || "-"}</td>}
                  {isVisible("paymentMethodType") && <td>{tx.paymentMethodType || "-"}</td>}
                  {isVisible("netCreditAmount") && (
                    <td className="text-right">
                      {tx.netCreditAmount && tx.netCreditAmount > 0 ? (
                        <span className="text-success flex items-center justify-end gap-1">
                          <ArrowDownToLine className="h-3 w-3" />
                          {formatAmount(tx.netCreditAmount, tx.currency)}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                  )}
                  {isVisible("netDebitAmount") && (
                    <td className="text-right">
                      {tx.netDebitAmount && tx.netDebitAmount > 0 ? (
                        <span className="text-error flex items-center justify-end gap-1">
                          <ArrowUpFromLine className="h-3 w-3" />
                          {formatAmount(tx.netDebitAmount, tx.currency)}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                  )}
                  {isVisible("grossAmount") && (
                    <td className="text-right">{formatAmount(tx.grossAmount, tx.currency)}</td>
                  )}
                  {isVisible("sellerAmount") && (
                    <td className="text-right">{formatAmount(tx.sellerAmount, tx.currency)}</td>
                  )}
                  {isVisible("mpFeeAmount") && (
                    <td className="text-error text-right">{formatAmount(tx.mpFeeAmount, tx.currency)}</td>
                  )}
                  {isVisible("financingFeeAmount") && (
                    <td className="text-error text-right">{formatAmount(tx.financingFeeAmount, tx.currency)}</td>
                  )}
                  {isVisible("shippingFeeAmount") && (
                    <td className="text-error text-right">{formatAmount(tx.shippingFeeAmount, tx.currency)}</td>
                  )}
                  {isVisible("taxesAmount") && (
                    <td className="text-error text-right">{formatAmount(tx.taxesAmount, tx.currency)}</td>
                  )}
                  {isVisible("couponAmount") && (
                    <td className="text-right">{formatAmount(tx.couponAmount, tx.currency)}</td>
                  )}
                  {isVisible("balanceAmount") && (
                    <td className="text-right">{formatAmount(tx.balanceAmount, tx.currency)}</td>
                  )}
                  {isVisible("installments") && <td className="text-center">{tx.installments || "-"}</td>}
                  {isVisible("posName") && (
                    <td className="max-w-xs truncate" title={tx.posName || ""}>
                      {tx.posName || "-"}
                    </td>
                  )}
                  {isVisible("storeName") && (
                    <td className="max-w-xs truncate" title={tx.storeName || ""}>
                      {tx.storeName || "-"}
                    </td>
                  )}
                  {isVisible("externalReference") && (
                    <td className="max-w-32 truncate font-mono text-xs" title={tx.externalReference || ""}>
                      {tx.externalReference || "-"}
                    </td>
                  )}
                  {isVisible("orderId") && <td className="font-mono text-xs">{tx.orderId?.toString() || "-"}</td>}
                  {isVisible("shippingId") && <td className="font-mono text-xs">{tx.shippingId?.toString() || "-"}</td>}
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

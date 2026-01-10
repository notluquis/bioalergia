import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { ArrowDownToLine, ArrowUpFromLine, ChevronLeft, ChevronRight, Columns3, Search } from "lucide-react";
import { useState } from "react";

import Button from "@/components/ui/Button";
import { apiClient } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

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
                {ALL_COLUMNS.map((col) => {
                  if (!isVisible(col.key)) return null;
                  const isRight = [
                    "netCreditAmount",
                    "netDebitAmount",
                    "grossAmount",
                    "sellerAmount",
                    "mpFeeAmount",
                    "financingFeeAmount",
                    "shippingFeeAmount",
                    "taxesAmount",
                    "couponAmount",
                    "balanceAmount",
                  ].includes(col.key);
                  const isCenter = ["installments"].includes(col.key);

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
              {data?.data.map((tx: ReleaseTransaction) => (
                <tr key={tx.id} className="hover">
                  {ALL_COLUMNS.map((col) => {
                    if (!isVisible(col.key)) return null;

                    const isRight = [
                      "netCreditAmount",
                      "netDebitAmount",
                      "grossAmount",
                      "sellerAmount",
                      "mpFeeAmount",
                      "financingFeeAmount",
                      "shippingFeeAmount",
                      "taxesAmount",
                      "couponAmount",
                      "balanceAmount",
                    ].includes(col.key);
                    const isCenter = ["installments"].includes(col.key);

                    let content: React.ReactNode = "-";
                    const val = tx[col.key as keyof ReleaseTransaction];

                    if (val === null || val === undefined) {
                      content = "-";
                    } else if (col.key === "recordType") {
                      content = <span className="badge badge-outline badge-sm whitespace-nowrap">{String(val)}</span>;
                    } else if (col.key === "date") {
                      content = dayjs(String(val)).format("DD/MM/YY HH:mm");
                    } else if (col.key === "netCreditAmount") {
                      const num = val as number;
                      if (num > 0) {
                        content = (
                          <span className="text-success flex items-center justify-end gap-1">
                            <ArrowDownToLine className="h-3 w-3" />
                            {formatAmount(num, tx.currency)}
                          </span>
                        );
                      } else {
                        content = "-";
                      }
                    } else if (col.key === "netDebitAmount") {
                      const num = val as number;
                      if (num > 0) {
                        content = (
                          <span className="text-error flex items-center justify-end gap-1">
                            <ArrowUpFromLine className="h-3 w-3" />
                            {formatAmount(num, tx.currency)}
                          </span>
                        );
                      } else {
                        content = "-";
                      }
                    } else if (col.key === "description" || col.key === "sourceId") {
                      content = (
                        <span className="block max-w-40 truncate" title={String(val)}>
                          {String(val)}
                        </span>
                      );
                    } else if (isRight && typeof val === "number") {
                      const isNegative = [
                        "mpFeeAmount",
                        "financingFeeAmount",
                        "shippingFeeAmount",
                        "taxesAmount",
                      ].includes(col.key);
                      if (isNegative) {
                        content = <span className="text-error">{formatAmount(val, tx.currency)}</span>;
                      } else {
                        content = formatAmount(val, tx.currency);
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

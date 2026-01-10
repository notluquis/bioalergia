import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { ChevronLeft, ChevronRight, Columns3, Search } from "lucide-react";
import { useState } from "react";

import Button from "@/components/ui/Button";

interface SettlementTransaction {
  id: number;
  sourceId: string;
  transactionDate: string;
  settlementDate: string;
  externalReference: string | null;
  transactionType: string | null;
  transactionAmount: number | null;
  transactionCurrency: string | null;
  sellerAmount: number | null;
  feeAmount: number | null;
  settlementNetAmount: number | null;
  paymentMethod: string | null;
  paymentMethodType: string | null;
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
  { key: "transactionDate", label: "Fecha Tx", default: true },
  { key: "settlementDate", label: "Fecha Liq", default: true },
  { key: "transactionType", label: "Tipo", default: true },
  { key: "paymentMethod", label: "Método", default: true },
  { key: "transactionAmount", label: "Monto", default: true },
  { key: "feeAmount", label: "Comisión", default: true },
  { key: "settlementNetAmount", label: "Neto", default: true },
  { key: "externalReference", label: "Ref. Externa", default: false },
  { key: "sellerAmount", label: "Monto Vendedor", default: false },
] as const;

type ColumnKey = (typeof ALL_COLUMNS)[number]["key"];

async function fetchSettlements(page: number, pageSize: number, search?: string): Promise<ListResponse> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) params.set("search", search);

  const res = await fetch(`/api/settlement-transactions?${params}`);
  if (!res.ok) throw new Error("Error al cargar conciliaciones");
  return res.json();
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
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(
    new Set(ALL_COLUMNS.filter((c) => c.default).map((c) => c.key))
  );

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
        <div className="dropdown dropdown-end">
          <Button variant="ghost" size="sm" className="gap-1" onClick={() => setShowColumnPicker(!showColumnPicker)}>
            <Columns3 className="h-4 w-4" />
            <span className="hidden sm:inline">Columnas</span>
          </Button>
          {showColumnPicker && (
            <div className="dropdown-content bg-base-100 border-base-200 z-50 mt-2 w-48 rounded-lg border p-2 shadow-lg">
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
                {isVisible("transactionDate") && <th>Fecha Tx</th>}
                {isVisible("settlementDate") && <th>Fecha Liq</th>}
                {isVisible("transactionType") && <th>Tipo</th>}
                {isVisible("paymentMethod") && <th>Método</th>}
                {isVisible("transactionAmount") && <th className="text-right">Monto</th>}
                {isVisible("feeAmount") && <th className="text-right">Comisión</th>}
                {isVisible("settlementNetAmount") && <th className="text-right">Neto</th>}
                {isVisible("sellerAmount") && <th className="text-right">Vendedor</th>}
                {isVisible("externalReference") && <th>Ref. Externa</th>}
              </tr>
            </thead>
            <tbody>
              {data?.data.map((tx) => (
                <tr key={tx.id} className="hover">
                  {isVisible("transactionDate") && (
                    <td className="whitespace-nowrap">{dayjs(tx.transactionDate).format("DD/MM/YY")}</td>
                  )}
                  {isVisible("settlementDate") && (
                    <td className="whitespace-nowrap">
                      {tx.settlementDate ? dayjs(tx.settlementDate).format("DD/MM/YY") : "-"}
                    </td>
                  )}
                  {isVisible("transactionType") && (
                    <td>
                      <span className="badge badge-outline badge-sm">{tx.transactionType || "-"}</span>
                    </td>
                  )}
                  {isVisible("paymentMethod") && <td>{tx.paymentMethod || tx.paymentMethodType || "-"}</td>}
                  {isVisible("transactionAmount") && (
                    <td className="text-right font-medium">
                      {formatAmount(tx.transactionAmount, tx.transactionCurrency)}
                    </td>
                  )}
                  {isVisible("feeAmount") && (
                    <td className="text-error text-right">
                      {tx.feeAmount ? `-${formatAmount(Math.abs(tx.feeAmount), tx.transactionCurrency)}` : "-"}
                    </td>
                  )}
                  {isVisible("settlementNetAmount") && (
                    <td className="text-success text-right font-medium">
                      {formatAmount(tx.settlementNetAmount, tx.transactionCurrency)}
                    </td>
                  )}
                  {isVisible("sellerAmount") && (
                    <td className="text-right">{formatAmount(tx.sellerAmount, tx.transactionCurrency)}</td>
                  )}
                  {isVisible("externalReference") && (
                    <td className="max-w-32 truncate font-mono text-xs" title={tx.externalReference || ""}>
                      {tx.externalReference || "-"}
                    </td>
                  )}
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

import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
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

  const { data, isLoading, error } = useQuery({
    queryKey: ["settlement-transactions", page, pageSize, search],
    queryFn: () => fetchSettlements(page, pageSize, search),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Conciliaciones</h1>
          <p className="text-base-content/60 text-sm">Transacciones de conciliación de MercadoPago</p>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search className="text-base-content/40 absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="input input-bordered w-full pl-10 sm:w-64"
            />
          </div>
          <Button type="submit" variant="ghost">
            Buscar
          </Button>
        </form>
      </div>

      {/* Stats */}
      {data && (
        <div className="bg-base-200/50 rounded-lg p-4 text-sm">
          <span className="font-medium">{data.total.toLocaleString()}</span> transacciones total
          {data.total > 0 && (
            <span className="text-base-content/60 ml-2">
              • Mostrando {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, data.total)}
            </span>
          )}
        </div>
      )}

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
          <table className="table w-full">
            <thead className="bg-base-200/50">
              <tr>
                <th>Fecha Tx</th>
                <th>Fecha Liq</th>
                <th>Tipo</th>
                <th>Método</th>
                <th className="text-right">Monto</th>
                <th className="text-right">Comisión</th>
                <th className="text-right">Neto</th>
                <th>Ref. Externa</th>
              </tr>
            </thead>
            <tbody>
              {data?.data.map((tx) => (
                <tr key={tx.id} className="hover">
                  <td className="text-sm whitespace-nowrap">{dayjs(tx.transactionDate).format("DD/MM/YY")}</td>
                  <td className="text-sm whitespace-nowrap">
                    {tx.settlementDate ? dayjs(tx.settlementDate).format("DD/MM/YY") : "-"}
                  </td>
                  <td>
                    <span className="badge badge-outline badge-sm">{tx.transactionType || "-"}</span>
                  </td>
                  <td className="text-sm">{tx.paymentMethod || tx.paymentMethodType || "-"}</td>
                  <td className="text-right font-medium">
                    {formatAmount(tx.transactionAmount, tx.transactionCurrency)}
                  </td>
                  <td className="text-error text-right text-sm">
                    {tx.feeAmount ? `-${formatAmount(Math.abs(tx.feeAmount), tx.transactionCurrency)}` : "-"}
                  </td>
                  <td className="text-success text-right font-medium">
                    {formatAmount(tx.settlementNetAmount, tx.transactionCurrency)}
                  </td>
                  <td className="max-w-32 truncate font-mono text-xs" title={tx.externalReference || ""}>
                    {tx.externalReference || "-"}
                  </td>
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

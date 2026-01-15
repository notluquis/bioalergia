import { useFindManyReleaseTransaction } from "@finanzas/db/hooks";
import dayjs from "dayjs";
import { useState } from "react";

import { DataTable } from "@/components/data-table/DataTable";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { useAuth } from "@/context/AuthContext";
import { today } from "@/lib/dates";

import { getReleaseColumns } from "../components/ReleaseColumns";

const DEFAULT_PAGE_SIZE = 50;

export default function ReleaseTransactionsPage() {
  const [draftFilters, setDraftFilters] = useState({
    from: dayjs().startOf("month").format("YYYY-MM-DD"),
    to: today(),
    reportDate: "",
  });
  const [appliedFilters, setAppliedFilters] = useState(draftFilters);
  const [page, setPage] = useState(1);
  const pageSize = DEFAULT_PAGE_SIZE;

  const { can } = useAuth();
  const canView = can("read", "Integration");

  // Query Data
  const { data: rows, isLoading } = useFindManyReleaseTransaction({
    where: {
      date: {
        gte: appliedFilters.from ? new Date(appliedFilters.from) : undefined,
        lte: appliedFilters.to ? new Date(appliedFilters.to) : undefined,
      },
    },
    take: pageSize,
    skip: (page - 1) * pageSize,
    orderBy: { date: "desc" },
  });

  const handleFilterChange = (update: Partial<typeof draftFilters>) => {
    setDraftFilters((prev) => ({ ...prev, ...update }));
  };

  const columns = getReleaseColumns();

  return (
    <section className="mx-auto w-full max-w-none space-y-4 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="typ-title text-base-content">Liberaciones de Dinero</h1>
          <p className="typ-body text-base-content/70 max-w-2xl">
            Reporte de liberaciones de fondos desde Mercado Pago según fecha.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase">Desde</span>
            <Input
              type="date"
              value={draftFilters.from}
              onChange={(e) => handleFilterChange({ from: e.target.value })}
              className="input-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase">Hasta</span>
            <Input
              type="date"
              value={draftFilters.to}
              onChange={(e) => handleFilterChange({ to: e.target.value })}
              className="input-sm"
            />
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setPage(1);
              setAppliedFilters(draftFilters);
            }}
          >
            Filtrar
          </Button>
        </div>
      </div>

      {canView ? (
        <Card>
          <CardContent className="p-0">
            <DataTable
              columns={columns}
              data={rows || []}
              isLoading={isLoading}
              noDataMessage="No se encontraron liberaciones de fondos."
            />
          </CardContent>
        </Card>
      ) : (
        <Alert variant="error">No tienes permisos para ver liberaciones.</Alert>
      )}

      {/* Manual Pagination (To be replaced by standardized one in future) */}
      <div className="flex justify-end gap-2">
        <Button
          disabled={page === 1 || isLoading}
          variant="ghost"
          size="sm"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Anterior
        </Button>
        <span className="flex items-center text-sm">Página {page}</span>
        <Button
          disabled={!rows || rows.length < pageSize || isLoading}
          variant="ghost"
          size="sm"
          onClick={() => setPage((p) => p + 1)}
        >
          Siguiente
        </Button>
      </div>
    </section>
  );
}

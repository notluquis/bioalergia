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

export default function ReleaseTransactionsPage() {
  const [draftFilters, setDraftFilters] = useState({
    from: dayjs().startOf("month").format("YYYY-MM-DD"),
    reportDate: "",
    to: today(),
  });
  const [appliedFilters, setAppliedFilters] = useState(draftFilters);

  const { can } = useAuth();
  const canView = can("read", "Integration");

  // Query Data
  // Query Data - Load all data within date range
  // DataTable handles pagination client-side automatically
  const { data: rows, isLoading } = useFindManyReleaseTransaction({
    orderBy: { date: "desc" },
    where: {
      date: {
        gte: appliedFilters.from ? new Date(appliedFilters.from) : undefined,
        lte: appliedFilters.to ? new Date(appliedFilters.to) : undefined,
      },
    },
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
              className="input-sm"
              onChange={(e) => {
                handleFilterChange({ from: e.target.value });
              }}
              type="date"
              value={draftFilters.from}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase">Hasta</span>
            <Input
              className="input-sm"
              onChange={(e) => {
                handleFilterChange({ to: e.target.value });
              }}
              type="date"
              value={draftFilters.to}
            />
          </div>
          <Button
            onClick={() => {
              setAppliedFilters(draftFilters);
            }}
            size="sm"
            variant="primary"
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
    </section>
  );
}

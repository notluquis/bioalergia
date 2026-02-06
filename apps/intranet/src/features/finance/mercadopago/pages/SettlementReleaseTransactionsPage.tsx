/*
import { schema as schemaLite } from "@finanzas/db/schema-lite";
import { Alert, Button, Card, Input, Label, TextField } from "@heroui/react";
import type { PaginationState, VisibilityState } from "@tanstack/react-table";
import { useClientQueries } from "@zenstackhq/tanstack-query/react";
import dayjs from "dayjs";
import { useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { useAuth } from "@/context/AuthContext";
import { today } from "@/lib/dates";

import { getSettlementReleaseColumns } from "../components/SettlementReleaseColumns";
export function SettlementReleaseTransactionsPage() {
  const client = useClientQueries(schemaLite);

  const [draftFilters, setDraftFilters] = useState({
    from: dayjs().startOf("month").format("YYYY-MM-DD"),
    to: today(),
  });
  const [appliedFilters, setAppliedFilters] = useState(draftFilters);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const { can } = useAuth();
  const canView = can("read", "Integration");

  const filters = {
    effectiveDate: {
      gte: appliedFilters.from ? dayjs(appliedFilters.from, "YYYY-MM-DD").toDate() : undefined,
      lte: appliedFilters.to ? dayjs(appliedFilters.to, "YYYY-MM-DD").toDate() : undefined,
    },
  };

  const { data: total = 0 } = client.settlementReleaseTransaction.useCount({
    where: filters,
  });

  const { data: rows, isLoading } = client.settlementReleaseTransaction.useFindMany({
    orderBy: { effectiveDate: "desc" },
    skip: pagination.pageIndex * pagination.pageSize,
    take: pagination.pageSize,
    where: filters,
  });

  const pageCount = Math.max(1, Math.ceil(total / pagination.pageSize));

  const handleFilterChange = (update: Partial<typeof draftFilters>) => {
    setDraftFilters((prev) => ({ ...prev, ...update }));
  };

  const columns = getSettlementReleaseColumns();

  return (
    <section className="mx-auto w-full max-w-none space-y-4 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="typ-title text-foreground">Conciliaciones + Liberaciones + Retiros</h1>
          <p className="typ-body max-w-2xl text-default-600">
            Unifica conciliaciones, liberaciones y retiros por ID origen (FULL OUTER JOIN).
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <TextField>
              <Label className="font-semibold text-xs uppercase">Desde</Label>
              <Input
                className="input-sm"
                onChange={(e) => {
                  handleFilterChange({ from: e.target.value });
                }}
                type="date"
                value={draftFilters.from}
              />
            </TextField>
          </div>
          <div className="flex flex-col gap-1">
            <TextField>
              <Label className="font-semibold text-xs uppercase">Hasta</Label>
              <Input
                className="input-sm"
                onChange={(e) => {
                  handleFilterChange({ to: e.target.value });
                }}
                type="date"
                value={draftFilters.to}
              />
            </TextField>
          </div>
          <Button
            onPress={() => {
              setAppliedFilters(draftFilters);
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
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
          <Card.Content className="p-0">
            <DataTable
              columnVisibility={columnVisibility}
              columns={columns}
              data={rows ?? []}
              containerVariant="plain"
              enableExport={false}
              enableGlobalFilter={false}
              isLoading={isLoading}
              noDataMessage="No se encontraron resultados en el rango seleccionado."
              onColumnVisibilityChange={setColumnVisibility}
              onPaginationChange={setPagination}
              pageCount={pageCount}
              pagination={pagination}
            />
          </Card.Content>
        </Card>
      ) : (
        <Alert color="danger">No tienes permisos para ver conciliaciones.</Alert>
      )}
    </section>
  );
}
*/

// Temporarily disabled due to SettlementReleaseTransaction view removal
// Re-enable when view is restored or replaced with alternative implementation
import { Card } from "@heroui/react";
import { Alert } from "@/components/ui/Alert";

export function SettlementReleaseTransactionsPage() {
  return (
    <section className="mx-auto w-full max-w-none space-y-4 p-4">
      <Card>
        <Alert variant="warning">
          <span>
            Esta sección está temporalmente deshabilitada mientras se restaura la vista de datos.
          </span>
        </Alert>
      </Card>
    </section>
  );
}

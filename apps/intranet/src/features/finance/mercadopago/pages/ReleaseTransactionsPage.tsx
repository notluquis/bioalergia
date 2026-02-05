import { schema as schemaLite } from "@finanzas/db/schema-lite";
import { Alert, Button, Card, Input, Label, TextField } from "@heroui/react";
import { useClientQueries } from "@zenstackhq/tanstack-query/react";
import dayjs from "dayjs";
import { useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { useAuth } from "@/context/AuthContext";
import { today } from "@/lib/dates";

import { getReleaseColumns } from "../components/ReleaseColumns";
export function ReleaseTransactionsPage() {
  const client = useClientQueries(schemaLite);

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
  const { data: rows, isLoading } = client.releaseTransaction.useFindMany({
    orderBy: { date: "desc" },
    where: {
      date: {
        gte: appliedFilters.from ? dayjs(appliedFilters.from, "YYYY-MM-DD").toDate() : undefined,
        lte: appliedFilters.to ? dayjs(appliedFilters.to, "YYYY-MM-DD").toDate() : undefined,
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
          <h1 className="typ-title text-foreground">Liberaciones de Dinero</h1>
          <p className="typ-body max-w-2xl text-default-600">
            Reporte de liberaciones de fondos desde Mercado Pago según fecha.
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
              columns={columns}
              data={rows ?? []}
              containerVariant="plain"
              enableExport={false}
              enableGlobalFilter={false}
              isLoading={isLoading}
              noDataMessage="No se encontraron liberaciones de fondos."
            />
          </Card.Content>
        </Card>
      ) : (
        <Alert color="danger">No tienes permisos para ver liberaciones.</Alert>
      )}
    </section>
  );
}

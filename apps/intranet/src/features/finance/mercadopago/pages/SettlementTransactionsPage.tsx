import { schema as schemaLite } from "@finanzas/db/schema-lite";
import { Alert, Button, Card, Form, Input, Label, TextField } from "@heroui/react";
import { useClientQueries } from "@zenstackhq/tanstack-query/react";
import dayjs from "dayjs";
import { useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { useAuth } from "@/context/AuthContext";
import { today } from "@/lib/dates";

import { getSettlementColumns } from "../components/SettlementColumns";
export function SettlementTransactionsPage() {
  const client = useClientQueries(schemaLite);

  const [draftFilters, setDraftFilters] = useState({
    from: dayjs().startOf("month").format("YYYY-MM-DD"),
    to: today(),
  });
  const [appliedFilters, setAppliedFilters] = useState(draftFilters);

  const { can } = useAuth();
  const canView = can("read", "Integration");

  // Query Data - Load all data within date range
  // DataTable handles pagination client-side automatically
  const { data: rows, isLoading } = client.settlementTransaction.useFindMany({
    orderBy: { transactionDate: "desc" },
    where: {
      transactionDate: {
        gte: appliedFilters.from ? dayjs(appliedFilters.from, "YYYY-MM-DD").toDate() : undefined,
        lte: appliedFilters.to ? dayjs(appliedFilters.to, "YYYY-MM-DD").toDate() : undefined,
      },
    },
  });

  const handleFilterChange = (update: Partial<typeof draftFilters>) => {
    setDraftFilters((prev) => ({ ...prev, ...update }));
  };

  const columns = getSettlementColumns();

  return (
    <section className="mx-auto w-full max-w-none space-y-4 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <Form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setAppliedFilters(draftFilters);
          }}
        >
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
          <Button size="sm" type="submit" variant="primary">
            Filtrar
          </Button>
        </Form>
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
              noDataMessage="No se encontraron conciliaciones en el rango seleccionado."
            />
          </Card.Content>
        </Card>
      ) : (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Sin permisos</Alert.Title>
            <Alert.Description>No tienes permisos para ver conciliaciones.</Alert.Description>
          </Alert.Content>
        </Alert>
      )}
    </section>
  );
}

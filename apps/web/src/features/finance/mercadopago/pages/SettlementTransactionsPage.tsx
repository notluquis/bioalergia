import { useFindManySettlementTransaction } from "@finanzas/db/hooks";
import type { SettlementTransaction } from "@finanzas/db/models";
import dayjs from "dayjs";
import { useState } from "react";

import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Table, TableBody } from "@/components/ui/Table";
import { useAuth } from "@/context/AuthContext";
import { today } from "@/lib/dates";

const DEFAULT_PAGE_SIZE = 50;

export default function SettlementTransactionsPage() {
  const [draftFilters, setDraftFilters] = useState({
    from: dayjs().startOf("month").format("YYYY-MM-DD"),
    to: today(),
  });
  const [appliedFilters, setAppliedFilters] = useState(draftFilters);
  const [page, setPage] = useState(1);
  const pageSize = DEFAULT_PAGE_SIZE;

  const { can } = useAuth();
  const canView = can("read", "SettlementTransaction");

  // Query Data - using correct field name 'transactionDate' from schema
  const { data: rows, isLoading } = useFindManySettlementTransaction({
    where: {
      transactionDate: {
        gte: appliedFilters.from ? new Date(appliedFilters.from) : undefined,
        lte: appliedFilters.to ? new Date(appliedFilters.to) : undefined,
      },
    },
    take: pageSize,
    skip: (page - 1) * pageSize,
    orderBy: { transactionDate: "desc" },
  });

  const handleFilterChange = (update: Partial<typeof draftFilters>) => {
    setDraftFilters((prev) => ({ ...prev, ...update }));
  };

  const columns = [
    { key: "transactionDate", label: "Fecha" },
    { key: "transactionType", label: "Tipo" },
    { key: "transactionAmount", label: "Monto Transacción", align: "right" as const },
    { key: "settlementNetAmount", label: "Monto Neto", align: "right" as const },
    { key: "realAmount", label: "Monto Real", align: "right" as const },
    { key: "couponAmount", label: "Cupón", align: "right" as const },
    { key: "taxesAmount", label: "Impuestos", align: "right" as const },
    { key: "installments", label: "Cuotas", align: "right" as const },
  ];

  return (
    <section className="mx-auto w-full max-w-none space-y-4 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="typ-title text-base-content">Conciliaciones (Settlements)</h1>
          <p className="typ-body text-base-content/70 max-w-2xl">
            Detalle de transacciones conciliadas por Mercado Pago.
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

      {!canView ? (
        <Alert variant="error">No tienes permisos para ver conciliaciones.</Alert>
      ) : (
        <Table columns={columns}>
          <TableBody loading={isLoading} columnsCount={columns.length}>
            {rows?.map((row: SettlementTransaction) => (
              <tr key={row.id}>
                <td className="px-4 py-2">{dayjs(row.transactionDate).format("DD/MM/YYYY")}</td>
                <td className="px-4 py-2">{row.transactionType}</td>
                <td className="px-4 py-2 text-right">{row.transactionAmount?.toString()}</td>
                <td className="px-4 py-2 text-right">{row.settlementNetAmount?.toString()}</td>
                <td className="px-4 py-2 text-right">{row.realAmount?.toString()}</td>
                <td className="px-4 py-2 text-right">{row.couponAmount?.toString()}</td>
                <td className="px-4 py-2 text-right">{row.taxesAmount?.toString()}</td>
                <td className="px-4 py-2 text-right">{row.installments?.toString()}</td>
              </tr>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Simple Pagination Control */}
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

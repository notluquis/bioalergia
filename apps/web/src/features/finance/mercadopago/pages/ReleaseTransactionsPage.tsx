import { useFindManyReleaseTransaction } from "@finanzas/db/hooks";
import type { ReleaseTransaction } from "@finanzas/db/models";
import dayjs from "dayjs";
import { useState } from "react";

import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Table, TableBody } from "@/components/ui/Table";
import { useAuth } from "@/context/AuthContext";
import { today } from "@/lib/dates";

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
  const canView = can("read", "ReleaseTransaction");

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

  const columns = [
    { key: "date", label: "Fecha" },
    { key: "sourceId", label: "ID Origen" },
    { key: "externalReference", label: "Ref. Externa" },
    { key: "netCreditAmount", label: "Crédito Neto", align: "right" as const },
    { key: "netDebitAmount", label: "Débito Neto", align: "right" as const },
    { key: "grossAmount", label: "Monto Bruto", align: "right" as const },
    { key: "mpFeeAmount", label: "Comisión MP", align: "right" as const },
    { key: "financingFeeAmount", label: "Comisión Financiera", align: "right" as const },
  ];

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
        <Table columns={columns}>
          <TableBody loading={isLoading} columnsCount={columns.length}>
            {rows?.map((row: ReleaseTransaction) => (
              <tr key={row.id}>
                <td className="px-4 py-2">{dayjs(row.date).format("DD/MM/YYYY")}</td>
                <td className="px-4 py-2">{row.sourceId}</td>
                <td className="px-4 py-2">{row.externalReference}</td>
                <td className="px-4 py-2 text-right">{row.netCreditAmount?.toString()}</td>
                <td className="px-4 py-2 text-right">{row.netDebitAmount?.toString()}</td>
                <td className="px-4 py-2 text-right">{row.grossAmount?.toString()}</td>
                <td className="px-4 py-2 text-right">{row.mpFeeAmount?.toString()}</td>
                <td className="px-4 py-2 text-right">{row.financingFeeAmount?.toString()}</td>
              </tr>
            ))}
          </TableBody>
        </Table>
      ) : (
        <Alert variant="error">No tienes permisos para ver liberaciones.</Alert>
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

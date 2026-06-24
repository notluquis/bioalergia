import { Button, Card, SearchField } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FileText, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { listQuotes, quotesKeys } from "@/features/quotes/api";
import { STATUS_LABELS } from "@/features/quotes/labels";
import { formatCurrency } from "@/lib/utils";
import { PAGE_CONTAINER } from "@/lib/styles";

const EMPTY: never[] = [];

export const Route = createFileRoute("/_authed/quotes/")({
  staticData: {
    nav: { iconKey: "Receipt", label: "Cotizaciones", order: 70, section: "Finanzas" },
    permission: { action: "read", subject: "Quote" },
    title: "Cotizaciones",
  },
  component: QuotesPage,
});

function formatDate(d: Date | string): string {
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "medium" }).format(new Date(d));
}

function QuotesPage() {
  const navigate = useNavigate();
  const quotesQuery = useQuery({ queryKey: quotesKeys.list(), queryFn: () => listQuotes() });
  const [search, setSearch] = useState("");

  const quotes = quotesQuery.data ?? EMPTY;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return quotes;
    return quotes.filter(
      (x) =>
        x.companyName.toLowerCase().includes(q) ||
        String(x.folio).includes(q) ||
        (x.createdByName ?? "").toLowerCase().includes(q)
    );
  }, [quotes, search]);

  type QuoteRow = (typeof quotes)[number];
  const columns = useMemo<ColumnDef<QuoteRow>[]>(
    () => [
      {
        accessorKey: "folio",
        header: "Folio",
        cell: ({ row }) => (
          <span className="font-medium">N° {String(row.original.folio).padStart(4, "0")}</span>
        ),
      },
      { accessorKey: "companyName", header: "Empresa" },
      {
        accessorKey: "issueDate",
        header: "Fecha",
        cell: ({ row }) => formatDate(row.original.issueDate),
      },
      {
        accessorKey: "createdByName",
        header: "Vendedor",
        cell: ({ row }) => row.original.createdByName ?? "—",
      },
      {
        accessorKey: "status",
        header: "Estado",
        cell: ({ row }) => STATUS_LABELS[row.original.status],
      },
      {
        accessorKey: "total",
        header: "Total",
        cell: ({ row }) => formatCurrency(row.original.total),
      },
    ],
    []
  );

  return (
    <div className={PAGE_CONTAINER}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 font-semibold text-xl">
          <FileText size={22} /> Cotizaciones
        </h1>
        <Button className="gap-2" onPress={() => void navigate({ to: "/quotes/new" })}>
          <Plus size={18} /> Nueva cotización
        </Button>
      </div>

      <Card className="space-y-4 p-4">
        <SearchField
          value={search}
          onChange={setSearch}
          aria-label="Buscar cotización"
          variant="secondary"
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Buscar por folio, empresa o vendedor…" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>

        <DataTable
          columns={columns}
          data={filtered}
          isLoading={quotesQuery.isLoading}
          enableToolbar={false}
          enableVirtualization={false}
          noDataMessage="No hay cotizaciones."
          onRowClick={(q) => void navigate({ to: "/quotes/$id", params: { id: String(q.id) } })}
        />
      </Card>
    </div>
  );
}

import { Button, Card, EmptyState, SearchField, Spinner, Table } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FileText, Plus } from "lucide-react";
import { useMemo, useState } from "react";
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

        {quotesQuery.isLoading ? (
          <Spinner aria-label="Cargando cotizaciones" />
        ) : filtered.length === 0 ? (
          <EmptyState>No hay cotizaciones.</EmptyState>
        ) : (
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="Cotizaciones" className="min-w-[680px]">
                <Table.Header>
                  <Table.Column isRowHeader>Folio</Table.Column>
                  <Table.Column>Empresa</Table.Column>
                  <Table.Column>Fecha</Table.Column>
                  <Table.Column>Vendedor</Table.Column>
                  <Table.Column>Estado</Table.Column>
                  <Table.Column>Total</Table.Column>
                </Table.Header>
                <Table.Body>
                  {filtered.map((q) => (
                    <Table.Row
                      key={q.id}
                      id={q.id}
                      className="cursor-pointer"
                      onAction={() =>
                        void navigate({ to: "/quotes/$id", params: { id: String(q.id) } })
                      }
                    >
                      <Table.Cell className="font-medium">
                        N° {String(q.folio).padStart(4, "0")}
                      </Table.Cell>
                      <Table.Cell>{q.companyName}</Table.Cell>
                      <Table.Cell>{formatDate(q.issueDate)}</Table.Cell>
                      <Table.Cell>{q.createdByName ?? "—"}</Table.Cell>
                      <Table.Cell>{STATUS_LABELS[q.status]}</Table.Cell>
                      <Table.Cell>{formatCurrency(q.total)}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        )}
      </Card>
    </div>
  );
}

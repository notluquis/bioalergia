import { Button, Card, Chip, EmptyState, Spinner, Table } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { CompanyFormModal } from "@/features/quotes/components/CompanyFormModal";
import { getCompany, listQuotes, quotesKeys } from "@/features/quotes/api";
import { formatCurrency } from "@/lib/utils";
import { PAGE_CONTAINER } from "@/lib/styles";
import { STATUS_LABELS } from "@/features/quotes/labels";

export const Route = createFileRoute("/_authed/companies/$id")({
  staticData: {
    permission: { action: "read", subject: "Company" },
    title: "Empresa",
    hideFromNav: true,
  },
  component: CompanyDetailPage,
});

function formatDate(d: Date | string): string {
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "medium" }).format(new Date(d));
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-default-500 text-xs">{label}</p>
      <p className="text-sm">{value || "—"}</p>
    </div>
  );
}

function CompanyDetailPage() {
  const { id } = Route.useParams();
  const companyId = Number(id);
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);

  const companyQuery = useQuery({
    queryKey: quotesKeys.company(companyId),
    queryFn: () => getCompany(companyId),
  });
  const quotesQuery = useQuery({
    queryKey: quotesKeys.list(companyId),
    queryFn: () => listQuotes({ companyId }),
  });

  const company = companyQuery.data;
  const quotes = quotesQuery.data ?? [];

  return (
    <div className={PAGE_CONTAINER}>
      <div className="mb-6 flex items-center justify-between">
        <Button
          variant="outline"
          className="gap-2"
          onPress={() => void navigate({ to: "/companies" })}
        >
          <ChevronLeft size={20} /> Volver
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onPress={() => setModalOpen(true)}>
            <Pencil size={18} /> Editar
          </Button>
          <Button
            className="gap-2"
            onPress={() => void navigate({ to: "/quotes/new", search: { companyId } })}
          >
            <Plus size={18} /> Nueva cotización
          </Button>
        </div>
      </div>

      {companyQuery.isLoading ? (
        <Spinner aria-label="Cargando empresa" />
      ) : !company ? (
        <EmptyState>Empresa no encontrada.</EmptyState>
      ) : (
        <>
          <Card className="space-y-4 p-6">
            <h1 className="font-semibold text-xl">{company.razonSocial}</h1>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="RUT" value={company.rut} />
              <Field label="Giro" value={company.giro} />
              <Field label="Condición de pago" value={company.condicionPago} />
              <Field label="Dirección" value={company.direccion} />
              <Field label="Comuna" value={company.comuna} />
              <Field label="Ciudad" value={company.ciudad} />
              <Field label="Email" value={company.email} />
              <Field label="Teléfono" value={company.phone} />
            </div>
            {company.contacts.length > 0 ? (
              <div className="space-y-1">
                <p className="text-default-500 text-xs">Contactos</p>
                <div className="flex flex-wrap gap-2">
                  {company.contacts.map((ct) => (
                    <Chip key={ct.id} variant="secondary">
                      {ct.name}
                      {ct.role ? ` · ${ct.role}` : ""}
                    </Chip>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>

          <Card className="mt-6 space-y-4 p-4">
            <h2 className="font-semibold">Cotizaciones</h2>
            {quotesQuery.isLoading ? (
              <Spinner aria-label="Cargando cotizaciones" />
            ) : quotes.length === 0 ? (
              <EmptyState>Sin cotizaciones para esta empresa.</EmptyState>
            ) : (
              <Table>
                <Table.ScrollContainer>
                  <Table.Content aria-label="Cotizaciones de la empresa" className="min-w-[560px]">
                    <Table.Header>
                      <Table.Column isRowHeader>Folio</Table.Column>
                      <Table.Column>Fecha</Table.Column>
                      <Table.Column>Estado</Table.Column>
                      <Table.Column>Total</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {quotes.map((q) => (
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
                          <Table.Cell>{formatDate(q.issueDate)}</Table.Cell>
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

          <CompanyFormModal isOpen={modalOpen} onOpenChange={setModalOpen} company={company} />
        </>
      )}
    </div>
  );
}

import { Button, Card, EmptyState, SearchField, Spinner, Table } from "@heroui/react";
import type { CompanyDto } from "@finanzas/orpc-contracts/quotes";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Building2, Pencil, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { CompanyFormModal } from "@/features/quotes/components/CompanyFormModal";
import { listCompanies, quotesKeys } from "@/features/quotes/api";
import { PAGE_CONTAINER } from "@/lib/styles";

const EMPTY: never[] = [];

export const Route = createFileRoute("/_authed/companies/")({
  staticData: {
    nav: { iconKey: "Building2", label: "Empresas", order: 71, section: "Finanzas" },
    permission: { action: "read", subject: "Company" },
    title: "Empresas",
  },
  component: CompaniesPage,
});

function CompaniesPage() {
  const navigate = useNavigate();
  const companiesQuery = useQuery({
    queryKey: quotesKeys.companies(),
    queryFn: () => listCompanies(),
  });
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyDto | undefined>(undefined);

  const companies = companiesQuery.data ?? EMPTY;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter(
      (c) =>
        c.razonSocial.toLowerCase().includes(q) ||
        (c.rut ?? "").toLowerCase().includes(q) ||
        (c.giro ?? "").toLowerCase().includes(q)
    );
  }, [companies, search]);

  return (
    <div className={PAGE_CONTAINER}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 font-semibold text-xl">
          <Building2 size={22} /> Empresas
        </h1>
        <Button
          className="gap-2"
          onPress={() => {
            setEditing(undefined);
            setModalOpen(true);
          }}
        >
          <Plus size={18} /> Nueva empresa
        </Button>
      </div>

      <Card className="space-y-4 p-4">
        <SearchField
          value={search}
          onChange={setSearch}
          aria-label="Buscar empresa"
          variant="secondary"
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Buscar por razón social, RUT o giro…" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>

        {companiesQuery.isLoading ? (
          <Spinner aria-label="Cargando empresas" />
        ) : filtered.length === 0 ? (
          <EmptyState>No hay empresas.</EmptyState>
        ) : (
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="Empresas" className="min-w-[640px]">
                <Table.Header>
                  <Table.Column isRowHeader>Razón social</Table.Column>
                  <Table.Column>RUT</Table.Column>
                  <Table.Column>Giro</Table.Column>
                  <Table.Column>Comuna</Table.Column>
                  <Table.Column>Contactos</Table.Column>
                  <Table.Column> </Table.Column>
                </Table.Header>
                <Table.Body>
                  {filtered.map((c) => (
                    <Table.Row
                      key={c.id}
                      id={c.id}
                      onAction={() =>
                        void navigate({ to: "/companies/$id", params: { id: String(c.id) } })
                      }
                      className="cursor-pointer"
                    >
                      <Table.Cell className="font-medium">{c.razonSocial}</Table.Cell>
                      <Table.Cell>{c.rut ?? "—"}</Table.Cell>
                      <Table.Cell>{c.giro ?? "—"}</Table.Cell>
                      <Table.Cell>{c.comuna ?? "—"}</Table.Cell>
                      <Table.Cell>{c.contacts.length}</Table.Cell>
                      <Table.Cell>
                        <Button
                          variant="outline"
                          size="sm"
                          isIconOnly
                          aria-label={`Editar ${c.razonSocial}`}
                          onPress={() => {
                            setEditing(c);
                            setModalOpen(true);
                          }}
                        >
                          <Pencil size={16} />
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        )}
      </Card>

      <CompanyFormModal isOpen={modalOpen} onOpenChange={setModalOpen} company={editing} />
    </div>
  );
}

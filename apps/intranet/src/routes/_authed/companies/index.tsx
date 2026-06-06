import { Button, Card, SearchField } from "@heroui/react";
import type { CompanyDto } from "@finanzas/orpc-contracts/quotes";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Building2, Pencil, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
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

  const columns = useMemo<ColumnDef<CompanyDto>[]>(
    () => [
      {
        accessorKey: "razonSocial",
        header: "Razón social",
        cell: ({ row }) => <span className="font-medium">{row.original.razonSocial}</span>,
      },
      { accessorKey: "rut", header: "RUT", cell: ({ row }) => row.original.rut ?? "—" },
      { accessorKey: "giro", header: "Giro", cell: ({ row }) => row.original.giro ?? "—" },
      { accessorKey: "comuna", header: "Comuna", cell: ({ row }) => row.original.comuna ?? "—" },
      {
        id: "contacts",
        header: "Contactos",
        cell: ({ row }) => row.original.contacts.length,
      },
      {
        id: "actions",
        header: " ",
        enableSorting: false,
        cell: ({ row }) => (
          <Button
            variant="outline"
            size="sm"
            isIconOnly
            aria-label={`Editar ${row.original.razonSocial}`}
            onPress={() => {
              setEditing(row.original);
              setModalOpen(true);
            }}
          >
            <Pencil size={16} />
          </Button>
        ),
      },
    ],
    []
  );

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

        <DataTable
          columns={columns}
          data={filtered}
          isLoading={companiesQuery.isLoading}
          enableToolbar={false}
          enableVirtualization={false}
          noDataMessage="No hay empresas."
          onRowClick={(c) => void navigate({ to: "/companies/$id", params: { id: String(c.id) } })}
        />
      </Card>

      <CompanyFormModal isOpen={modalOpen} onOpenChange={setModalOpen} company={editing} />
    </div>
  );
}

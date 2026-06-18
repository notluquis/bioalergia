import { Button, Card, Chip, EmptyState, SearchField } from "@heroui/react";
import type { ClinicalAllergenDto } from "@finanzas/orpc-contracts/clinical-allergens";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";
import { Microscope, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { AllergenFormModal } from "@/features/allergens/components/AllergenFormModal";
import { allergensKeys, listAllergens } from "@/features/allergens/api";
import { PAGE_CONTAINER } from "@/lib/styles";

const EMPTY: never[] = [];
const LIST_OPTS = { includeInactive: true } as const;

export const Route = createFileRoute("/_authed/settings/allergens")({
  staticData: {
    nav: {
      iconKey: "Microscope",
      label: "Alérgenos clínicos",
      order: 88,
      section: "Sistema",
    },
    permission: { action: "update", subject: "ClinicalAllergen" },
    title: "Configuración — Catálogo de alérgenos clínicos",
  },
  beforeLoad: requirePermission("update", "ClinicalAllergen"),
  component: AllergensSettingsPage,
});

function AllergensSettingsPage() {
  const allergensQuery = useQuery({
    queryKey: allergensKeys.list(LIST_OPTS),
    queryFn: () => listAllergens(LIST_OPTS),
  });
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ClinicalAllergenDto | undefined>(undefined);

  const allergens = allergensQuery.data ?? EMPTY;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allergens;
    return allergens.filter((a) =>
      [a.commonName, a.scientificName, a.englishName, a.category, ...a.tags].some(
        (v) => v != null && v.toLowerCase().includes(q)
      )
    );
  }, [allergens, search]);

  const openNew = () => {
    setEditing(undefined);
    setModalOpen(true);
  };
  const openEdit = (a: ClinicalAllergenDto) => {
    setEditing(a);
    setModalOpen(true);
  };

  const columns = useMemo<ColumnDef<ClinicalAllergenDto>[]>(
    () => [
      {
        accessorKey: "commonName",
        header: "Nombre común",
        cell: ({ row }) => <span className="font-medium">{row.original.commonName}</span>,
      },
      {
        accessorKey: "scientificName",
        header: "Nombre científico",
        cell: ({ row }) => <span className="italic">{row.original.scientificName ?? "—"}</span>,
      },
      {
        accessorKey: "category",
        header: "Categoría",
        cell: ({ row }) => row.original.category,
      },
      {
        accessorKey: "tags",
        header: "Etiquetas",
        cell: ({ row }) =>
          row.original.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {row.original.tags.map((tag) => (
                <Chip key={tag} variant="secondary" size="sm">
                  {tag}
                </Chip>
              ))}
            </div>
          ) : (
            "—"
          ),
      },
      {
        accessorKey: "isActive",
        header: "Estado",
        cell: ({ row }) =>
          row.original.isActive ? (
            <Chip variant="primary" size="sm">
              Activo
            </Chip>
          ) : (
            <Chip variant="secondary" size="sm">
              Inactivo
            </Chip>
          ),
      },
    ],
    []
  );

  return (
    <div className={PAGE_CONTAINER}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-semibold text-xl">
            <Microscope size={22} /> Catálogo de alérgenos clínicos
          </h1>
          <p className="text-default-500 text-sm">
            Alérgenos usados en informes de exámenes y prescripciones de inmunoterapia.
          </p>
        </div>
        <Button className="gap-2" onPress={openNew}>
          <Plus size={18} /> Agregar alérgeno
        </Button>
      </div>

      <Card className="space-y-4 p-4">
        <SearchField
          value={search}
          onChange={setSearch}
          aria-label="Buscar alérgeno"
          variant="secondary"
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Buscar por nombre, categoría o etiqueta…" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>

        {!allergensQuery.isLoading && allergens.length === 0 ? (
          <EmptyState>
            <div className="space-y-3 text-center">
              <p>Aún no hay alérgenos en el catálogo.</p>
              <Button className="gap-2" onPress={openNew}>
                <Plus size={18} /> Agregar el primero
              </Button>
            </div>
          </EmptyState>
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            isLoading={allergensQuery.isLoading}
            enableToolbar={false}
            enableVirtualization={false}
            noDataMessage="Sin resultados para la búsqueda."
            onRowClick={(a) => openEdit(a)}
          />
        )}
      </Card>

      <AllergenFormModal isOpen={modalOpen} onOpenChange={setModalOpen} allergen={editing} />
    </div>
  );
}

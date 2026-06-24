import { DataTable } from "@/components/data-table/DataTable";
import { formatChile } from "@/lib/dates";
import { Button, Card, Checkbox, Chip } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import type {
  ColumnDef,
  OnChangeFn,
  PaginationState,
  RowSelectionState,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import type {
  OutreachDependencia,
  OutreachProspectSource,
  OutreachProspectType,
  OutreachStatus,
} from "@finanzas/orpc-contracts/outreach";
import { SelectInput, TextInput } from "../components/FormField";
import { useBulkUpdate, useEstablishments, useFiltersMeta } from "../hooks/useOutreach";
import {
  DEPENDENCIA_LABELS,
  ESTADO_COLOR,
  ESTADO_LABELS,
  PRIORIDAD_COLOR,
  PRIORIDAD_LABELS,
} from "../labels";

const ALL_ESTADOS: OutreachStatus[] = [
  "SIN_CONTACTAR",
  "CONTACTADO",
  "SIN_RESPUESTA",
  "RESPONDIO_INTERES",
  "RESPONDIO_MAS_INFO",
  "RESPONDIO_DESISTIO",
  "REUNION_AGENDADA",
  "CONVENIO_FIRMADO",
  "DESCARTADO",
];

const ALL_DEPS: OutreachDependencia[] = [
  "MUNICIPAL",
  "PARTICULAR_SUBVENCIONADO",
  "PARTICULAR_PAGADO",
  "SLEP",
  "CORPORACION_MUNICIPAL",
  "OTRO",
];

const TIPO_OPTIONS = [
  { value: "", label: "Todos los tipos" },
  { value: "COLEGIO", label: "Colegio" },
  { value: "EMPRESA", label: "Empresa" },
  { value: "MUNICIPIO", label: "Municipio" },
  { value: "INSTITUCION", label: "Institución" },
  { value: "UNIVERSIDAD", label: "Universidad" },
  { value: "OTRO", label: "Otro" },
];

const FUENTE_OPTIONS = [
  { value: "", label: "Todas las fuentes" },
  { value: "MINEDUC", label: "MINEDUC" },
  { value: "GOOGLE_PLACES", label: "Google Places" },
  { value: "CRAWLER", label: "Crawler" },
  { value: "APOLLO", label: "Apollo" },
  { value: "HUNTER", label: "Hunter" },
  { value: "MANUAL", label: "Manual" },
];

type EstablishmentItem = NonNullable<ReturnType<typeof useEstablishments>["data"]>["items"][number];
type EstablishmentRow = EstablishmentItem & { id: string };

export function OutreachEstablishmentsPage() {
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState<OutreachStatus | "">("");
  const [dep, setDep] = useState<OutreachDependencia | "">("");
  const [tipo, setTipo] = useState<OutreachProspectType | "">("");
  const [fuente, setFuente] = useState<OutreachProspectSource | "">("");
  const [comuna, setComuna] = useState("");
  const [soloConEmail, setSoloConEmail] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtersMeta = useFiltersMeta();

  const params = useMemo(
    () => ({
      page,
      pageSize,
      search: search.trim() || undefined,
      estados: estado ? [estado] : undefined,
      dependencias: dep ? [dep] : undefined,
      tipos: tipo ? [tipo] : undefined,
      fuentes: fuente ? [fuente] : undefined,
      comunas: comuna ? [comuna] : undefined,
      soloConEmail: soloConEmail || undefined,
    }),
    [page, search, estado, dep, tipo, fuente, comuna, soloConEmail]
  );

  const { data, isLoading } = useEstablishments(params);
  const bulkUpdate = useBulkUpdate();

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  // El DataTable usa el `id` de la fila como clave de selección; los items se
  // identifican por `rbd`, así que lo proyectamos a `id` para que selección y
  // bulk update hablen el mismo idioma.
  const rows = useMemo<EstablishmentRow[]>(
    () => (data?.items ?? []).map((it) => ({ ...it, id: it.rbd })),
    [data?.items]
  );

  const rowSelection = useMemo<RowSelectionState>(
    () => Object.fromEntries(Array.from(selected, (rbd) => [rbd, true])),
    [selected]
  );

  const handleRowSelectionChange: OnChangeFn<RowSelectionState> = (updater) => {
    const next = typeof updater === "function" ? updater(rowSelection) : updater;
    setSelected(
      new Set(
        Object.entries(next)
          .filter(([, v]) => v)
          .map(([rbd]) => rbd)
      )
    );
  };

  const handlePaginationChange: OnChangeFn<PaginationState> = (updater) => {
    const prev: PaginationState = { pageIndex: page - 1, pageSize };
    const next = typeof updater === "function" ? updater(prev) : updater;
    setPage(next.pageIndex + 1);
  };

  const columns = useMemo<ColumnDef<EstablishmentRow>[]>(
    () => [
      {
        accessorKey: "nombre",
        header: "Nombre",
        enableSorting: false,
        cell: ({ row }) => (
          <>
            <Link
              to="/outreach/establecimientos/$rbd"
              params={{ rbd: row.original.rbd }}
              className="font-medium hover:underline"
            >
              {row.original.nombre}
            </Link>
            <p className="text-default-400 text-xs">{row.original.rbd}</p>
          </>
        ),
      },
      {
        accessorKey: "tipo",
        header: "Tipo",
        enableSorting: false,
        cell: ({ row }) => (
          <Chip size="sm" variant="soft">
            {row.original.tipo}
          </Chip>
        ),
      },
      { accessorKey: "comuna", header: "Comuna", enableSorting: false },
      {
        accessorKey: "emailMineduc",
        header: "Email",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.emailMineduc ? (
            <span className="text-xs">{row.original.emailMineduc}</span>
          ) : (
            <span className="text-default-400 text-xs">sin email</span>
          ),
      },
      {
        accessorKey: "estado",
        header: "Estado",
        enableSorting: false,
        cell: ({ row }) => (
          <Chip size="sm" color={ESTADO_COLOR[row.original.estado]} variant="soft">
            {ESTADO_LABELS[row.original.estado]}
          </Chip>
        ),
      },
      {
        accessorKey: "prioridad",
        header: "Prioridad",
        enableSorting: false,
        cell: ({ row }) => (
          <Chip size="sm" color={PRIORIDAD_COLOR[row.original.prioridad]} variant="soft">
            {PRIORIDAD_LABELS[row.original.prioridad]}
          </Chip>
        ),
      },
      {
        accessorKey: "score",
        header: "Score",
        enableSorting: false,
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.score}</span>,
      },
      {
        accessorKey: "ultimoContactoAt",
        header: "Último contacto",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.ultimoContactoAt
            ? formatChile(row.original.ultimoContactoAt, "DD-MM-YYYY")
            : "—",
      },
    ],
    []
  );

  const handleBulkEstado = async (newEstado: OutreachStatus) => {
    if (selected.size === 0) return;
    await bulkUpdate.mutateAsync({ rbds: Array.from(selected), estado: newEstado });
    setSelected(new Set());
  };

  const comunaOptions = useMemo(() => {
    const list = filtersMeta.data?.comunas ?? [];
    return [
      { value: "", label: "Todas las comunas" },
      ...list.map((c) => ({ value: c, label: c })),
    ];
  }, [filtersMeta.data?.comunas]);

  const estadoOptions = [
    { value: "", label: "Todos los estados" },
    ...ALL_ESTADOS.map((s) => ({ value: s, label: ESTADO_LABELS[s] })),
  ];
  const depOptions = [
    { value: "", label: "Todas las dependencias" },
    ...ALL_DEPS.map((d) => ({ value: d, label: DEPENDENCIA_LABELS[d] })),
  ];
  const bulkEstadoOptions = [
    { value: "", label: "Cambiar estado a..." },
    ...ALL_ESTADOS.map((s) => ({ value: s, label: ESTADO_LABELS[s] })),
  ];

  return (
    <div className="space-y-4 p-6">
      <Card>
        <Card.Content className="space-y-3 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <TextInput
              label="Buscar"
              placeholder="Nombre, RBD o director"
              value={search}
              onValueChange={setSearch}
            />
            <SelectInput
              label="Estado"
              value={estado}
              onValueChange={(v) => setEstado(v as OutreachStatus | "")}
              options={estadoOptions}
            />
            <SelectInput
              label="Dependencia"
              value={dep}
              onValueChange={(v) => setDep(v as OutreachDependencia | "")}
              options={depOptions}
            />
            <SelectInput
              label="Comuna"
              value={comuna}
              onValueChange={setComuna}
              options={comunaOptions}
            />
            <SelectInput
              label="Tipo"
              value={tipo}
              onValueChange={(v) => setTipo(v as OutreachProspectType | "")}
              options={TIPO_OPTIONS}
            />
            <SelectInput
              label="Fuente"
              value={fuente}
              onValueChange={(v) => setFuente(v as OutreachProspectSource | "")}
              options={FUENTE_OPTIONS}
            />
          </div>
          <Checkbox isSelected={soloConEmail} onChange={setSoloConEmail}>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            <Checkbox.Content>Solo con email</Checkbox.Content>
          </Checkbox>

          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-medium bg-default-100 p-3">
              <span className="text-sm">{selected.size} seleccionados</span>
              <SelectInput
                value=""
                onValueChange={(v) => {
                  if (v) void handleBulkEstado(v as OutreachStatus);
                }}
                options={bulkEstadoOptions}
                className="max-w-xs"
              />
              <Button size="sm" variant="secondary" onPress={() => setSelected(new Set())}>
                Limpiar selección
              </Button>
            </div>
          )}
        </Card.Content>
      </Card>

      {data && <span className="text-default-500 text-sm">{`${data.total} establecimientos`}</span>}

      <Card>
        <Card.Content className="p-0">
          <DataTable
            columns={columns}
            data={rows}
            enablePageSizeSelector={false}
            enableToolbar={false}
            enableVirtualization={false}
            isLoading={isLoading}
            noDataMessage="Sin establecimientos"
            onPaginationChange={handlePaginationChange}
            onRowSelectionChange={handleRowSelectionChange}
            pageCount={totalPages}
            pageSizeOptions={[pageSize]}
            pagination={{ pageIndex: page - 1, pageSize }}
            rowSelection={rowSelection}
            scrollMode="container"
          />
        </Card.Content>
      </Card>
    </div>
  );
}

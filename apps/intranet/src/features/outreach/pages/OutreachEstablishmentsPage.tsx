import { Button, Card, Checkbox, Chip, Spinner, Table } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import dayjs from "dayjs";
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

  const onSelectionChange = (keys: "all" | Set<unknown>) => {
    if (keys === "all") {
      setSelected(new Set(data?.items.map((i) => i.rbd) ?? []));
      return;
    }
    setSelected(new Set(Array.from(keys, (k) => String(k))));
  };

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
                onValueChange={(v) => v && handleBulkEstado(v as OutreachStatus)}
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

      {isLoading || !data ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <Card>
          <Card.Content className="p-0">
            <Table>
              <Table.ScrollContainer>
                <Table.Content
                  aria-label="Establecimientos"
                  selectionMode="multiple"
                  selectedKeys={selected}
                  onSelectionChange={onSelectionChange as never}
                >
                  <Table.Header>
                    <Table.Column isRowHeader>Nombre</Table.Column>
                    <Table.Column>Tipo</Table.Column>
                    <Table.Column>Comuna</Table.Column>
                    <Table.Column>Email</Table.Column>
                    <Table.Column>Estado</Table.Column>
                    <Table.Column>Prioridad</Table.Column>
                    <Table.Column>Score</Table.Column>
                    <Table.Column>Último contacto</Table.Column>
                  </Table.Header>
                  <Table.Body items={data.items}>
                    {(it) => (
                      <Table.Row id={it.rbd}>
                        <Table.Cell>
                          <Link
                            to="/outreach/establecimientos/$rbd"
                            params={{ rbd: it.rbd }}
                            className="font-medium hover:underline"
                          >
                            {it.nombre}
                          </Link>
                          <p className="text-default-400 text-xs">{it.rbd}</p>
                        </Table.Cell>
                        <Table.Cell>
                          <Chip size="sm" variant="soft">
                            {it.tipo}
                          </Chip>
                        </Table.Cell>
                        <Table.Cell>{it.comuna}</Table.Cell>
                        <Table.Cell>
                          {it.emailMineduc ? (
                            <span className="text-xs">{it.emailMineduc}</span>
                          ) : (
                            <span className="text-default-400 text-xs">sin email</span>
                          )}
                        </Table.Cell>
                        <Table.Cell>
                          <Chip size="sm" color={ESTADO_COLOR[it.estado]} variant="soft">
                            {ESTADO_LABELS[it.estado]}
                          </Chip>
                        </Table.Cell>
                        <Table.Cell>
                          <Chip size="sm" color={PRIORIDAD_COLOR[it.prioridad]} variant="soft">
                            {PRIORIDAD_LABELS[it.prioridad]}
                          </Chip>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="font-mono text-xs">{it.score}</span>
                        </Table.Cell>
                        <Table.Cell>
                          {it.ultimoContactoAt
                            ? dayjs(it.ultimoContactoAt).format("DD-MM-YYYY")
                            : "—"}
                        </Table.Cell>
                      </Table.Row>
                    )}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </Card.Content>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <span className="text-default-500 text-sm">
          {data ? `${data.total} establecimientos` : ""}
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            isDisabled={page <= 1}
            onPress={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <span className="text-sm">
            Página {page} de {totalPages}
          </span>
          <Button
            size="sm"
            variant="secondary"
            isDisabled={page >= totalPages}
            onPress={() => setPage((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}

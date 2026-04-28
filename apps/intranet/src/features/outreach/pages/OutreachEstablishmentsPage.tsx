import { Button, Card, Chip, Input, Select, SelectOption, Spinner, Table } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import dayjs from "dayjs";
import type { OutreachDependencia, OutreachStatus } from "@finanzas/orpc-contracts/outreach";
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

export function OutreachEstablishmentsPage() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState<OutreachStatus | "">("");
  const [dep, setDep] = useState<OutreachDependencia | "">("");
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
      comunas: comuna ? [comuna] : undefined,
      soloConEmail: soloConEmail || undefined,
    }),
    [page, pageSize, search, estado, dep, comuna, soloConEmail]
  );

  const { data, isLoading } = useEstablishments(params);
  const bulkUpdate = useBulkUpdate();

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  const toggleRow = (rbd: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rbd)) next.delete(rbd);
      else next.add(rbd);
      return next;
    });
  };

  const togglePage = () => {
    if (!data) return;
    const allOnPage = data.items.every((i) => selected.has(i.rbd));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const i of data.items) {
        if (allOnPage) next.delete(i.rbd);
        else next.add(i.rbd);
      }
      return next;
    });
  };

  const handleBulkEstado = async (newEstado: OutreachStatus) => {
    if (selected.size === 0) return;
    await bulkUpdate.mutateAsync({ rbds: Array.from(selected), estado: newEstado });
    setSelected(new Set());
  };

  return (
    <div className="space-y-4 p-6">
      <header className="flex items-center justify-between">
        <h1 className="font-bold text-2xl">Establecimientos</h1>
        <Button as={Link} to="/outreach/importar" color="primary" variant="flat">
          Importar MINEDUC
        </Button>
      </header>

      <Card>
        <Card.Body className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <Input
              placeholder="Buscar por nombre, RBD o director..."
              value={search}
              onValueChange={setSearch}
              size="sm"
            />
            <Select
              placeholder="Estado"
              selectedKey={estado || undefined}
              onSelectionChange={(k) => setEstado((k as OutreachStatus) ?? "")}
              size="sm"
            >
              <SelectOption id="">Todos</SelectOption>
              {ALL_ESTADOS.map((e) => (
                <SelectOption key={e} id={e}>
                  {ESTADO_LABELS[e]}
                </SelectOption>
              ))}
            </Select>
            <Select
              placeholder="Dependencia"
              selectedKey={dep || undefined}
              onSelectionChange={(k) => setDep((k as OutreachDependencia) ?? "")}
              size="sm"
            >
              <SelectOption id="">Todas</SelectOption>
              {ALL_DEPS.map((d) => (
                <SelectOption key={d} id={d}>
                  {DEPENDENCIA_LABELS[d]}
                </SelectOption>
              ))}
            </Select>
            <Select
              placeholder="Comuna"
              selectedKey={comuna || undefined}
              onSelectionChange={(k) => setComuna((k as string) ?? "")}
              size="sm"
            >
              <SelectOption id="">Todas</SelectOption>
              {(filtersMeta.data?.comunas ?? []).map((c) => (
                <SelectOption key={c} id={c}>
                  {c}
                </SelectOption>
              ))}
            </Select>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={soloConEmail}
                onChange={(e) => setSoloConEmail(e.target.checked)}
              />
              Solo con email
            </label>
          </div>

          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-medium bg-default-100 p-3">
              <span className="text-sm">{selected.size} seleccionados</span>
              <Select
                placeholder="Cambiar estado a..."
                onSelectionChange={(k) => k && handleBulkEstado(k as OutreachStatus)}
                size="sm"
                className="max-w-xs"
              >
                {ALL_ESTADOS.map((e) => (
                  <SelectOption key={e} id={e}>
                    {ESTADO_LABELS[e]}
                  </SelectOption>
                ))}
              </Select>
              <Button size="sm" variant="flat" onPress={() => setSelected(new Set())}>
                Limpiar selección
              </Button>
            </div>
          )}
        </Card.Body>
      </Card>

      {isLoading || !data ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <Card>
          <Card.Body className="p-0">
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="Establecimientos">
                  <Table.Header>
                    <Table.Column>
                      <input
                        type="checkbox"
                        checked={
                          data.items.length > 0 && data.items.every((i) => selected.has(i.rbd))
                        }
                        onChange={togglePage}
                      />
                    </Table.Column>
                    <Table.Column isRowHeader>Nombre</Table.Column>
                    <Table.Column>Comuna</Table.Column>
                    <Table.Column>Dependencia</Table.Column>
                    <Table.Column>Director</Table.Column>
                    <Table.Column>Email</Table.Column>
                    <Table.Column>Estado</Table.Column>
                    <Table.Column>Prioridad</Table.Column>
                    <Table.Column>Último contacto</Table.Column>
                    <Table.Column>Interacciones</Table.Column>
                  </Table.Header>
                  <Table.Body items={data.items}>
                    {(it) => (
                      <Table.Row id={it.rbd}>
                        <Table.Cell>
                          <input
                            type="checkbox"
                            checked={selected.has(it.rbd)}
                            onChange={() => toggleRow(it.rbd)}
                          />
                        </Table.Cell>
                        <Table.Cell>
                          <Link
                            to="/outreach/establecimientos/$rbd"
                            params={{ rbd: it.rbd }}
                            className="font-medium hover:underline"
                          >
                            {it.nombre}
                          </Link>
                          <p className="text-default-400 text-xs">RBD {it.rbd}</p>
                        </Table.Cell>
                        <Table.Cell>{it.comuna}</Table.Cell>
                        <Table.Cell>
                          <span className="text-xs">{DEPENDENCIA_LABELS[it.dependencia]}</span>
                        </Table.Cell>
                        <Table.Cell>{it.directorMineduc ?? "—"}</Table.Cell>
                        <Table.Cell>
                          {it.emailMineduc ? (
                            <span className="text-xs">{it.emailMineduc}</span>
                          ) : (
                            <span className="text-default-400 text-xs">sin email</span>
                          )}
                        </Table.Cell>
                        <Table.Cell>
                          <Chip size="sm" color={ESTADO_COLOR[it.estado]} variant="flat">
                            {ESTADO_LABELS[it.estado]}
                          </Chip>
                        </Table.Cell>
                        <Table.Cell>
                          <Chip size="sm" color={PRIORIDAD_COLOR[it.prioridad]} variant="flat">
                            {PRIORIDAD_LABELS[it.prioridad]}
                          </Chip>
                        </Table.Cell>
                        <Table.Cell>
                          {it.ultimoContactoAt
                            ? dayjs(it.ultimoContactoAt).format("DD-MM-YYYY")
                            : "—"}
                        </Table.Cell>
                        <Table.Cell>{it.interaccionesCount}</Table.Cell>
                      </Table.Row>
                    )}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </Card.Body>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <span className="text-default-500 text-sm">
          {data ? `${data.total} establecimientos` : ""}
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="flat"
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
            variant="flat"
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

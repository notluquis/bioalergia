import { Button, Card, Chip, Spinner, Table } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import dayjs from "dayjs";
import type {
  OutreachDependencia,
  OutreachProspectSource,
  OutreachProspectType,
  OutreachStatus,
} from "@finanzas/orpc-contracts/outreach";
import { Field, NativeSelect, TextInput } from "../components/FormField";
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
        <Link to="/outreach/importar">
          <Button variant="primary">Importar MINEDUC</Button>
        </Link>
      </header>

      <Card>
        <Card.Content className="space-y-3 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <Field label="Buscar">
              <TextInput
                placeholder="Nombre, RBD o director..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Field>
            <Field label="Estado">
              <NativeSelect
                value={estado}
                onChange={(e) => setEstado(e.target.value as OutreachStatus | "")}
              >
                <option value="">Todos</option>
                {ALL_ESTADOS.map((s) => (
                  <option key={s} value={s}>
                    {ESTADO_LABELS[s]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Dependencia">
              <NativeSelect
                value={dep}
                onChange={(e) => setDep(e.target.value as OutreachDependencia | "")}
              >
                <option value="">Todas</option>
                {ALL_DEPS.map((d) => (
                  <option key={d} value={d}>
                    {DEPENDENCIA_LABELS[d]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Comuna">
              <NativeSelect value={comuna} onChange={(e) => setComuna(e.target.value)}>
                <option value="">Todas</option>
                {(filtersMeta.data?.comunas ?? []).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Tipo">
              <NativeSelect
                value={tipo}
                onChange={(e) => setTipo(e.target.value as OutreachProspectType | "")}
              >
                <option value="">Todos</option>
                <option value="COLEGIO">Colegio</option>
                <option value="EMPRESA">Empresa</option>
                <option value="MUNICIPIO">Municipio</option>
                <option value="INSTITUCION">Institución</option>
                <option value="UNIVERSIDAD">Universidad</option>
                <option value="OTRO">Otro</option>
              </NativeSelect>
            </Field>
            <Field label="Fuente">
              <NativeSelect
                value={fuente}
                onChange={(e) => setFuente(e.target.value as OutreachProspectSource | "")}
              >
                <option value="">Todas</option>
                <option value="MINEDUC">MINEDUC</option>
                <option value="GOOGLE_PLACES">Google Places</option>
                <option value="CRAWLER">Crawler</option>
                <option value="APOLLO">Apollo</option>
                <option value="HUNTER">Hunter</option>
                <option value="MANUAL">Manual</option>
              </NativeSelect>
            </Field>
            <label className="flex items-end gap-2 text-sm">
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
              <NativeSelect
                className="max-w-xs"
                onChange={(e) => {
                  if (e.target.value) void handleBulkEstado(e.target.value as OutreachStatus);
                }}
                defaultValue=""
              >
                <option value="">Cambiar estado a...</option>
                {ALL_ESTADOS.map((s) => (
                  <option key={s} value={s}>
                    {ESTADO_LABELS[s]}
                  </option>
                ))}
              </NativeSelect>
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

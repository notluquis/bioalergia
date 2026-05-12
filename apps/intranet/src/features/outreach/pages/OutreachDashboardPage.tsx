import { Card, Chip, Spinner, Table } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import type { OutreachProspectType, OutreachStatus } from "@finanzas/orpc-contracts/outreach";
import { useDashboard } from "../hooks/useOutreach";
import { DEPENDENCIA_LABELS, ESTADO_COLOR, ESTADO_LABELS, INTERACCION_LABELS } from "../labels";

const TIPO_LABELS: Record<string, string> = {
  COLEGIO: "Colegios",
  EMPRESA: "Empresas",
  MUNICIPIO: "Municipios",
  INSTITUCION: "Instituciones",
  UNIVERSIDAD: "Universidades",
  OTRO: "Otros",
};

const FUENTE_LABELS: Record<string, string> = {
  MINEDUC: "MINEDUC",
  GOOGLE_PLACES: "Google Places",
  CRAWLER: "Crawler",
  APOLLO: "Apollo",
  HUNTER: "Hunter",
  MANUAL: "Manual",
};

export function OutreachDashboardPage() {
  const { data, isLoading } = useDashboard();

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const {
    totales,
    porEstado,
    porTipo,
    porFuente,
    porDependencia,
    porComuna,
    porTipoEstado,
    pendientesSeguimiento,
    ultimasInteracciones,
  } = data;

  return (
    <div className="space-y-6 p-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label="Total establecimientos" value={totales.establecimientos} />
        <StatCard label="Activos" value={totales.activos} />
        <StatCard label="Con email" value={totales.conEmail} />
        <StatCard
          label="Pendientes seguimiento (>7d)"
          value={pendientesSeguimiento}
          accent="warning"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <Card.Header>
            <Card.Title>Por tipo</Card.Title>
          </Card.Header>
          <Card.Content className="space-y-2 p-4">
            {porTipo.length === 0 && <p className="text-default-500 text-sm">Sin datos.</p>}
            {porTipo.map((row) => (
              <div key={row.tipo} className="flex items-center justify-between">
                <span className="font-medium text-sm">{TIPO_LABELS[row.tipo] ?? row.tipo}</span>
                <span className="font-mono text-sm">{row.count}</span>
              </div>
            ))}
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>Por fuente</Card.Title>
          </Card.Header>
          <Card.Content className="space-y-2 p-4">
            {porFuente.map((row) => (
              <div key={row.fuente} className="flex items-center justify-between">
                <span className="text-sm">{FUENTE_LABELS[row.fuente] ?? row.fuente}</span>
                <span className="font-mono text-sm">{row.count}</span>
              </div>
            ))}
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>Tipo × Estado</Card.Title>
            <Card.Description>Funnel cruzado.</Card.Description>
          </Card.Header>
          <Card.Content className="overflow-x-auto p-2">
            <TipoEstadoMatrix data={porTipoEstado} />
          </Card.Content>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <Card.Header>
            <Card.Title>Por estado (global)</Card.Title>
          </Card.Header>
          <Card.Content className="space-y-2 p-4">
            {porEstado.length === 0 && <p className="text-default-500 text-sm">Sin datos.</p>}
            {porEstado.map((row) => (
              <div key={row.estado} className="flex items-center justify-between">
                <Chip color={ESTADO_COLOR[row.estado]} variant="soft" size="sm">
                  {ESTADO_LABELS[row.estado]}
                </Chip>
                <span className="font-mono text-sm">{row.count}</span>
              </div>
            ))}
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>Por dependencia (colegios)</Card.Title>
          </Card.Header>
          <Card.Content className="space-y-2 p-4">
            {porDependencia.map((row) => (
              <div key={row.dependencia} className="flex items-center justify-between">
                <span className="text-sm">{DEPENDENCIA_LABELS[row.dependencia]}</span>
                <span className="font-mono text-sm">{row.count}</span>
              </div>
            ))}
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>Por comuna (top 12)</Card.Title>
          </Card.Header>
          <Card.Content className="space-y-2 p-4">
            {porComuna.slice(0, 12).map((row) => (
              <div key={row.comuna} className="flex items-center justify-between">
                <span className="text-sm">{row.comuna}</span>
                <span className="font-mono text-sm">{row.count}</span>
              </div>
            ))}
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>Últimas interacciones</Card.Title>
          </Card.Header>
          <Card.Content className="space-y-2 p-4">
            {ultimasInteracciones.length === 0 && (
              <p className="text-default-500 text-sm">Sin actividad reciente.</p>
            )}
            {ultimasInteracciones.slice(0, 10).map((i) => (
              <Link
                key={i.id}
                to="/outreach/establecimientos/$rbd"
                params={{ rbd: i.establecimientoRbd }}
                className="block rounded p-2 hover:bg-default-100"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm">{i.establishmentNombre}</span>
                  <Chip size="sm" variant="soft">
                    {INTERACCION_LABELS[i.tipo]}
                  </Chip>
                </div>
                <p className="line-clamp-1 text-default-500 text-xs">{i.contenido}</p>
              </Link>
            ))}
          </Card.Content>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: "warning" }) {
  return (
    <Card>
      <Card.Content className="p-4">
        <p className="text-default-500 text-xs uppercase tracking-wide">{label}</p>
        <p className={`font-bold text-3xl ${accent === "warning" ? "text-warning" : ""}`}>
          {value.toLocaleString("es-CL")}
        </p>
      </Card.Content>
    </Card>
  );
}

function TipoEstadoMatrix({
  data,
}: {
  data: Array<{ tipo: OutreachProspectType; estado: OutreachStatus; count: number }>;
}) {
  const tipos = Array.from(new Set(data.map((d) => d.tipo))) as OutreachProspectType[];
  const estados = Array.from(new Set(data.map((d) => d.estado))) as OutreachStatus[];
  if (tipos.length === 0) {
    return <p className="text-default-500 text-sm">Sin datos.</p>;
  }
  const lookup = new Map<string, number>();
  for (const d of data) lookup.set(`${d.tipo}|${d.estado}`, d.count);

  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content aria-label="Matriz tipo × estado">
          <Table.Header>
            <Table.Column isRowHeader>Tipo</Table.Column>
            {estados.map((e) => (
              <Table.Column key={e}>{ESTADO_LABELS[e].slice(0, 6)}</Table.Column>
            ))}
          </Table.Header>
          <Table.Body items={tipos.map((t) => ({ id: t, tipo: t }))}>
            {(row) => (
              <Table.Row id={row.id}>
                <Table.Cell>{TIPO_LABELS[row.tipo] ?? row.tipo}</Table.Cell>
                {estados.map((e) => {
                  const v = lookup.get(`${row.tipo}|${e}`) ?? 0;
                  return <Table.Cell key={e}>{v || "·"}</Table.Cell>;
                })}
              </Table.Row>
            )}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}

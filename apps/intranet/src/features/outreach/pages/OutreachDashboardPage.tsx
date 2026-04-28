import { Card, Chip, Spinner } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import { useDashboard } from "../hooks/useOutreach";
import { DEPENDENCIA_LABELS, ESTADO_COLOR, ESTADO_LABELS, INTERACCION_LABELS } from "../labels";

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
    porDependencia,
    porComuna,
    pendientesSeguimiento,
    ultimasInteracciones,
  } = data;

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="font-bold text-2xl">Outreach a Establecimientos</h1>
        <p className="text-default-500 text-sm">
          Charlas educativas y convenios para colegios del Gran Concepción.
        </p>
      </header>

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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <Card.Header>
            <Card.Title>Por estado</Card.Title>
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
            <Card.Title>Por dependencia</Card.Title>
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
            <Card.Title>Por comuna</Card.Title>
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

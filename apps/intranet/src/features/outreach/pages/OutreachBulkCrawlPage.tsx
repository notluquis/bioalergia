import { Button, Card, Checkbox, Chip, ProgressBar } from "@heroui/react";
import { useState } from "react";
import type {
  OutreachProspectSource,
  OutreachProspectType,
} from "@finanzas/orpc-contracts/outreach";
import { SelectInput, TextInput } from "../components/FormField";
import { useBulkCrawl, useBulkCrawlStatus } from "../hooks/useOutreach";

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
  { value: "MANUAL", label: "Manual" },
];

export function OutreachBulkCrawlPage() {
  const [tipo, setTipo] = useState<OutreachProspectType | "">("EMPRESA");
  const [fuente, setFuente] = useState<OutreachProspectSource | "">("");
  const [limit, setLimit] = useState(20);
  const [soloSinEmail, setSoloSinEmail] = useState(true);
  const [soloConWebsite, setSoloConWebsite] = useState(true);
  const [saltarRecientes, setSaltarRecientes] = useState(true);
  const [jobId, setJobId] = useState<string | null>(null);

  const start = useBulkCrawl();
  const status = useBulkCrawlStatus(jobId);

  const launch = async () => {
    const r = await start.mutateAsync({
      tipos: tipo ? [tipo] : undefined,
      fuentes: fuente ? [fuente] : undefined,
      limit,
      soloSinEmail,
      soloConWebsite,
      saltarRecientes,
    });
    setJobId(r.jobId);
  };

  const pct = status.data
    ? Math.round((status.data.progress / Math.max(1, status.data.total)) * 100)
    : 0;
  const isRunning = status.data?.status === "running" || status.data?.status === "pending";

  return (
    <div className="space-y-4 p-6">
      <Card>
        <Card.Header>
          <Card.Title>Filtros</Card.Title>
          <Card.Description>
            Trabajo en background, máx 500 por ejecución. Job expira en 10 min tras completar.
          </Card.Description>
        </Card.Header>
        <Card.Content className="grid grid-cols-1 gap-3 p-4 md:grid-cols-3">
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
          <TextInput
            label="Límite (max 500)"
            type="number"
            min={1}
            max={500}
            value={limit}
            onValueChange={(v) => setLimit(Number.parseInt(v || "20", 10))}
          />
          <Checkbox isSelected={soloSinEmail} onChange={setSoloSinEmail}>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            <Checkbox.Content>Solo sin email</Checkbox.Content>
          </Checkbox>
          <Checkbox isSelected={soloConWebsite} onChange={setSoloConWebsite}>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            <Checkbox.Content>Solo con website</Checkbox.Content>
          </Checkbox>
          <Checkbox isSelected={saltarRecientes} onChange={setSaltarRecientes}>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            <Checkbox.Content>Saltar crawled últimos 7d</Checkbox.Content>
          </Checkbox>
        </Card.Content>
      </Card>

      <Card>
        <Card.Content className="flex items-center gap-3 p-4">
          <Button variant="primary" isDisabled={start.isPending || isRunning} onPress={launch}>
            {start.isPending ? "Iniciando..." : isRunning ? "En curso..." : "Lanzar crawler"}
          </Button>
          {start.isError && (
            <span className="text-danger text-sm">
              {(start.error as Error)?.message ?? "Error"}
            </span>
          )}
        </Card.Content>
      </Card>

      {status.data && (
        <Card>
          <Card.Header>
            <Card.Title>Progreso del job</Card.Title>
            <Card.Description>{status.data.message}</Card.Description>
          </Card.Header>
          <Card.Content className="space-y-3 p-4">
            <div className="flex items-center justify-between text-sm">
              <span>
                {status.data.progress} / {status.data.total} ({pct}%)
              </span>
              <Chip
                size="sm"
                color={
                  status.data.status === "completed"
                    ? "success"
                    : status.data.status === "failed"
                      ? "danger"
                      : "warning"
                }
                variant="soft"
              >
                {status.data.status}
              </Chip>
            </div>
            <ProgressBar
              value={status.data.progress}
              maxValue={Math.max(1, status.data.total)}
              className="w-full"
            >
              <ProgressBar.Track>
                <ProgressBar.Fill />
              </ProgressBar.Track>
            </ProgressBar>
            {status.data.error && <p className="text-danger text-sm">Error: {status.data.error}</p>}
            {status.data.result && (
              <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                <Stat label="Exitosos" value={status.data.result.successful} color="success" />
                <Stat label="Fallidos" value={status.data.result.failed} color="danger" />
                <Stat label="Emails encontrados" value={status.data.result.emailsFound} />
                <Stat label="Teléfonos encontrados" value={status.data.result.phonesFound} />
              </div>
            )}
          </Card.Content>
        </Card>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: "success" | "danger";
}) {
  return (
    <div className="rounded bg-default-100 p-3">
      <p className="text-default-500 text-xs uppercase">{label}</p>
      <p
        className={`font-bold text-xl ${color === "success" ? "text-success" : color === "danger" ? "text-danger" : ""}`}
      >
        {value.toLocaleString("es-CL")}
      </p>
    </div>
  );
}

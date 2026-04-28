import { Button, Chip, ProgressBar } from "@heroui/react";
import { Download } from "lucide-react";
import { useDteXmlJobStatus, useFetchDteXmlByPeriod } from "../hooks/useFetchDteXml";

interface DteXmlJobProgressProps {
  direction: "purchases" | "sales";
  selectedPeriod: string;
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

export function DteXmlJobProgress({ direction, selectedPeriod }: DteXmlJobProgressProps) {
  const fetchXml = useFetchDteXmlByPeriod();
  const jobStatus = useDteXmlJobStatus();
  const job = jobStatus.data;
  const isRunning = jobStatus.isRunning;
  const meta = (job?.meta ?? {}) as Record<string, unknown>;
  const etaSeconds = typeof meta.etaSeconds === "number" ? meta.etaSeconds : null;
  const fetched = typeof meta.fetched === "number" ? meta.fetched : 0;
  const skipped = typeof meta.skipped === "number" ? meta.skipped : 0;
  const errors = typeof meta.errors === "number" ? meta.errors : 0;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        size="sm"
        variant="outline"
        isDisabled={!selectedPeriod || fetchXml.isPending || isRunning}
        onPress={() => fetchXml.mutate({ period: selectedPeriod, direction })}
      >
        <Download size={14} />
        {fetchXml.isPending ? "Iniciando..." : "Obtener XMLs"}
      </Button>

      {isRunning && job ? (
        <div className="flex min-w-48 flex-1 items-center gap-3">
          <ProgressBar value={job.progress} maxValue={job.total || 1} className="flex-1">
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>
          <span className="shrink-0 text-default-500 text-xs">
            {job.progress}/{job.total}
            {etaSeconds != null ? ` · ETA ${formatEta(etaSeconds)}` : ""}
          </span>
        </div>
      ) : null}

      {job?.status === "completed" ? (
        <Chip color="success" size="sm" variant="soft">
          {fetched} obtenidos · {skipped} omitidos
          {errors > 0 ? ` · ${errors} errores` : ""}
        </Chip>
      ) : null}

      {job?.status === "failed" ? (
        <Chip color="danger" size="sm" variant="soft">
          Error: {job.error ?? "desconocido"}
        </Chip>
      ) : null}
    </div>
  );
}

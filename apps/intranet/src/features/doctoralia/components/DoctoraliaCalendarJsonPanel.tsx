import { Alert, Button, Card, Chip, ProgressBar } from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle, FileUp, Loader2, RotateCcw } from "lucide-react";
import { useRef, useState } from "react";

import { useToast } from "@/context/ToastContext";
import { doctoraliaORPCClient, toDoctoraliaApiError } from "../orpc";

type ImportCounts = {
  inserted: number;
  updated: number;
  skipped: number;
};

type ImportSummary = {
  schedules: ImportCounts;
  appointments: ImportCounts;
  workPeriods: ImportCounts;
};

type CalendarJsonEntry = {
  ts?: string;
  src?: string;
  data: {
    schedules: Record<string, unknown>;
    appointments: unknown[];
    workperiods: unknown[];
  };
};

type CalendarJsonFile = {
  name: string;
  size: number;
  entries: CalendarJsonEntry[];
  totals: {
    schedules: number;
    appointments: number;
    workPeriods: number;
  };
};

type ImportResult = {
  fileName: string;
  entriesProcessed: number;
  summary: ImportSummary;
  errors: string[];
};

const CHUNK_SIZE = 10;
const EMPTY_COUNTS: ImportCounts = { inserted: 0, updated: 0, skipped: 0 };

function emptySummary(): ImportSummary {
  return {
    schedules: { ...EMPTY_COUNTS },
    appointments: { ...EMPTY_COUNTS },
    workPeriods: { ...EMPTY_COUNTS },
  };
}

function mergeSummary(a: ImportSummary, b: ImportSummary): ImportSummary {
  const addCounts = (x: ImportCounts, y: ImportCounts): ImportCounts => ({
    inserted: x.inserted + y.inserted,
    updated: x.updated + y.updated,
    skipped: x.skipped + y.skipped,
  });
  return {
    schedules: addCounts(a.schedules, b.schedules),
    appointments: addCounts(a.appointments, b.appointments),
    workPeriods: addCounts(a.workPeriods, b.workPeriods),
  };
}

function parseCalendarJsonFile(file: File): Promise<CalendarJsonFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`No se pudo leer ${file.name}`));
    reader.onload = () => {
      try {
        const text = typeof reader.result === "string" ? reader.result : "";
        const parsed: unknown = JSON.parse(text);
        const rawEntries: unknown = Array.isArray(parsed)
          ? parsed
          : Array.isArray((parsed as { entries?: unknown }).entries)
            ? (parsed as { entries: unknown[] }).entries
            : null;
        if (!rawEntries) {
          throw new Error("El archivo no contiene un arreglo de entradas.");
        }

        const entries: CalendarJsonEntry[] = [];
        let schedules = 0;
        let appointments = 0;
        let workPeriods = 0;

        for (const [index, raw] of (rawEntries as unknown[]).entries()) {
          if (!raw || typeof raw !== "object") {
            throw new Error(`Entrada #${index + 1} inválida (no es objeto).`);
          }
          const entry = raw as {
            ts?: unknown;
            src?: unknown;
            data?: unknown;
          };
          if (!entry.data || typeof entry.data !== "object") {
            throw new Error(`Entrada #${index + 1} sin campo "data".`);
          }
          const data = entry.data as {
            schedules?: unknown;
            appointments?: unknown;
            workperiods?: unknown;
          };
          const schedulesObj =
            data.schedules && typeof data.schedules === "object"
              ? (data.schedules as Record<string, unknown>)
              : {};
          const appointmentsArr = Array.isArray(data.appointments) ? data.appointments : [];
          const workperiodsArr = Array.isArray(data.workperiods) ? data.workperiods : [];

          entries.push({
            ts: typeof entry.ts === "string" ? entry.ts : undefined,
            src: typeof entry.src === "string" ? entry.src : undefined,
            data: {
              schedules: schedulesObj,
              appointments: appointmentsArr,
              workperiods: workperiodsArr,
            },
          });

          schedules += Object.keys(schedulesObj).length;
          appointments += appointmentsArr.length;
          workPeriods += workperiodsArr.length;
        }

        resolve({
          name: file.name,
          size: file.size,
          entries,
          totals: { schedules, appointments, workPeriods },
        });
      } catch (error) {
        reject(error instanceof Error ? error : new Error(`JSON inválido en ${file.name}`));
      }
    };
    reader.readAsText(file);
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DoctoraliaCalendarJsonPanel() {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<CalendarJsonFile[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    fileIndex: number;
    chunkIndex: number;
    totalChunks: number;
  } | null>(null);
  const [results, setResults] = useState<ImportResult[]>([]);

  const importMutation = useMutation({
    mutationFn: async (entries: CalendarJsonEntry[]) =>
      doctoraliaORPCClient.importCalendarJson({ entries }),
  });

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (selected.length === 0) return;

    setParseError(null);
    try {
      const parsed = await Promise.all(selected.map(parseCalendarJsonFile));
      setFiles((prev) => [...prev, ...parsed]);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Error al parsear JSON");
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleReset = () => {
    setFiles([]);
    setResults([]);
    setParseError(null);
    setProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImport = async () => {
    if (files.length === 0) return;
    setResults([]);

    const collected: ImportResult[] = [];
    try {
      for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
        const current = files[fileIndex];
        if (!current) continue;

        const chunks: CalendarJsonEntry[][] = [];
        for (let start = 0; start < current.entries.length; start += CHUNK_SIZE) {
          chunks.push(current.entries.slice(start, start + CHUNK_SIZE));
        }

        let summary = emptySummary();
        const errors: string[] = [];
        let entriesProcessed = 0;

        for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
          const chunk = chunks[chunkIndex] ?? [];
          setProgress({
            fileIndex,
            chunkIndex,
            totalChunks: chunks.length,
          });
          const response = await importMutation.mutateAsync(chunk);
          summary = mergeSummary(summary, response.data.summary);
          entriesProcessed += response.data.entriesProcessed;
          errors.push(...response.data.errors);
        }

        collected.push({
          fileName: current.name,
          entriesProcessed,
          summary,
          errors,
        });
      }
      setResults(collected);
      toast.success("Importación completada", "Doctoralia");
    } catch (error) {
      const apiError = toDoctoraliaApiError(error);
      toast.error(apiError.message, "Importación fallida");
      setResults(collected);
    } finally {
      setProgress(null);
    }
  };

  const totalEntries = files.reduce((sum, f) => sum + f.entries.length, 0);
  const totalAppointments = files.reduce((sum, f) => sum + f.totals.appointments, 0);
  const totalSchedules = files.reduce((sum, f) => sum + f.totals.schedules, 0);
  const totalWorkPeriods = files.reduce((sum, f) => sum + f.totals.workPeriods, 0);
  const isImporting = importMutation.isPending || progress !== null;

  const overallProgressPct = (() => {
    if (!progress) return 0;
    const priorFilesChunks = files
      .slice(0, progress.fileIndex)
      .reduce((sum, f) => sum + Math.max(1, Math.ceil(f.entries.length / CHUNK_SIZE)), 0);
    const totalChunks = files.reduce(
      (sum, f) => sum + Math.max(1, Math.ceil(f.entries.length / CHUNK_SIZE)),
      0
    );
    if (totalChunks === 0) return 0;
    return Math.round(((priorFilesChunks + progress.chunkIndex + 1) / totalChunks) * 100);
  })();

  return (
    <div className="space-y-3">
      <Card className="rounded-xl">
        <Card.Header>
          <Card.Title>Importar calendario Doctoralia (JSON)</Card.Title>
          <Card.Description>
            Sube los archivos JSON descargados desde la consola de Safari. Cada archivo contiene
            entradas semanales (schedules, appointments, workperiods). Los duplicados se detectan
            automáticamente.
          </Card.Description>
        </Card.Header>
        <Card.Content className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              multiple
              onChange={handleFileChange}
              className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground file:text-sm hover:file:bg-primary/90"
              disabled={isImporting}
            />
            {files.length > 0 && (
              <Button variant="outline" size="sm" onPress={handleReset} isDisabled={isImporting}>
                <RotateCcw className="h-3.5 w-3.5" />
                Limpiar
              </Button>
            )}
          </div>

          {parseError && (
            <Alert status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Error al leer archivo</Alert.Title>
                <Alert.Description>{parseError}</Alert.Description>
              </Alert.Content>
            </Alert>
          )}

          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-default-100 bg-default-50 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-sm">{file.name}</p>
                    <p className="text-default-500 text-xs">
                      {file.entries.length} entradas · {formatBytes(file.size)} ·{" "}
                      {file.totals.appointments} citas · {file.totals.schedules} agendas ·{" "}
                      {file.totals.workPeriods} bloques horarios
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() => handleRemoveFile(index)}
                    isDisabled={isImporting}
                  >
                    Quitar
                  </Button>
                </div>
              ))}

              <div className="flex flex-wrap gap-2 pt-1">
                <Chip size="sm" variant="soft">
                  {totalEntries} entradas totales
                </Chip>
                <Chip size="sm" variant="soft" color="accent">
                  {totalAppointments} citas
                </Chip>
                <Chip size="sm" variant="soft">
                  {totalSchedules} agendas
                </Chip>
                <Chip size="sm" variant="soft">
                  {totalWorkPeriods} horarios
                </Chip>
              </div>
            </div>
          )}

          {progress && (
            <div className="space-y-1">
              <p className="text-default-500 text-xs">
                Archivo {progress.fileIndex + 1}/{files.length} · Lote {progress.chunkIndex + 1}/
                {progress.totalChunks}
              </p>
              <ProgressBar aria-label="Progreso importación" value={overallProgressPct}>
                <ProgressBar.Track className="h-2 rounded-full bg-default-100">
                  <ProgressBar.Fill className="bg-primary" />
                </ProgressBar.Track>
              </ProgressBar>
            </div>
          )}

          {files.length > 0 && (
            <div className="flex justify-end">
              <Button onPress={handleImport} isDisabled={isImporting}>
                {isImporting ? (
                  <Loader2 className="mr-2 h-4 w-4" />
                ) : (
                  <FileUp className="mr-2 h-4 w-4" />
                )}
                Importar {totalEntries} entradas
              </Button>
            </div>
          )}
        </Card.Content>
      </Card>

      {results.length > 0 && (
        <Card className="rounded-xl">
          <Card.Header>
            <Card.Title>Resultados</Card.Title>
          </Card.Header>
          <Card.Content className="space-y-3">
            {results.map((result) => (
              <div
                key={result.fileName}
                className="space-y-2 rounded-lg border border-default-100 bg-default-50 p-3"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <p className="font-medium text-sm">{result.fileName}</p>
                  <span className="text-default-500 text-xs">
                    {result.entriesProcessed} entradas procesadas
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <SummaryCell label="Agendas" counts={result.summary.schedules} />
                  <SummaryCell label="Citas" counts={result.summary.appointments} />
                  <SummaryCell label="Horarios" counts={result.summary.workPeriods} />
                </div>

                {result.errors.length > 0 && (
                  <Alert status="warning">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Title>{result.errors.length} entrada(s) con errores</Alert.Title>
                      <Alert.Description>
                        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
                          {result.errors.slice(0, 10).map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                          {result.errors.length > 10 && (
                            <li>… y {result.errors.length - 10} más</li>
                          )}
                        </ul>
                      </Alert.Description>
                    </Alert.Content>
                  </Alert>
                )}
              </div>
            ))}
          </Card.Content>
        </Card>
      )}
    </div>
  );
}

function SummaryCell({ label, counts }: { label: string; counts: ImportCounts }) {
  return (
    <div className="rounded-md border border-default-100 bg-background p-2 text-xs">
      <p className="mb-1 font-medium text-default-700">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        <Chip size="sm" variant="soft" color="success">
          +{counts.inserted}
        </Chip>
        <Chip size="sm" variant="soft" color="accent">
          ↻{counts.updated}
        </Chip>
        <Chip size="sm" variant="soft">
          ={counts.skipped}
        </Chip>
      </div>
    </div>
  );
}

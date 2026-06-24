import { Button, Chip, ProgressBar, Surface } from "@heroui/react";
import { Archive, Cloud, Loader2 } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { OneDriveAccountManager } from "@/features/onedrive/components/OneDriveAccountManager";
import {
  useActiveArchiveJob,
  useCancelArchiveJob,
  useStartArchiveSnapshots,
} from "@/features/onedrive/hooks/useOneDrive";

// Fichas clínicas OneDrive panel. Reuses the shared OneDriveAccountManager
// (account/folder/webhook via the generic /api/orpc/onedrive router) and adds
// the "Archivar XLSX" action scoped to CLINICAL_DOCUMENT, so every ficha xlsx
// gets its first-sheet snapshot stored once and reprocess never re-downloads.
// The scan/auto-ingest of fichas runs through the shared OneDrive discovery
// (triggered alongside the skin-test scan), so there is no separate scan here.

export function ClinicalRecordsOneDrivePanel() {
  const toast = useToast();
  const startArchive = useStartArchiveSnapshots();
  const activeJob = useActiveArchiveJob();
  const cancelJob = useCancelArchiveJob();

  const job = activeJob.data?.job ?? null;
  const isRunning = job?.status === "pending" || job?.status === "running";

  async function handleArchive(force: boolean) {
    try {
      await startArchive.mutateAsync({ classification: "CLINICAL_DOCUMENT", force });
      toast.success(
        force ? "Re-archivado de XLSX iniciado" : "Archivado de XLSX iniciado",
        "Fichas clínicas"
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo iniciar el archivado");
    }
  }

  async function handleCancel() {
    if (!job) return;
    try {
      await cancelJob.mutateAsync(job.id);
      toast.info("Archivado cancelado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cancelar");
    }
  }

  const progressValue =
    job && job.total > 0 ? Math.min(100, Math.round((job.progress / job.total) * 100)) : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <Surface className="rounded-xl p-4">
        <div className="mb-3 flex items-center gap-2">
          <Cloud size={18} className="text-foreground-400" />
          <h3 className="text-sm font-semibold">Cuentas de OneDrive</h3>
        </div>
        <p className="mb-4 text-xs text-foreground-500">
          Conecta y administra las cuentas de OneDrive desde donde se descubren las fichas clínicas.
          La librería de archivos es compartida con tests cutáneos.
        </p>
        <OneDriveAccountManager />
      </Surface>

      <Surface className="rounded-xl p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 space-y-1">
            <h3 className="text-sm font-semibold">Archivar XLSX</h3>
            <p className="text-xs text-foreground-500">
              Descarga cada ficha una sola vez y guarda su snapshot en la base de datos. Luego el
              reprocesamiento lee desde el snapshot, sin volver a descargar de OneDrive.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onPress={() => void handleArchive(false)}
              isDisabled={isRunning || startArchive.isPending}
            >
              <Archive size={14} />
              Archivar faltantes
            </Button>
            <Button
              size="sm"
              variant="outline"
              onPress={() => void handleArchive(true)}
              isDisabled={isRunning || startArchive.isPending}
            >
              <Archive size={14} />
              Re-archivar todo
            </Button>
          </div>
        </div>

        {job && (
          <div className="mt-4 rounded-lg bg-content2 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm">
                {isRunning && <Loader2 size={14} className="animate-spin text-foreground-400" />}
                <span className="font-medium">{job.message}</span>
                <Chip
                  size="sm"
                  variant="soft"
                  color={
                    job.status === "completed"
                      ? "success"
                      : job.status === "failed"
                        ? "danger"
                        : job.status === "cancelled"
                          ? "warning"
                          : "accent"
                  }
                >
                  {job.status}
                </Chip>
              </div>
              {isRunning && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-danger"
                  onPress={() => void handleCancel()}
                  isPending={cancelJob.isPending}
                >
                  Cancelar
                </Button>
              )}
            </div>
            {job.total > 0 && (
              <ProgressBar
                aria-label="Progreso de archivado"
                value={progressValue}
                className="mt-2"
              />
            )}
            {job.result && (
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-foreground-500">
                <span>Procesados: {job.result.processed}</span>
                <span>Archivados: {job.result.archived}</span>
                <span>Errores: {job.result.errors}</span>
              </div>
            )}
          </div>
        )}
      </Surface>
    </div>
  );
}

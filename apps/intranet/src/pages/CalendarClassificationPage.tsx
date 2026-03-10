import { Alert } from "@heroui/react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  classifyCalendarEvent,
  type MissingFieldFilters,
  rebuildClinicalSeries,
  reclassifyAllCalendarEvents,
  reclassifyCalendarEvents,
  syncCalendarEvents,
} from "@/features/calendar/api";
import { CalendarActionModal } from "@/features/calendar/components/CalendarActionModal";
import { ClassificationEmptyState } from "@/features/calendar/components/ClassificationEmptyState";
import { ClassificationFilters } from "@/features/calendar/components/ClassificationFilters";
import { ClassificationPagination } from "@/features/calendar/components/ClassificationPagination";
import { ClassificationRow } from "@/features/calendar/components/ClassificationRow";
import { ClassificationStats } from "@/features/calendar/components/ClassificationStats";
import { ClassificationToolbar } from "@/features/calendar/components/ClassificationToolbar";
import type { FormApiFor } from "@/features/calendar/form-types";
import { calendarQueries, calendarSyncKeys } from "@/features/calendar/queries";
import type { ClassificationEntry, FormValues } from "@/features/calendar/schemas";
import type { CalendarUnclassifiedEvent } from "@/features/calendar/types";
import {
  buildDefaultEntry,
  buildPayload,
  eventKey,
  type ParsedPayload,
} from "@/features/calendar/utils/classification";
import { useJobProgress } from "@/hooks/use-job-progress";
import { toast } from "@/lib/toast-interceptor";

const routeApi = getRouteApi("/_authed/calendar/classify");
import "dayjs/locale/es";

const EMPTY_EVENTS: CalendarUnclassifiedEvent[] = [];
const PAGE_SIZE = 50;
type PendingCalendarAction = "rebuild" | "reclassify-all" | "sync";

function CalendarClassificationPage() {
  const queryClient = useQueryClient();
  const navigate = routeApi.useNavigate();
  const search = routeApi.useSearch();

  const page = search.page ?? 0;
  const filters: MissingFieldFilters = {
    missing: search.missing,
    filterMode: search.filterMode,
  };

  const {
    data,
    error: queryError,
    isFetching: loading,
    refetch,
  } = useSuspenseQuery(calendarQueries.unclassified(page, PAGE_SIZE, filters));

  const { data: optionsData } = useSuspenseQuery(calendarQueries.options());
  const categoryChoices = optionsData?.categories ?? [];
  const missingFieldChoices = optionsData?.missingFilters ?? [];
  const patchReadingChoices = optionsData?.patchReadings ?? [];
  const testSubtypeChoices = optionsData?.testSubtypes ?? [];
  const treatmentStageChoices = optionsData?.treatmentStages ?? [];

  const events = data?.events || EMPTY_EVENTS;
  const totalCount = data?.totalCount || 0;

  const [savingKey, setSavingKey] = useState<null | string>(null);
  const [pendingAction, setPendingAction] = useState<null | PendingCalendarAction>(null);

  const form: FormApiFor<FormValues> = useForm<
    FormValues,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    unknown
  >({
    defaultValues: { entries: [] },
  });

  useEffect(() => {
    if (events.length > 0) {
      form.reset({ entries: events.map((e) => buildDefaultEntry(e)) });
    }
  }, [events, form]);

  const classifyMutation = useMutation({
    mutationFn: (params: { event: CalendarUnclassifiedEvent; payload: ParsedPayload }) => {
      return classifyCalendarEvent({
        amountExpected: params.payload.amountExpected,
        amountPaid: params.payload.amountPaid,
        attended: params.payload.attended,
        calendarId: params.event.calendarId,
        category: params.payload.category,
        dosageValue: params.payload.dosageValue,
        dosageUnit: params.payload.dosageUnit,
        eventId: params.event.eventId,
        testMetadata: params.payload.testMetadata,
        treatmentStage: params.payload.treatmentStage,
      });
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "No se pudo guardar la clasificación";
      toast.error(message);
    },
    onSettled: () => setSavingKey(null),
    onSuccess: () => {
      toast.success("Clasificación actualizada");
      void Promise.all([queryClient.invalidateQueries({ queryKey: ["calendar-unclassified"] })]);
    },
  });

  const reclassifyMutation = useMutation({
    mutationFn: () => reclassifyCalendarEvents(filters),
    onError: (err) =>
      toast.error(`Error: ${err instanceof Error ? err.message : "Error desconocido"}`),
    onSuccess: (response) => {
      setActiveJobId(response.jobId);
      toast.info(
        `Iniciando reclasificación de ${response.totalEvents} eventos (todos los pendientes)...`,
      );
    },
  });

  const reclassifyAllMutation = useMutation({
    mutationFn: reclassifyAllCalendarEvents,
    onError: (err) =>
      toast.error(`Error: ${err instanceof Error ? err.message : "Error desconocido"}`),
    onSuccess: (response) => {
      setActiveJobId(response.jobId);
      toast.info(`Iniciando reclasificación de TODOS los ${response.totalEvents} eventos...`);
    },
  });

  const rebuildMutation = useMutation({
    mutationFn: () => rebuildClinicalSeries(),
    onError: (err) =>
      toast.error(
        `Error al reagrupar: ${err instanceof Error ? err.message : "Error desconocido"}`,
      ),
    onSuccess: (response) => {
      toast.success(
        `✓ Reagrupamiento completado: ${response.processed} series procesadas${
          response.from && response.to ? ` (${response.from} - ${response.to})` : ""
        }`,
      );
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["calendar"] }),
        queryClient.invalidateQueries({ queryKey: ["calendar-unclassified"] }),
      ]);
    },
    onSettled: () => setPendingAction(null),
  });

  const syncMutation = useMutation({
    mutationFn: syncCalendarEvents,
    onError: (err) =>
      toast.error(
        `Error al iniciar sync: ${err instanceof Error ? err.message : "Error desconocido"}`,
      ),
    onSuccess: (response) => {
      toast.info(response.message || "Sincronización iniciada en segundo plano");
      void queryClient.invalidateQueries({ queryKey: calendarSyncKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
      void queryClient.invalidateQueries({ queryKey: ["calendar-unclassified"] });
    },
    onSettled: () => setPendingAction(null),
  });

  const [activeJobId, setActiveJobId] = useState<null | string>(null);
  const { isComplete, isFailed, job, progress } = useJobProgress(activeJobId, {
    onComplete: (result: unknown) => {
      const r = result as {
        fieldCounts?: Record<string, number>;
        message?: string;
        reclassified?: number;
      };
      const details = r.fieldCounts
        ? Object.entries(r.fieldCounts)
            .filter(([, v]) => v > 0)
            .map(([k, v]) => `${k}: ${v}`)
            .join(" | ")
        : "";
      toast.success(
        details
          ? `✓ ${r.reclassified ?? 0} eventos actualizados. ${details}`
          : `✓ ${r.message ?? "Completado"}`,
      );
      setActiveJobId(null);
    },
    onError: (error) => {
      toast.error(`Error: ${error}`);
      setActiveJobId(null);
    },
  });

  const isJobRunning = Boolean(activeJobId) && !isComplete && !isFailed;

  const error = (() => {
    if (queryError instanceof Error) {
      return queryError.message;
    }
    if (queryError) {
      return String(queryError);
    }
    if (classifyMutation.error instanceof Error) {
      return classifyMutation.error.message;
    }
    return null;
  })();

  const handleResetEntry = (index: number, event: CalendarUnclassifiedEvent) => {
    form.setFieldValue(`entries[${index}]`, buildDefaultEntry(event) as ClassificationEntry);
  };

  const handleSave = async (event: CalendarUnclassifiedEvent, index: number) => {
    const key = eventKey(event);
    setSavingKey(key);
    const entry = form.getFieldValue(`entries[${index}]`);
    if (entry) {
      classifyMutation.mutate({ event, payload: buildPayload(entry, event) });
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  type ClassifySearchParams = typeof search;

  const handleSearchChange = (update: Partial<ClassifySearchParams>) => {
    void navigate({
      search: (prev) => ({
        ...prev,
        ...update,
      }),
    });
  };

  const isActionPending =
    reclassifyAllMutation.isPending || rebuildMutation.isPending || syncMutation.isPending;

  const handleConfirmAction = () => {
    if (pendingAction === "reclassify-all") {
      reclassifyAllMutation.mutate();
      return;
    }

    if (pendingAction === "rebuild") {
      rebuildMutation.mutate();
      return;
    }

    if (pendingAction === "sync") {
      syncMutation.mutate();
    }
  };

  return (
    <div className="space-y-6">
      <ClassificationStats events={events} form={form} loading={loading} totalCount={totalCount} />

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-default-200/70 bg-content1 p-4 sm:p-5">
        <ClassificationFilters
          availableFilters={missingFieldChoices}
          filters={filters}
          onSearchChange={handleSearchChange}
        />
        <ClassificationToolbar
          isJobRunning={isJobRunning}
          job={job}
          loading={loading}
          onReclassify={() => reclassifyMutation.mutate()}
          onReclassifyAll={() => setPendingAction("reclassify-all")}
          onRebuild={() => setPendingAction("rebuild")}
          onRefetch={() => void refetch()}
          onSync={() => setPendingAction("sync")}
          progress={progress}
          reclassifyAllPending={reclassifyAllMutation.isPending}
          reclassifyPending={reclassifyMutation.isPending}
          rebuildPending={rebuildMutation.isPending}
          syncPending={syncMutation.isPending}
        />
      </div>

      {error && <Alert status="danger">{error}</Alert>}

      <ClassificationEmptyState error={error} eventsCount={events.length} loading={loading} />

      {events.length > 0 && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {events.map((event, index) => {
            const key = eventKey(event);
            return (
              <ClassificationRow
                categoryChoices={categoryChoices}
                event={event}
                form={form}
                index={index}
                isSaving={savingKey === key}
                key={key}
                onReset={handleResetEntry}
                onSave={handleSave}
                patchReadingChoices={patchReadingChoices}
                testSubtypeChoices={testSubtypeChoices}
                treatmentStageChoices={treatmentStageChoices}
              />
            );
          })}
        </div>
      )}

      <ClassificationPagination
        loading={loading}
        onPageChange={(nextPage) => handleSearchChange({ page: nextPage })}
        page={page}
        pageSize={PAGE_SIZE}
        totalCount={totalCount}
        totalPages={totalPages}
      />

      <CalendarActionModal
        body={
          pendingAction === "sync" ? (
            <div className="space-y-3 rounded-2xl border border-warning-soft-hover bg-warning/5 p-4 text-sm">
              <p className="font-medium text-warning">
                Esta operación lanzará un backfill de calendario.
              </p>
              <ul className="list-disc space-y-1 pl-5 text-default-600">
                <li>Sincroniza eventos desde Google Calendar.</li>
                <li>
                  Rellena campos derivados como <code>dosageValue</code> y <code>dosageUnit</code>.
                </li>
                <li>Corre en segundo plano y puede tardar algunos minutos.</li>
              </ul>
            </div>
          ) : pendingAction === "rebuild" ? (
            <div className="space-y-3 rounded-2xl border border-default-200 bg-default-50/70 p-4 text-sm text-default-600">
              <p>
                Se reagruparán eventos clínicos en series para <strong>tests</strong> y
                <strong> tratamientos subcutáneos</strong>.
              </p>
              <p>Úsalo después del sync si quieres recalcular agrupaciones con datos frescos.</p>
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl border border-danger-soft-hover bg-danger/5 p-4 text-sm text-default-600">
              <p>
                Esta acción sobrescribirá clasificaciones existentes al volver a procesar
                <strong> todos</strong> los eventos.
              </p>
            </div>
          )
        }
        confirmLabel={
          pendingAction === "sync"
            ? "Iniciar sync"
            : pendingAction === "rebuild"
              ? "Reagrupar series"
              : "Reclasificar todo"
        }
        description={
          pendingAction === "sync"
            ? "Se iniciará una sincronización en segundo plano para actualizar eventos históricos."
            : pendingAction === "rebuild"
              ? "Se reconstruirán las series clínicas a partir de los eventos actuales."
              : "Esta operación es masiva y puede cambiar datos ya clasificados."
        }
        isOpen={pendingAction !== null}
        isPending={isActionPending}
        onClose={() => setPendingAction(null)}
        onConfirm={handleConfirmAction}
        title={
          pendingAction === "sync"
            ? "Sincronizar calendario"
            : pendingAction === "rebuild"
              ? "Reagrupar series clínicas"
              : "Reclasificar todos los eventos"
        }
      />
    </div>
  );
}
export { CalendarClassificationPage };

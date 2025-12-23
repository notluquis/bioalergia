import { useCallback, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import "dayjs/locale/es";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as Tooltip from "@radix-ui/react-tooltip";
import * as Toast from "@radix-ui/react-toast";

import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import {
  classifyCalendarEvent,
  fetchUnclassifiedCalendarEvents,
  reclassifyCalendarEvents,
  reclassifyAllCalendarEvents,
  fetchClassificationOptions,
  type MissingFieldFilters,
} from "@/features/calendar/api";
import type { CalendarUnclassifiedEvent } from "@/features/calendar/types";
import { classificationArraySchema, type FormValues, classificationSchema } from "@/features/calendar/schemas";
import { ClassificationRow } from "@/features/calendar/components/ClassificationRow";
import { ClassificationTotals } from "@/features/calendar/components/ClassificationTotals";
import { useJobProgress } from "@/hooks/useJobProgress";
import { z } from "zod";

dayjs.locale("es");

const EMPTY_EVENTS: CalendarUnclassifiedEvent[] = [];

type ParsedPayload = {
  category: string | null;
  amountExpected: number | null;
  amountPaid: number | null;
  attended: boolean | null;
  dosage: string | null;
  treatmentStage: string | null;
};

function eventKey(event: Pick<CalendarUnclassifiedEvent, "calendarId" | "eventId">) {
  return `${event.calendarId}:::${event.eventId}`;
}

function parseAmountInput(value: string | null | undefined): number | null {
  if (!value) return null;
  const normalized = value.replace(/[^0-9]/g, "");
  if (!normalized.length) return null;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function buildDefaultEntry(event: CalendarUnclassifiedEvent) {
  return {
    category: event.category ?? "",
    amountExpected: event.amountExpected != null ? String(event.amountExpected) : "",
    amountPaid: event.amountPaid != null ? String(event.amountPaid) : "",
    attended: event.attended ?? false,
    dosage: event.dosage ?? "",
    treatmentStage: event.treatmentStage ?? "",
  };
}

function buildPayload(entry: z.infer<typeof classificationSchema>, event: CalendarUnclassifiedEvent): ParsedPayload {
  const category = entry.category?.trim() || null;
  const resolvedCategory = category ?? event.category ?? null;
  const amountExpected = parseAmountInput(entry.amountExpected) ?? event.amountExpected ?? null;
  const amountPaid = parseAmountInput(entry.amountPaid) ?? event.amountPaid ?? null;
  const attended = entry.attended ?? event.attended ?? null;
  const dosage = entry.dosage?.trim() ? entry.dosage.trim() : null;
  const treatmentStage =
    resolvedCategory === "Tratamiento subcutáneo" && entry.treatmentStage?.trim() ? entry.treatmentStage.trim() : null;

  return {
    category: resolvedCategory,
    amountExpected,
    amountPaid,
    attended,
    dosage,
    treatmentStage,
  };
}

function CalendarClassificationPage() {
  const PAGE_SIZE = 50;
  const queryClient = useQueryClient();

  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<MissingFieldFilters>({});

  const {
    data,
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ["calendar-unclassified", page, PAGE_SIZE, filters],
    queryFn: () => fetchUnclassifiedCalendarEvents(PAGE_SIZE, page * PAGE_SIZE, filters),
  });

  // Fetch classification options from backend (single source of truth)
  const { data: optionsData } = useQuery({
    queryKey: ["classification-options"],
    queryFn: fetchClassificationOptions,
    staleTime: 1000 * 60 * 60, // Cache for 1 hour - options rarely change
  });

  const categoryChoices = optionsData?.categories ?? [];
  const treatmentStageChoices = optionsData?.treatmentStages ?? [];

  const events = data?.events || EMPTY_EVENTS;
  const totalCount = data?.totalCount || 0;

  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastOpen, setToastOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(classificationArraySchema),
    defaultValues: { entries: [] },
    mode: "onChange",
  });

  const { control, reset, getValues, setValue } = form;
  const { fields } = useFieldArray({ control, name: "entries" });

  // Sync form with data
  useEffect(() => {
    if (events) {
      reset({ entries: events.map(buildDefaultEntry) });
    }
  }, [events, reset]);

  const classifyMutation = useMutation({
    mutationFn: (params: { event: CalendarUnclassifiedEvent; payload: ParsedPayload }) => {
      return classifyCalendarEvent({
        calendarId: params.event.calendarId,
        eventId: params.event.eventId,
        category: params.payload.category,
        amountExpected: params.payload.amountExpected,
        amountPaid: params.payload.amountPaid,
        attended: params.payload.attended,
        dosage: params.payload.dosage,
        treatmentStage: params.payload.treatmentStage,
      });
    },
    onSuccess: () => {
      setToastMessage("Clasificación actualizada");
      setToastOpen(true);
      queryClient.invalidateQueries({ queryKey: ["calendar-unclassified"] });
      setSavingKey(null);
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "No se pudo guardar la clasificación";
      setToastMessage(message);
    },
    onSettled: () => {
      setSavingKey(null);
    },
  });

  const reclassifyMutation = useMutation({
    mutationFn: reclassifyCalendarEvents,
    onSuccess: (response) => {
      setActiveJobId(response.jobId);
      setToastMessage(`Iniciando reclasificación de ${response.totalEvents} eventos...`);
      setToastOpen(true);
    },
    onError: (err) => {
      setToastMessage(`Error: ${err instanceof Error ? err.message : "Error desconocido"}`);
      setToastOpen(true);
    },
  });

  const reclassifyAllMutation = useMutation({
    mutationFn: reclassifyAllCalendarEvents,
    onSuccess: (response) => {
      setActiveJobId(response.jobId);
      setToastMessage(`Iniciando reclasificación de TODOS los ${response.totalEvents} eventos...`);
      setToastOpen(true);
    },
    onError: (err) => {
      setToastMessage(`Error: ${err instanceof Error ? err.message : "Error desconocido"}`);
      setToastOpen(true);
    },
  });

  // Track active job progress
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const { job, progress, isComplete, isFailed } = useJobProgress(activeJobId, {
    onComplete: (result) => {
      const r = result as { message?: string; reclassified?: number; fieldCounts?: Record<string, number> };
      const details = r.fieldCounts
        ? Object.entries(r.fieldCounts)
            .filter(([, v]) => v > 0)
            .map(([k, v]) => `${k}: ${v}`)
            .join(" | ")
        : "";
      const msg = details
        ? `✓ ${r.reclassified ?? 0} eventos actualizados. ${details}`
        : `✓ ${r.message ?? "Completado"}`;
      setToastMessage(msg);
      setToastOpen(true);
      setActiveJobId(null);
    },
    onError: (error) => {
      setToastMessage(`Error: ${error}`);
      setToastOpen(true);
      setActiveJobId(null);
    },
  });

  const isJobRunning = !!activeJobId && !isComplete && !isFailed;

  const { mutate } = classifyMutation;

  const error =
    queryError instanceof Error
      ? queryError.message
      : queryError
        ? String(queryError)
        : classifyMutation.error instanceof Error
          ? classifyMutation.error.message
          : null;

  const handleResetEntry = useCallback(
    (index: number, event: CalendarUnclassifiedEvent) => {
      setValue(`entries.${index}`, buildDefaultEntry(event), { shouldDirty: true });
    },
    [setValue]
  );

  const handleSave = useCallback(
    async (event: CalendarUnclassifiedEvent, index: number) => {
      const key = eventKey(event);
      setSavingKey(key);
      const values = getValues(`entries.${index}` as const);
      const payload = buildPayload(values, event);
      mutate({ event, payload });
    },
    [getValues, mutate]
  );

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const hasActiveFilters = Object.values(filters).some(Boolean);

  return (
    <Toast.Provider swipeDirection="right">
      <Tooltip.Provider delayDuration={200}>
        <div className="space-y-8">
          {/* Header */}
          <header className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Clasificar eventos</h1>
                <p className="text-base-content/60 text-sm">Revisa y clasifica eventos pendientes</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void refetch()}
                  disabled={loading}
                  className="btn btn-sm btn-ghost gap-2"
                >
                  <svg
                    className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  {loading ? "Cargando..." : "Actualizar"}
                </button>
              </div>
            </div>
          </header>

          {/* Stats Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="from-primary/10 to-primary/5 ring-primary/20 rounded-2xl bg-linear-to-br p-5 ring-1">
              <div className="text-primary/70 text-xs font-medium tracking-wide uppercase">Pendientes</div>
              <div className="text-primary mt-1 text-3xl font-bold tabular-nums">
                {loading ? "—" : totalCount.toLocaleString("es-CL")}
              </div>
            </div>
            <div className="from-success/10 to-success/5 ring-success/20 rounded-2xl bg-linear-to-br p-5 ring-1">
              <div className="text-success/70 text-xs font-medium tracking-wide uppercase">Página actual</div>
              <div className="text-success mt-1 text-3xl font-bold tabular-nums">{loading ? "—" : events.length}</div>
            </div>
            <ClassificationTotals control={control} events={events} />
          </div>

          {/* Actions Bar */}
          <div className="bg-base-200/50 flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4 backdrop-blur-sm">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-base-content/50 text-xs font-medium tracking-wide uppercase">Filtrar:</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFilters((prev) => ({ ...prev, missingCategory: !prev.missingCategory || undefined }));
                    setPage(0);
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                    filters.missingCategory
                      ? "bg-primary text-primary-content shadow-sm"
                      : "bg-base-300/50 text-base-content/70 hover:bg-base-300"
                  }`}
                >
                  Sin categoría
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilters((prev) => ({ ...prev, missingAmount: !prev.missingAmount || undefined }));
                    setPage(0);
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                    filters.missingAmount
                      ? "bg-primary text-primary-content shadow-sm"
                      : "bg-base-300/50 text-base-content/70 hover:bg-base-300"
                  }`}
                >
                  Sin monto
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilters((prev) => ({ ...prev, missingAttended: !prev.missingAttended || undefined }));
                    setPage(0);
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                    filters.missingAttended
                      ? "bg-primary text-primary-content shadow-sm"
                      : "bg-base-300/50 text-base-content/70 hover:bg-base-300"
                  }`}
                >
                  Sin asistencia
                </button>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilters({});
                      setPage(0);
                    }}
                    className="text-error/80 hover:text-error flex items-center gap-1 px-2 py-1.5 text-xs font-medium transition-colors"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            {/* Reclassify Actions */}
            <div className="flex flex-col gap-3">
              {/* Progress Bar - Show when job is running */}
              {isJobRunning && job && (
                <div className="bg-base-300/50 rounded-xl p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">{job.message}</span>
                    <span className="text-primary text-sm font-bold tabular-nums">{progress}%</span>
                  </div>
                  <div className="bg-base-200 h-2.5 w-full overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-2.5 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="text-base-content/60 mt-2 text-xs">
                    {job.progress.toLocaleString("es-CL")} / {job.total.toLocaleString("es-CL")} eventos
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => reclassifyMutation.mutate()}
                  disabled={reclassifyMutation.isPending || isJobRunning}
                  className="gap-2"
                >
                  <svg
                    className={`h-4 w-4 ${isJobRunning ? "animate-spin" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                  {isJobRunning ? `Procesando ${progress}%...` : "Reclasificar pendientes"}
                </Button>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            "¿Reclasificar TODOS los eventos? Esto sobrescribirá las clasificaciones existentes."
                          )
                        ) {
                          reclassifyAllMutation.mutate();
                        }
                      }}
                      disabled={reclassifyAllMutation.isPending || isJobRunning}
                      className="text-warning/80 hover:text-warning hover:bg-warning/10 rounded-lg p-2 transition-colors disabled:opacity-50"
                    >
                      <svg
                        className={`h-5 w-5 ${isJobRunning ? "animate-spin" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Content className="bg-base-300 rounded-lg px-3 py-2 text-xs shadow-xl" side="bottom">
                    Reclasificar TODO (sobrescribe existentes)
                    <Tooltip.Arrow className="fill-base-300" />
                  </Tooltip.Content>
                </Tooltip.Root>
              </div>
            </div>
          </div>

          {/* Error Alert */}
          {error && <Alert variant="error">{error}</Alert>}

          {/* Empty State */}
          {!loading && events.length === 0 && !error && (
            <div className="bg-success/5 ring-success/20 flex flex-col items-center justify-center rounded-2xl py-16 ring-1">
              <div className="bg-success/10 mb-4 rounded-full p-4">
                <svg className="text-success h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-success text-lg font-semibold">¡Todo clasificado!</h3>
              <p className="text-base-content/60 mt-1 text-sm">No hay eventos pendientes de clasificar.</p>
            </div>
          )}

          {/* Events List */}
          {events.length > 0 && (
            <div className="space-y-3">
              {fields.map((field, index) => {
                const event = events[index];
                if (!event) return null;
                const key = eventKey(event);

                return (
                  <ClassificationRow
                    key={field.id}
                    index={index}
                    event={event}
                    control={control}
                    isSaving={savingKey === key}
                    onSave={handleSave}
                    onReset={handleResetEntry}
                    initialValues={null}
                    categoryChoices={categoryChoices}
                    treatmentStageChoices={treatmentStageChoices}
                  />
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalCount > PAGE_SIZE && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                type="button"
                onClick={() => setPage(0)}
                disabled={page === 0 || loading}
                className="btn btn-sm btn-ghost disabled:opacity-30"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || loading}
                className="btn btn-sm btn-ghost disabled:opacity-30"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="bg-base-200 flex items-center gap-2 rounded-lg px-4 py-2 text-sm">
                <span className="text-base-content/60">Página</span>
                <span className="text-base-content font-semibold tabular-nums">{page + 1}</span>
                <span className="text-base-content/60">de {totalPages}</span>
              </div>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={(page + 1) * PAGE_SIZE >= totalCount || loading}
                className="btn btn-sm btn-ghost disabled:opacity-30"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setPage(totalPages - 1)}
                disabled={(page + 1) * PAGE_SIZE >= totalCount || loading}
                className="btn btn-sm btn-ghost disabled:opacity-30"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </Tooltip.Provider>
      <Toast.Root
        className="bg-base-300 text-base-content data-[state=open]:animate-slideIn data-[state=closed]:animate-hide rounded-xl px-4 py-3 text-sm shadow-xl"
        open={toastOpen && Boolean(toastMessage)}
        onOpenChange={setToastOpen}
      >
        <Toast.Title className="font-semibold">Operación completada</Toast.Title>
        <Toast.Description className="text-base-content/70 mt-1 text-xs">{toastMessage}</Toast.Description>
      </Toast.Root>
      <Toast.Viewport className="fixed right-4 bottom-4 z-50 flex flex-col gap-2" />
    </Toast.Provider>
  );
}

export default CalendarClassificationPage;

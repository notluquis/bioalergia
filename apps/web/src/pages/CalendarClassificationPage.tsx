import * as Toast from "@radix-ui/react-toast";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useState } from "react";

import type { CalendarUnclassifiedEvent } from "@/features/calendar/types";

import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import {
  classifyCalendarEvent,
  type MissingFieldFilters,
  reclassifyAllCalendarEvents,
  reclassifyCalendarEvents,
} from "@/features/calendar/api";
import { ClassificationRow } from "@/features/calendar/components/ClassificationRow";
import { ClassificationTotals } from "@/features/calendar/components/ClassificationTotals";
import { calendarQueries } from "@/features/calendar/queries";
import { type ClassificationEntry, type FormValues } from "@/features/calendar/schemas";
import {
  buildDefaultEntry,
  buildPayload,
  eventKey,
  type ParsedPayload,
} from "@/features/calendar/utils/classification";
import { useJobProgress } from "@/hooks/useJobProgress";

import "dayjs/locale/es";

dayjs.locale("es");

const EMPTY_EVENTS: CalendarUnclassifiedEvent[] = [];

const ACTIVE_FILTER_CLASS = "bg-primary text-primary-content shadow-sm";
const INACTIVE_FILTER_CLASS = "bg-base-300/50 text-base-content/70 hover:bg-base-300";

function CalendarClassificationPage() {
  const PAGE_SIZE = 50;
  const queryClient = useQueryClient();

  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<MissingFieldFilters>({});

  const {
    data,
    error: queryError,
    isFetching: loading,
    refetch,
  } = useSuspenseQuery(calendarQueries.unclassified(page, PAGE_SIZE, filters));

  // Fetch classification options from backend (single source of truth)
  const { data: optionsData } = useSuspenseQuery(calendarQueries.options());

  const categoryChoices = optionsData?.categories ?? [];
  const treatmentStageChoices = optionsData?.treatmentStages ?? [];

  const events = data?.events || EMPTY_EVENTS;
  const totalCount = data?.totalCount || 0;

  const [savingKey, setSavingKey] = useState<null | string>(null);
  const [toastMessage, setToastMessage] = useState<null | string>(null);
  const [toastOpen, setToastOpen] = useState(false);

  // TanStack Form for array of classification entries
  const form = useForm({
    defaultValues: { entries: [] } as FormValues,
  });

  // Sync form with data when events change
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
        dosage: params.payload.dosage,
        eventId: params.event.eventId,
        treatmentStage: params.payload.treatmentStage,
      });
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "No se pudo guardar la clasificación";
      setToastMessage(message);
    },
    onSettled: () => {
      setSavingKey(null);
    },
    onSuccess: () => {
      setToastMessage("Clasificación actualizada");
      setToastOpen(true);
      queryClient.invalidateQueries({ queryKey: ["calendar-unclassified"] });
      setSavingKey(null);
    },
  });

  const reclassifyMutation = useMutation({
    mutationFn: reclassifyCalendarEvents,
    onError: (err) => {
      setToastMessage(`Error: ${err instanceof Error ? err.message : "Error desconocido"}`);
      setToastOpen(true);
    },
    onSuccess: (response) => {
      setActiveJobId(response.jobId);
      setToastMessage(`Iniciando reclasificación de ${response.totalEvents} eventos...`);
      setToastOpen(true);
    },
  });

  const reclassifyAllMutation = useMutation({
    mutationFn: reclassifyAllCalendarEvents,
    onError: (err) => {
      setToastMessage(`Error: ${err instanceof Error ? err.message : "Error desconocido"}`);
      setToastOpen(true);
    },
    onSuccess: (response) => {
      setActiveJobId(response.jobId);
      setToastMessage(`Iniciando reclasificación de TODOS los ${response.totalEvents} eventos...`);
      setToastOpen(true);
    },
  });

  // Track active job progress
  const [activeJobId, setActiveJobId] = useState<null | string>(null);
  const { isComplete, isFailed, job, progress } = useJobProgress(activeJobId, {
    onComplete: (result) => {
      const r = result as { fieldCounts?: Record<string, number>; message?: string; reclassified?: number };
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

  const error = (() => {
    if (queryError instanceof Error) return queryError.message;
    if (queryError) return String(queryError);
    if (classifyMutation.error instanceof Error) return classifyMutation.error.message;
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
      const payload = buildPayload(entry, event);
      mutate({ event, payload });
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const hasActiveFilters = Object.values(filters).some(Boolean);

  return (
    <Toast.Provider swipeDirection="right">
      <Tooltip.Provider delayDuration={200}>
        <div className="space-y-8">
          {/* Stats Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Pendientes" tone="primary" value={loading ? "—" : totalCount.toLocaleString("es-CL")} />
            <StatCard title="Página actual" tone="success" value={loading ? "—" : events.length} />
            <ClassificationTotals events={events} form={form} />
          </div>

          {/* Actions Bar */}
          <div className="bg-base-200/50 flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4 backdrop-blur-sm">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-base-content/50 text-xs font-medium tracking-wide uppercase">Filtrar:</span>
              <div className="flex flex-wrap gap-2">
                <button
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                    filters.missingCategory ? ACTIVE_FILTER_CLASS : INACTIVE_FILTER_CLASS
                  }`}
                  onClick={() => {
                    setFilters((prev) => ({ ...prev, missingCategory: !prev.missingCategory || undefined }));
                    setPage(0);
                  }}
                  type="button"
                >
                  Sin categoría
                </button>
                <button
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                    filters.missingAmount ? ACTIVE_FILTER_CLASS : INACTIVE_FILTER_CLASS
                  }`}
                  onClick={() => {
                    setFilters((prev) => ({ ...prev, missingAmount: !prev.missingAmount || undefined }));
                    setPage(0);
                  }}
                  type="button"
                >
                  Sin monto
                </button>
                <button
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                    filters.missingAttended
                      ? "bg-primary text-primary-content shadow-sm"
                      : "bg-base-300/50 text-base-content/70 hover:bg-base-300"
                  }`}
                  onClick={() => {
                    setFilters((prev) => ({ ...prev, missingAttended: !prev.missingAttended || undefined }));
                    setPage(0);
                  }}
                  type="button"
                >
                  Sin asistencia
                </button>
                <button
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                    filters.missingDosage
                      ? "bg-primary text-primary-content shadow-sm"
                      : "bg-base-300/50 text-base-content/70 hover:bg-base-300"
                  }`}
                  onClick={() => {
                    setFilters((prev) => ({ ...prev, missingDosage: !prev.missingDosage || undefined }));
                    setPage(0);
                  }}
                  type="button"
                >
                  Sin dosis
                </button>
                <button
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                    filters.missingTreatmentStage
                      ? "bg-primary text-primary-content shadow-sm"
                      : "bg-base-300/50 text-base-content/70 hover:bg-base-300"
                  }`}
                  onClick={() => {
                    setFilters((prev) => ({
                      ...prev,
                      missingTreatmentStage: !prev.missingTreatmentStage || undefined,
                    }));
                    setPage(0);
                  }}
                  type="button"
                >
                  Sin etapa
                </button>
                {hasActiveFilters && (
                  <>
                    {/* Filter Mode Toggle */}
                    <div className="border-base-300/50 flex items-center gap-1 border-l pl-3">
                      <span className="text-base-content/40 mr-1 text-xs">Coincide:</span>
                      <button
                        className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                          !filters.filterMode || filters.filterMode === "OR"
                            ? "bg-secondary text-secondary-content shadow-sm"
                            : "text-base-content/60 hover:text-base-content bg-transparent"
                        }`}
                        onClick={() => {
                          setFilters((prev) => ({ ...prev, filterMode: undefined }));
                          setPage(0);
                        }}
                        type="button"
                      >
                        Cualquiera
                      </button>
                      <button
                        className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                          filters.filterMode === "AND"
                            ? "bg-secondary text-secondary-content shadow-sm"
                            : "text-base-content/60 hover:text-base-content bg-transparent"
                        }`}
                        onClick={() => {
                          setFilters((prev) => ({ ...prev, filterMode: "AND" }));
                          setPage(0);
                        }}
                        type="button"
                      >
                        Todos
                      </button>
                    </div>
                    <button
                      className="text-error/80 hover:text-error flex items-center gap-1 px-2 py-1.5 text-xs font-medium transition-colors"
                      onClick={() => {
                        setFilters({});
                        setPage(0);
                      }}
                      type="button"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                      </svg>
                      Limpiar
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Reclassify Actions */}
            <div className="flex items-center gap-3">
              {/* Refresh Button - Moved here */}
              <button
                className="btn btn-ghost btn-sm text-base-content/70 gap-2"
                disabled={loading}
                onClick={() => void refetch()}
                title="Actualizar lista"
                type="button"
              >
                <svg
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
                <span className="hidden sm:inline">{loading ? "Cargando..." : "Actualizar"}</span>
              </button>

              {/* Action Buttons */}
              <Button
                className="relative gap-2 overflow-hidden"
                disabled={reclassifyMutation.isPending || isJobRunning}
                onClick={() => {
                  reclassifyMutation.mutate();
                }}
                type="button"
                variant="secondary"
              >
                {/* Progress overlay inside button */}
                {isJobRunning && (
                  <div
                    className="bg-primary/20 absolute inset-0 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  {isJobRunning ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                        />
                      </svg>
                      <span className="tabular-nums">{progress}%</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                        />
                      </svg>
                      Reclasificar pendientes
                    </>
                  )}
                </span>
              </Button>

              {/* Progress info pill - only when running */}
              {isJobRunning && job && (
                <div className="bg-primary/10 border-primary/20 flex items-center gap-2 rounded-full border px-3 py-1.5">
                  <span className="text-primary/80 text-xs font-medium">{job.message}</span>
                  <span className="text-primary text-xs font-bold tabular-nums">
                    {job.progress.toLocaleString("es-CL")}/{job.total.toLocaleString("es-CL")}
                  </span>
                </div>
              )}

              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <button
                    className="text-warning/80 hover:text-warning hover:bg-warning/10 rounded-lg p-2 transition-colors disabled:opacity-50"
                    disabled={reclassifyAllMutation.isPending || isJobRunning}
                    onClick={() => {
                      if (
                        globalThis.confirm(
                          "¿Reclasificar TODOS los eventos? Esto sobrescribirá las clasificaciones existentes."
                        )
                      ) {
                        reclassifyAllMutation.mutate();
                      }
                    }}
                    type="button"
                  >
                    <svg
                      className={`h-5 w-5 ${isJobRunning ? "animate-spin" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
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

          {/* Error Alert */}
          {error && <Alert variant="error">{error}</Alert>}

          {/* Empty State */}
          {!loading && events.length === 0 && !error && (
            <div className="bg-success/5 ring-success/20 flex flex-col items-center justify-center rounded-2xl py-16 ring-1">
              <div className="bg-success/10 mb-4 rounded-full p-4">
                <svg className="text-success h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                </svg>
              </div>
              <h3 className="text-success text-lg font-semibold">¡Todo clasificado!</h3>
              <p className="text-base-content/60 mt-1 text-sm">No hay eventos pendientes de clasificar.</p>
            </div>
          )}

          {/* Events List */}
          {events.length > 0 && (
            <div className="space-y-3">
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
                className="btn btn-sm btn-ghost disabled:opacity-30"
                disabled={page === 0 || loading}
                onClick={() => {
                  setPage(0);
                }}
                type="button"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
              </button>
              <button
                className="btn btn-sm btn-ghost disabled:opacity-30"
                disabled={page === 0 || loading}
                onClick={() => {
                  setPage((p) => Math.max(0, p - 1));
                }}
                type="button"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                </svg>
              </button>
              <div className="bg-base-200 flex items-center gap-2 rounded-lg px-4 py-2 text-sm">
                <span className="text-base-content/60">Página</span>
                <span className="text-base-content font-semibold tabular-nums">{page + 1}</span>
                <span className="text-base-content/60">de {totalPages}</span>
              </div>
              <button
                className="btn btn-sm btn-ghost disabled:opacity-30"
                disabled={(page + 1) * PAGE_SIZE >= totalCount || loading}
                onClick={() => {
                  setPage((p) => p + 1);
                }}
                type="button"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                </svg>
              </button>
              <button
                className="btn btn-sm btn-ghost disabled:opacity-30"
                disabled={(page + 1) * PAGE_SIZE >= totalCount || loading}
                onClick={() => {
                  setPage(totalPages - 1);
                }}
                type="button"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M13 5l7 7-7 7M5 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                </svg>
              </button>
            </div>
          )}
        </div>
      </Tooltip.Provider>
      <Toast.Root
        className="bg-base-300 text-base-content data-[state=open]:animate-slideIn data-[state=closed]:animate-hide rounded-xl px-4 py-3 text-sm shadow-xl"
        onOpenChange={setToastOpen}
        open={toastOpen && Boolean(toastMessage)}
      >
        <Toast.Title className="font-semibold">Operación completada</Toast.Title>
        <Toast.Description className="text-base-content/70 mt-1 text-xs">{toastMessage}</Toast.Description>
      </Toast.Root>
      <Toast.Viewport className="fixed right-4 bottom-4 z-50 flex flex-col gap-2" />
    </Toast.Provider>
  );
}

export default CalendarClassificationPage;

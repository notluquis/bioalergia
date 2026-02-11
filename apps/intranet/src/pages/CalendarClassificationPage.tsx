import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import {
  classifyCalendarEvent,
  type MissingFieldFilters,
  reclassifyAllCalendarEvents,
  reclassifyCalendarEvents,
} from "@/features/calendar/api";
import { ClassificationEmptyState } from "@/features/calendar/components/ClassificationEmptyState";
import { ClassificationFilters } from "@/features/calendar/components/ClassificationFilters";
import { ClassificationPagination } from "@/features/calendar/components/ClassificationPagination";
import { ClassificationRow } from "@/features/calendar/components/ClassificationRow";
import { ClassificationStats } from "@/features/calendar/components/ClassificationStats";
import { ClassificationToolbar } from "@/features/calendar/components/ClassificationToolbar";
import type { FormApiFor } from "@/features/calendar/form-types";
import { calendarQueries } from "@/features/calendar/queries";
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

function CalendarClassificationPage() {
  const queryClient = useQueryClient();
  const navigate = routeApi.useNavigate();
  const search = routeApi.useSearch();

  const page = search.page ?? 0;
  const filters: MissingFieldFilters = {
    missingCategory: search.missingCategory,
    missingAmount: search.missingAmount,
    missingAttended: search.missingAttended,
    missingDosage: search.missingDosage,
    missingTreatmentStage: search.missingTreatmentStage,
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
  const treatmentStageChoices = optionsData?.treatmentStages ?? [];

  const events = data?.events || EMPTY_EVENTS;
  const totalCount = data?.totalCount || 0;

  const [savingKey, setSavingKey] = useState<null | string>(null);

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
      queryClient.invalidateQueries({ queryKey: ["calendar-unclassified"] });
    },
  });

  const reclassifyMutation = useMutation({
    mutationFn: reclassifyCalendarEvents,
    onError: (err) =>
      toast.error(`Error: ${err instanceof Error ? err.message : "Error desconocido"}`),
    onSuccess: (response) => {
      setActiveJobId(response.jobId);
      toast.info(`Iniciando reclasificación de ${response.totalEvents} eventos...`);
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

  return (
    <div className="space-y-6">
      <ClassificationStats events={events} form={form} loading={loading} totalCount={totalCount} />

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-default-200/70 bg-content1 p-4 sm:p-5">
        <ClassificationFilters filters={filters} onSearchChange={handleSearchChange} />
        <ClassificationToolbar
          isJobRunning={isJobRunning}
          job={job}
          loading={loading}
          onReclassify={() => reclassifyMutation.mutate()}
          onReclassifyAll={() => {
            if (
              globalThis.confirm(
                "¿Reclasificar TODOS los eventos? Esto sobrescribirá las clasificaciones existentes.",
              )
            ) {
              reclassifyAllMutation.mutate();
            }
          }}
          onRefetch={() => void refetch()}
          progress={progress}
          reclassifyAllPending={reclassifyAllMutation.isPending}
          reclassifyPending={reclassifyMutation.isPending}
        />
      </div>

      {error && <Alert variant="error">{error}</Alert>}

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
    </div>
  );
}
export { CalendarClassificationPage };

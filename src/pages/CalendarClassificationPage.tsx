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
  type MissingFieldFilters,
} from "@/features/calendar/api";
import type { CalendarUnclassifiedEvent } from "@/features/calendar/types";
import { TITLE_LG, SPACE_Y_TIGHT } from "@/lib/styles";
import { classificationArraySchema, type FormValues, classificationSchema } from "@/features/calendar/schemas";
import { ClassificationRow } from "@/features/calendar/components/ClassificationRow";
import { ClassificationTotals } from "@/features/calendar/components/ClassificationTotals";
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
    onSuccess: (result) => {
      setToastMessage(`✓ ${result.message}`);
      setToastOpen(true);
      void queryClient.invalidateQueries({ queryKey: ["calendar-unclassified"] });
    },
    onError: (err) => {
      setToastMessage(`Error: ${err instanceof Error ? err.message : "Error desconocido"}`);
      setToastOpen(true);
    },
  });

  const { mutate } = classifyMutation;

  const error =
    queryError instanceof Error
      ? queryError.message
      : queryError
        ? String(queryError)
        : classifyMutation.error instanceof Error
          ? classifyMutation.error.message
          : null;

  const pendingCount = totalCount;

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

  return (
    <Toast.Provider swipeDirection="right">
      <Tooltip.Provider delayDuration={200}>
        <section className="space-y-6">
          <header className={SPACE_Y_TIGHT}>
            <h1 className={TITLE_LG}>Clasificar eventos</h1>
            <p className="text-base-content/70 text-sm">
              Revisa los eventos que no pudieron clasificarse automáticamente. Asigna la categoría correcta, confirma
              montos y marca si la persona asistió.
            </p>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <span className="text-base-content/60 inline-flex cursor-help items-center gap-1 text-xs">
                  ¿Cómo se clasifica?
                  <span className="border-base-300 bg-base-100 text-base-content/60 inline-flex h-4 w-4 items-center justify-center rounded-full border text-xs">
                    i
                  </span>
                </span>
              </Tooltip.Trigger>
              <Tooltip.Content
                className="bg-base-300 text-base-content rounded-md px-3 py-2 text-xs shadow-lg"
                side="bottom"
                align="start"
              >
                Usa &quot;Tratamiento subcutáneo&quot; para vacunas (vac, clustoid) y otros tratamientos.
                <Tooltip.Arrow className="fill-base-300" />
              </Tooltip.Content>
            </Tooltip.Root>
          </header>

          <ClassificationTotals control={control} events={events} pendingCount={pendingCount} />

          {/* Filters */}
          <div className="border-base-200 bg-base-100/50 flex flex-wrap items-center gap-4 rounded-lg border p-3">
            <span className="text-base-content/70 text-sm font-medium">Filtrar por campo faltante:</span>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="checkbox checkbox-sm checkbox-primary"
                checked={filters.missingCategory || false}
                onChange={(e) => {
                  setFilters((prev) => ({ ...prev, missingCategory: e.target.checked || undefined }));
                  setPage(0);
                }}
              />
              <span className="text-sm">Categoría</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="checkbox checkbox-sm checkbox-primary"
                checked={filters.missingAmount || false}
                onChange={(e) => {
                  setFilters((prev) => ({ ...prev, missingAmount: e.target.checked || undefined }));
                  setPage(0);
                }}
              />
              <span className="text-sm">Monto</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="checkbox checkbox-sm checkbox-primary"
                checked={filters.missingAttended || false}
                onChange={(e) => {
                  setFilters((prev) => ({ ...prev, missingAttended: e.target.checked || undefined }));
                  setPage(0);
                }}
              />
              <span className="text-sm">Asistencia</span>
            </label>
            {Object.values(filters).some(Boolean) && (
              <Button
                type="button"
                variant="ghost"
                className="text-xs"
                onClick={() => {
                  setFilters({});
                  setPage(0);
                }}
              >
                Limpiar filtros
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => void refetch()} disabled={loading}>
              {loading ? "Actualizando..." : "Recargar lista"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => reclassifyMutation.mutate()}
              disabled={reclassifyMutation.isPending}
            >
              {reclassifyMutation.isPending ? "Reclasificando..." : "Reclasificar eventos"}
            </Button>
          </div>

          {error && <Alert variant="error">{error}</Alert>}

          {!loading && events.length === 0 && !error && (
            <Alert variant="success">No hay eventos pendientes de clasificar. ¡Buen trabajo!</Alert>
          )}

          <div className="space-y-4">
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
                />
              );
            })}
          </div>
          {/* Pagination Controls */}
          {totalCount > PAGE_SIZE && (
            <div className="flex items-center justify-center gap-4 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || loading}
              >
                ← Anterior
              </Button>
              <span className="text-base-content/70 text-sm">
                Página {page + 1} de {Math.ceil(totalCount / PAGE_SIZE)} ({totalCount} total)
              </span>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPage((p) => p + 1)}
                disabled={(page + 1) * PAGE_SIZE >= totalCount || loading}
              >
                Siguiente →
              </Button>
            </div>
          )}
        </section>
      </Tooltip.Provider>
      <Toast.Root
        className="bg-base-300 text-base-content rounded-lg px-4 py-3 text-sm shadow-lg"
        open={toastOpen && Boolean(toastMessage)}
        onOpenChange={setToastOpen}
      >
        <Toast.Title className="font-semibold">Operación completada</Toast.Title>
        <Toast.Description className="text-base-content/80 text-xs">{toastMessage}</Toast.Description>
      </Toast.Root>
      <Toast.Viewport className="fixed right-4 bottom-4 z-50 flex flex-col gap-2" />
    </Toast.Provider>
  );
}

export default CalendarClassificationPage;

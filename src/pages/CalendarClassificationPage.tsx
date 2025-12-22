import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import "dayjs/locale/es";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import * as Tooltip from "@radix-ui/react-tooltip";
import * as Toast from "@radix-ui/react-toast";

import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Checkbox from "@/components/ui/Checkbox";
import { classifyCalendarEvent, fetchUnclassifiedCalendarEvents } from "@/features/calendar/api";
import type { CalendarUnclassifiedEvent } from "@/features/calendar/types";
import { currencyFormatter } from "@/lib/format";
import { TITLE_LG, SPACE_Y_TIGHT } from "@/lib/styles";

dayjs.locale("es");

const CATEGORY_CHOICES = ["Tratamiento subcutáneo"];
const TREATMENT_STAGE_CHOICES = ["Mantención", "Inducción"];
const EMPTY_EVENTS: CalendarUnclassifiedEvent[] = [];

const classificationSchema = z.object({
  category: z.string().optional().nullable(),
  amountExpected: z.string().optional().nullable(),
  amountPaid: z.string().optional().nullable(),
  attended: z.boolean(),
  dosage: z.string().optional().nullable(),
  treatmentStage: z.string().optional().nullable(),
});

const classificationArraySchema = z.object({
  entries: z.array(classificationSchema),
});

type FormValues = z.infer<typeof classificationArraySchema>;

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

function formatEventDate(event: CalendarUnclassifiedEvent) {
  if (event.startDateTime) {
    const start = dayjs(event.startDateTime);
    if (event.endDateTime) {
      const end = dayjs(event.endDateTime);
      return `${start.format("DD MMM YYYY HH:mm")} – ${end.format("HH:mm")}`;
    }
    return start.format("DD MMM YYYY HH:mm");
  }
  if (event.startDate) {
    const start = dayjs(event.startDate);
    if (event.endDate && event.endDate !== event.startDate) {
      const end = dayjs(event.endDate);
      return `${start.format("DD MMM YYYY")} – ${end.format("DD MMM YYYY")}`;
    }
    return start.format("DD MMM YYYY");
  }
  return "Sin fecha";
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
  const PAGE_SIZE = 10;
  const queryClient = useQueryClient();

  const {
    data,
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ["calendar-unclassified"],
    queryFn: () => fetchUnclassifiedCalendarEvents(200),
  });

  const events = data || EMPTY_EVENTS;

  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastOpen, setToastOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const form = useForm<FormValues>({
    resolver: zodResolver(classificationArraySchema),
    defaultValues: { entries: [] },
    mode: "onChange",
  });

  const { control, reset, getValues, setValue, watch } = form;
  const { fields } = useFieldArray({ control, name: "entries" });
  const watchedEntries = watch("entries", []);

  // Sync form with data
  useEffect(() => {
    if (events) {
      reset({ entries: events.map(buildDefaultEntry) });
      setVisibleCount(PAGE_SIZE);
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
      setToastMessage(message); // Using toast for error instead of separate state for simplicity or keep error state?
      // The original code used error state for the whole list or individual?
      // It used 'setError' which was page level.
      // Let's use page level error or toast. Original used setError(message).
      // Actually let's use global toast or alert if possible, or keep local error.
      // The original code shows <Alert>{error}</Alert> at top.
    },
    onSettled: () => {
      setSavingKey(null);
    },
  });

  const error =
    queryError instanceof Error
      ? queryError.message
      : queryError
        ? String(queryError)
        : classifyMutation.error instanceof Error
          ? classifyMutation.error.message
          : null;

  const pendingCount = events.length;

  const totals = useMemo(() => {
    if (!watchedEntries || !watchedEntries.length) return { expected: 0, paid: 0 };
    return watchedEntries.reduce(
      (acc, entry, index) => {
        const event = events[index];
        if (!event) return acc;
        const expected = parseAmountInput(entry?.amountExpected) ?? event.amountExpected ?? 0;
        const paid = parseAmountInput(entry?.amountPaid) ?? event.amountPaid ?? 0;
        return {
          expected: acc.expected + expected,
          paid: acc.paid + paid,
        };
      },
      { expected: 0, paid: 0 }
    );
  }, [watchedEntries, events]);

  const handleResetEntry = useCallback(
    (index: number, event: CalendarUnclassifiedEvent) => {
      setValue(`entries.${index}`, buildDefaultEntry(event), { shouldDirty: true });
    },
    [setValue]
  );

  const handleSave = async (event: CalendarUnclassifiedEvent, index: number) => {
    const key = eventKey(event);
    setSavingKey(key);
    const values = getValues(`entries.${index}` as const);
    const payload = buildPayload(values, event);
    classifyMutation.mutate({ event, payload });
  };

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

          <div className="border-base-300 bg-base-100 grid gap-4 rounded-2xl border p-4 text-xs shadow-sm sm:grid-cols-3">
            <div>
              <p className="text-base-content/80 text-xs font-semibold tracking-wide uppercase">Pendientes</p>
              <p className="text-primary mt-1 text-xl font-semibold">{pendingCount}</p>
            </div>
            <div>
              <p className="text-base-content/80 text-xs font-semibold tracking-wide uppercase">
                Monto esperado sugerido
              </p>
              <p className="text-primary mt-1 text-xl font-semibold">{currencyFormatter.format(totals.expected)}</p>
            </div>
            <div>
              <p className="text-base-content/80 text-xs font-semibold tracking-wide uppercase">
                Monto pagado sugerido
              </p>
              <p className="text-primary mt-1 text-xl font-semibold">{currencyFormatter.format(totals.paid)}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => void refetch()} disabled={loading}>
              {loading ? "Actualizando..." : "Recargar lista"}
            </Button>
          </div>

          {error && <Alert variant="error">{error}</Alert>}

          {!loading && events.length === 0 && !error && (
            <Alert variant="success">No hay eventos pendientes de clasificar. ¡Buen trabajo!</Alert>
          )}

          <div className="space-y-4">
            {fields.slice(0, visibleCount).map((field, index) => {
              const event = events[index];
              if (!event) return null;
              const entry = watchedEntries?.[index] ?? buildDefaultEntry(event);
              const key = eventKey(event);
              const isSubcutaneous = (entry.category || "") === "Tratamiento subcutáneo";
              const description = event.description?.trim();

              return (
                <article
                  key={field.id}
                  className="border-base-300 bg-base-100 space-y-4 rounded-2xl border p-5 text-sm shadow-sm"
                >
                  <header className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-secondary/70 text-xs font-semibold tracking-wide uppercase">
                        {event.calendarId}
                      </span>
                      <h2 className="text-base-content text-lg font-semibold">{event.summary ?? "(Sin título)"}</h2>
                      <span className="text-base-content/60 text-xs">{formatEventDate(event)}</span>
                    </div>
                    <div className="text-base-content/60 flex flex-col items-end gap-2 text-xs">
                      {event.eventType && (
                        <span className="bg-base-200 text-base-content rounded-full px-2 py-1 font-semibold">
                          {event.eventType}
                        </span>
                      )}
                      {event.category && (
                        <span className="bg-secondary/15 text-secondary rounded-full px-2 py-1 font-semibold">
                          {event.category}
                        </span>
                      )}
                    </div>
                  </header>

                  {description && (
                    <p className="bg-base-200 text-base-content rounded-xl p-3 text-xs shadow-inner">
                      <span className="text-base-content font-semibold">Descripción:</span>{" "}
                      <span className="whitespace-pre-wrap">{description}</span>
                    </p>
                  )}

                  <div className="text-base-content grid gap-4 text-xs md:grid-cols-6">
                    <Controller
                      control={control}
                      name={`entries.${index}.category` as const}
                      render={({ field: formField }) => (
                        <Input
                          label="Clasificación"
                          as="select"
                          value={formField.value ?? ""}
                          onChange={(event: ChangeEvent<HTMLSelectElement>) => formField.onChange(event.target.value)}
                        >
                          <option value="">Sin clasificación</option>
                          {CATEGORY_CHOICES.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </Input>
                      )}
                    />
                    <Controller
                      control={control}
                      name={`entries.${index}.amountExpected` as const}
                      render={({ field: formField }) => (
                        <Input
                          label="Monto esperado"
                          type="text"
                          placeholder="50000"
                          value={formField.value ?? ""}
                          onChange={(event: ChangeEvent<HTMLInputElement>) => formField.onChange(event.target.value)}
                        />
                      )}
                    />
                    <Controller
                      control={control}
                      name={`entries.${index}.amountPaid` as const}
                      render={({ field: formField }) => (
                        <Input
                          label="Monto pagado"
                          type="text"
                          placeholder="50000"
                          value={formField.value ?? ""}
                          onChange={(event: ChangeEvent<HTMLInputElement>) => formField.onChange(event.target.value)}
                        />
                      )}
                    />
                    {isSubcutaneous && (
                      <Controller
                        control={control}
                        name={`entries.${index}.dosage` as const}
                        render={({ field: formField }) => (
                          <Input
                            label="Dosis"
                            placeholder="0.3 ml"
                            value={formField.value ?? ""}
                            onChange={(event: ChangeEvent<HTMLInputElement>) => formField.onChange(event.target.value)}
                          />
                        )}
                      />
                    )}
                    {isSubcutaneous && (
                      <Controller
                        control={control}
                        name={`entries.${index}.treatmentStage` as const}
                        render={({ field: formField }) => (
                          <Input
                            label="Etapa tratamiento"
                            as="select"
                            value={formField.value ?? ""}
                            onChange={(event: ChangeEvent<HTMLSelectElement>) => formField.onChange(event.target.value)}
                          >
                            <option value="">Sin etapa</option>
                            {TREATMENT_STAGE_CHOICES.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </Input>
                        )}
                      />
                    )}
                    <Controller
                      control={control}
                      name={`entries.${index}.attended` as const}
                      render={({ field: formField }) => (
                        <div className="flex items-end">
                          <Checkbox
                            label="Asistió / llegó"
                            checked={formField.value ?? false}
                            onChange={(event) => formField.onChange(event.target.checked)}
                          />
                        </div>
                      )}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" onClick={() => handleSave(event, index)} disabled={savingKey === key}>
                      {savingKey === key ? "Guardando..." : "Guardar y continuar"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleResetEntry(index, event)}
                      disabled={savingKey === key}
                    >
                      Limpiar cambios
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
          {visibleCount < events.length ? (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setVisibleCount((count) => Math.min(count + PAGE_SIZE, events.length))}
              >
                Ver más eventos ({events.length - visibleCount} restantes)
              </Button>
            </div>
          ) : null}
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

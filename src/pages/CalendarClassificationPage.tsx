import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import dayjs from "dayjs";
import "dayjs/locale/es";

import Alert from "../components/Alert";
import Button from "../components/Button";
import Input from "../components/Input";
import Checkbox from "../components/Checkbox";
import {
  classifyCalendarEvent,
  fetchUnclassifiedCalendarEvents,
} from "../features/calendar/api";
import type { CalendarUnclassifiedEvent } from "../features/calendar/types";

dayjs.locale("es");

type Draft = {
  category: string;
  amountExpected: string;
  amountPaid: string;
  attended: boolean;
  dosage: string;
  treatmentStage: string;
};

const CATEGORY_CHOICES = ["Tratamiento subcutáneo", "Test y exámenes"];
const TREATMENT_STAGE_CHOICES = ["Mantención", "Inducción"];

const currencyFormatter = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 });

function eventKey(event: Pick<CalendarUnclassifiedEvent, "calendarId" | "eventId">) {
  return `${event.calendarId}:::${event.eventId}`;
}

function buildDraft(event: CalendarUnclassifiedEvent): Draft {
  return {
    category: event.category ?? "",
    amountExpected: event.amountExpected != null ? String(event.amountExpected) : "",
    amountPaid: event.amountPaid != null ? String(event.amountPaid) : "",
    attended: event.attended ?? false,
    dosage: event.dosage ?? "",
    treatmentStage: event.treatmentStage ?? "",
  };
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

function parseAmountInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\./g, "");
  const parsed = Number.parseInt(normalized, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function CalendarClassificationPage() {
  const [events, setEvents] = useState<CalendarUnclassifiedEvent[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchUnclassifiedCalendarEvents(100);
      setEvents(data);
      setDrafts((prev) => {
        const next: Record<string, Draft> = {};
        data.forEach((event) => {
          const key = eventKey(event);
          next[key] = prev[key] ?? buildDraft(event);
        });
        return next;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudieron obtener los eventos pendientes";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const pendingCount = events.length;

  const handleDraftChange = useCallback((key: string, baseEvent: CalendarUnclassifiedEvent, patch: Partial<Draft>) => {
    setDrafts((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] ?? buildDraft(baseEvent)),
        ...patch,
      },
    }));
  }, []);

  const resetDraft = useCallback((event: CalendarUnclassifiedEvent) => {
    const key = eventKey(event);
    setDrafts((prev) => ({
      ...prev,
      [key]: buildDraft(event),
    }));
  }, []);

  const removeEvent = useCallback((key: string) => {
    setEvents((prev) => prev.filter((event) => eventKey(event) !== key));
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const handleSave = useCallback(
    async (event: CalendarUnclassifiedEvent) => {
      const key = eventKey(event);
      const draft = drafts[key] ?? buildDraft(event);
      setSavingKey(key);
      setError(null);

      const payloadCategory = draft.category.trim() ? draft.category.trim() : null;
      const payloadExpected = parseAmountInput(draft.amountExpected);
      const payloadPaid = parseAmountInput(draft.amountPaid);
      const payloadDosage = draft.dosage.trim() ? draft.dosage.trim() : null;
      const payloadStage = draft.treatmentStage.trim() ? draft.treatmentStage.trim() : null;

      try {
        await classifyCalendarEvent({
          calendarId: event.calendarId,
          eventId: event.eventId,
          category: payloadCategory,
          amountExpected: payloadExpected,
          amountPaid: payloadPaid,
          attended: draft.attended,
          dosage: payloadDosage,
          treatmentStage: payloadStage,
        });
        removeEvent(key);
      } catch (err) {
        const message = err instanceof Error ? err.message : "No se pudo guardar la clasificación";
        setError(message);
      } finally {
        setSavingKey(null);
      }
    },
    [drafts, removeEvent]
  );

  const totalEsperado = useMemo(
    () =>
      events.reduce((acc, event) => {
        if (event.amountExpected != null) return acc + event.amountExpected;
        const draft = drafts[eventKey(event)];
        const parsed = draft ? parseAmountInput(draft.amountExpected) : null;
        return acc + (parsed ?? 0);
      }, 0),
    [events, drafts]
  );

  const totalPagado = useMemo(
    () =>
      events.reduce((acc, event) => {
        if (event.amountPaid != null) return acc + event.amountPaid;
        const draft = drafts[eventKey(event)];
        const parsed = draft ? parseAmountInput(draft.amountPaid) : null;
        return acc + (parsed ?? 0);
      }, 0),
    [events, drafts]
  );

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-[var(--brand-primary)]">Clasificar eventos pendientes</h1>
        <p className="text-sm text-slate-600">
          Revisa los eventos que no pudieron clasificarse automáticamente. Asigna la categoría correcta,
          confirma montos y marca si la persona asistió.
        </p>
      </header>

      <div className="glass-card glass-underlay-gradient grid gap-4 rounded-2xl border border-white/60 p-4 text-xs shadow-sm sm:grid-cols-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pendientes</p>
          <p className="mt-1 text-xl font-semibold text-[var(--brand-primary)]">{pendingCount}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Monto esperado sugerido</p>
          <p className="mt-1 text-xl font-semibold text-[var(--brand-primary)]">
            {currencyFormatter.format(totalEsperado)}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Monto pagado sugerido</p>
          <p className="mt-1 text-xl font-semibold text-[var(--brand-primary)]">
            {currencyFormatter.format(totalPagado)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" onClick={() => void loadEvents()} disabled={loading}>
          {loading ? "Actualizando..." : "Recargar lista"}
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {!loading && events.length === 0 && !error && (
        <Alert variant="success">No hay eventos pendientes de clasificar. ¡Buen trabajo!</Alert>
      )}

      <div className="space-y-4">
        {events.map((calendarEvent) => {
          const key = eventKey(calendarEvent);
          const draft = drafts[key] ?? buildDraft(calendarEvent);
          const description = calendarEvent.description?.trim();

          return (
            <article
              key={key}
              className="glass-card glass-underlay-gradient space-y-4 rounded-2xl border border-white/60 bg-white/80 p-5 text-sm shadow-sm"
            >
              <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-secondary)]/70">
                    {calendarEvent.calendarId}
                  </span>
                  <h2 className="text-lg font-semibold text-slate-800">{calendarEvent.summary ?? "(Sin título)"}</h2>
                  <span className="text-xs text-slate-500">{formatEventDate(calendarEvent)}</span>
                </div>
                <div className="flex flex-col items-end gap-2 text-[11px] text-slate-500">
                  {calendarEvent.eventType && (
                    <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-600">
                      {calendarEvent.eventType}
                    </span>
                  )}
                  {calendarEvent.category && (
                    <span className="rounded-full bg-[var(--brand-secondary)]/15 px-2 py-1 font-semibold text-[var(--brand-secondary)]">
                      {calendarEvent.category}
                    </span>
                  )}
                </div>
              </header>

              {(calendarEvent.dosage || draft.dosage || calendarEvent.treatmentStage || draft.treatmentStage) && (
                <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
                  {(draft.dosage || calendarEvent.dosage) && (
                    <span className="rounded-full bg-white/70 px-2 py-1 font-semibold text-slate-600">
                      Dosis: {draft.dosage || calendarEvent.dosage}
                    </span>
                  )}
                  {(draft.treatmentStage || calendarEvent.treatmentStage) && (
                    <span className="rounded-full bg-[var(--brand-primary)]/10 px-2 py-1 font-semibold text-[var(--brand-primary)]">
                      {draft.treatmentStage || calendarEvent.treatmentStage}
                    </span>
                  )}
                </div>
              )}

              {description && (
                <p className="rounded-xl bg-white/70 p-3 text-xs text-slate-600 shadow-inner">
                  <span className="font-semibold text-slate-700">Descripción:</span>{" "}
                  <span className="whitespace-pre-wrap">{description}</span>
                </p>
              )}

              <div className="grid gap-4 text-xs text-slate-600 md:grid-cols-6">
                <Input
                  label="Clasificación"
                  type="select"
                  value={draft.category}
                  onChange={(input: ChangeEvent<HTMLSelectElement>) =>
                    handleDraftChange(key, calendarEvent, { category: input.target.value })
                  }
                >
                  <option value="">Sin clasificación</option>
                  {CATEGORY_CHOICES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Input>
                <Input
                  label="Monto esperado"
                  type="number"
                  min={0}
                  step={1000}
                  value={draft.amountExpected}
                  placeholder="50000"
                  onChange={(input: ChangeEvent<HTMLInputElement>) =>
                    handleDraftChange(key, calendarEvent, { amountExpected: input.target.value })
                  }
                />
                <Input
                  label="Monto pagado"
                  type="number"
                  min={0}
                  step={1000}
                  value={draft.amountPaid}
                  placeholder="50000"
                  onChange={(input: ChangeEvent<HTMLInputElement>) =>
                    handleDraftChange(key, calendarEvent, { amountPaid: input.target.value })
                  }
                />
                <Input
                  label="Dosis"
                  placeholder="0.3 ml"
                  value={draft.dosage}
                  onChange={(input: ChangeEvent<HTMLInputElement>) =>
                    handleDraftChange(key, calendarEvent, { dosage: input.target.value })
                  }
                />
                <Input
                  label="Etapa tratamiento"
                  type="select"
                  value={draft.treatmentStage}
                  onChange={(input: ChangeEvent<HTMLSelectElement>) =>
                    handleDraftChange(key, calendarEvent, { treatmentStage: input.target.value })
                  }
                >
                  <option value="">Sin etapa</option>
                  {TREATMENT_STAGE_CHOICES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Input>
                <div className="flex items-end">
                  <Checkbox
                    label="Asistió / llegó"
                    checked={draft.attended}
                    onChange={(input: ChangeEvent<HTMLInputElement>) =>
                      handleDraftChange(key, calendarEvent, { attended: input.target.checked })
                    }
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  onClick={() => handleSave(calendarEvent)}
                  disabled={savingKey === key}
                >
                  {savingKey === key ? "Guardando..." : "Guardar y continuar"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    resetDraft(calendarEvent);
                  }}
                  disabled={savingKey === key}
                >
                  Limpiar cambios
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default CalendarClassificationPage;

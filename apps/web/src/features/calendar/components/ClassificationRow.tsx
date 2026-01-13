import { useStore } from "@tanstack/react-form";
import dayjs from "dayjs";

import Button from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import Checkbox from "@/components/ui/Checkbox";
import Input from "@/components/ui/Input";
import { type CalendarUnclassifiedEvent } from "@/features/calendar/types";

import { type FormValues } from "../schemas";
import { FormattedEventDescription } from "./FormattedEventDescription";

interface ClassificationRowProps {
  index: number;
  event: CalendarUnclassifiedEvent;

  form: any;
  isSaving: boolean;
  onSave: (event: CalendarUnclassifiedEvent, index: number) => void;
  onReset: (index: number, event: CalendarUnclassifiedEvent) => void;
  categoryChoices: readonly string[];
  treatmentStageChoices: readonly string[];
}

// Helper to format date
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

export function ClassificationRow({
  index,
  event,
  form,
  isSaving,
  onSave,
  onReset,
  categoryChoices,
  treatmentStageChoices,
}: ClassificationRowProps) {
  const description = event.description?.trim();

  // Subscribe to category for conditional fields

  const category = useStore(
    form.store,
    (state: any) => (state as { values: FormValues }).values.entries[index]?.category ?? ""
  );
  const isSubcutaneous = category === "Tratamiento subcutáneo";

  return (
    <Card className="text-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 p-5 pb-2">
        <div className="flex flex-col gap-1">
          <span className="text-secondary/70 text-xs font-semibold tracking-wide uppercase">{event.calendarId}</span>
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
      </CardHeader>
      <CardContent className="space-y-4 p-5 pt-0">
        {description && (
          <div className="bg-base-200 text-base-content rounded-xl p-3 shadow-inner">
            <span className="text-base-content mb-1 block text-xs font-semibold">Descripción:</span>
            <FormattedEventDescription text={description} />
          </div>
        )}

        <div className="text-base-content grid gap-4 text-xs md:grid-cols-6">
          <form.Field name={`entries[${index}].category`}>
            {(field: { state: { value: string | null }; handleChange: (v: string) => void }) => (
              <Input
                label="Clasificación"
                as="select"
                value={field.state.value ?? ""}
                onChange={(e) => field.handleChange(e.target.value)}
              >
                <option value="">Sin clasificación</option>
                {categoryChoices.map((option: string) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Input>
            )}
          </form.Field>

          <form.Field name={`entries[${index}].amountExpected`}>
            {(field: { state: { value: string | null }; handleChange: (v: string) => void }) => (
              <Input
                label="Monto esperado"
                type="text"
                placeholder="50000"
                value={field.state.value ?? ""}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            )}
          </form.Field>

          <form.Field name={`entries[${index}].amountPaid`}>
            {(field: { state: { value: string | null }; handleChange: (v: string) => void }) => (
              <Input
                label="Monto pagado"
                type="text"
                placeholder="50000"
                value={field.state.value ?? ""}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            )}
          </form.Field>

          {isSubcutaneous && (
            <form.Field name={`entries[${index}].dosage`}>
              {(field: { state: { value: string | null }; handleChange: (v: string) => void }) => (
                <Input
                  label="Dosis"
                  placeholder="0.3 ml"
                  value={field.state.value ?? ""}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              )}
            </form.Field>
          )}

          {isSubcutaneous && (
            <form.Field name={`entries[${index}].treatmentStage`}>
              {(field: { state: { value: string | null }; handleChange: (v: string) => void }) => (
                <Input
                  label="Etapa tratamiento"
                  as="select"
                  value={field.state.value ?? ""}
                  onChange={(e) => field.handleChange(e.target.value)}
                >
                  <option value="">Sin etapa</option>
                  {treatmentStageChoices.map((option: string) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Input>
              )}
            </form.Field>
          )}

          <form.Field name={`entries[${index}].attended`}>
            {(field: { state: { value: boolean }; handleChange: (v: boolean) => void }) => (
              <div className="flex items-end">
                <Checkbox
                  label="Asistió / llegó"
                  checked={field.state.value ?? false}
                  onChange={(e) => field.handleChange(e.target.checked)}
                />
              </div>
            )}
          </form.Field>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => onSave(event, index)} disabled={isSaving}>
            {isSaving ? "Guardando..." : "Guardar y continuar"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => onReset(index, event)} disabled={isSaving}>
            Limpiar cambios
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

import { useStore } from "@tanstack/react-form";
import dayjs from "dayjs";

import Button from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import Checkbox from "@/components/ui/Checkbox";
import Input from "@/components/ui/Input";
import type { CalendarUnclassifiedEvent } from "@/features/calendar/types";

import type { FormValues } from "../schemas";
import { FormattedEventDescription } from "./FormattedEventDescription";

interface ClassificationRowProps {
  categoryChoices: readonly string[];
  event: CalendarUnclassifiedEvent;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any;
  index: number;
  isSaving: boolean;
  onReset: (index: number, event: CalendarUnclassifiedEvent) => void;
  onSave: (event: CalendarUnclassifiedEvent, index: number) => void;
  treatmentStageChoices: readonly string[];
}

export function ClassificationRow({
  categoryChoices,
  event,
  form,
  index,
  isSaving,
  onReset,
  onSave,
  treatmentStageChoices,
}: Readonly<ClassificationRowProps>) {
  const description = event.description?.trim();

  // Subscribe to category for conditional fields

  /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, security/detect-object-injection */
  const category = useStore(
    form.store,
    (state: any) => (state as { values: FormValues }).values.entries[index]?.category ?? "",
  );
  /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, security/detect-object-injection */
  const isSubcutaneous = category === "Tratamiento subcutáneo";

  return (
    <Card className="text-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 p-5 pb-2">
        <div className="flex flex-col gap-1">
          <span className="text-secondary/70 text-xs font-semibold tracking-wide uppercase">
            {event.calendarId}
          </span>
          <h2 className="text-base-content text-lg font-semibold">
            {event.summary ?? "(Sin título)"}
          </h2>
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
            {(field: { handleChange: (v: string) => void; state: { value: null | string } }) => (
              <Input
                as="select"
                label="Clasificación"
                onChange={(e) => {
                  field.handleChange(e.target.value);
                }}
                value={field.state.value ?? ""}
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
            {(field: { handleChange: (v: string) => void; state: { value: null | string } }) => (
              <Input
                label="Monto esperado"
                onChange={(e) => {
                  field.handleChange(e.target.value);
                }}
                placeholder="50000"
                type="text"
                value={field.state.value ?? ""}
              />
            )}
          </form.Field>

          <form.Field name={`entries[${index}].amountPaid`}>
            {(field: { handleChange: (v: string) => void; state: { value: null | string } }) => (
              <Input
                label="Monto pagado"
                onChange={(e) => {
                  field.handleChange(e.target.value);
                }}
                placeholder="50000"
                type="text"
                value={field.state.value ?? ""}
              />
            )}
          </form.Field>

          {isSubcutaneous && (
            <form.Field name={`entries[${index}].dosage`}>
              {(field: { handleChange: (v: string) => void; state: { value: null | string } }) => (
                <Input
                  label="Dosis"
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                  }}
                  placeholder="0.3 ml"
                  value={field.state.value ?? ""}
                />
              )}
            </form.Field>
          )}

          {isSubcutaneous && (
            <form.Field name={`entries[${index}].treatmentStage`}>
              {(field: { handleChange: (v: string) => void; state: { value: null | string } }) => (
                <Input
                  as="select"
                  label="Etapa tratamiento"
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                  }}
                  value={field.state.value ?? ""}
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
            {(field: { handleChange: (v: boolean) => void; state: { value: boolean } }) => (
              <div className="flex items-end">
                <Checkbox
                  checked={field.state.value}
                  label="Asistió / llegó"
                  onChange={(e) => {
                    field.handleChange(e.target.checked);
                  }}
                />
              </div>
            )}
          </form.Field>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={isSaving}
            onClick={() => {
              onSave(event, index);
            }}
            type="button"
          >
            {isSaving ? "Guardando..." : "Guardar y continuar"}
          </Button>
          <Button
            disabled={isSaving}
            onClick={() => {
              onReset(index, event);
            }}
            type="button"
            variant="secondary"
          >
            Limpiar cambios
          </Button>
        </div>
      </CardContent>
    </Card>
  );
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

import React, { type ChangeEvent } from "react";
import { type Control, Controller, useWatch } from "react-hook-form";
import dayjs from "dayjs";
import { type CalendarUnclassifiedEvent } from "@/features/calendar/types";
import { type FormValues, CATEGORY_CHOICES, TREATMENT_STAGE_CHOICES } from "../schemas"; // Adjust import path
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Checkbox from "@/components/ui/Checkbox";

interface ClassificationRowProps {
  index: number;
  event: CalendarUnclassifiedEvent;
  control: Control<FormValues>;
  isSaving: boolean;
  onSave: (event: CalendarUnclassifiedEvent, index: number) => void;
  onReset: (index: number, event: CalendarUnclassifiedEvent) => void;
  initialValues: unknown; // Using unknown instead of any, or null if strictly defined
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

// We wrap in memo to prevent re-render when OTHER rows change.
export const ClassificationRow = React.memo(function ClassificationRow({
  index,
  event,
  control,
  isSaving,
  onSave,
  onReset,
}: ClassificationRowProps) {
  const description = event.description?.trim();

  return (
    <ClassificationRowInner
      index={index}
      event={event}
      control={control}
      isSaving={isSaving}
      onSave={onSave}
      onReset={onReset}
      description={description}
    />
  );
});

interface ClassificationRowInnerProps extends Omit<ClassificationRowProps, "initialValues"> {
  description?: string;
}

function ClassificationRowInner({
  index,
  event,
  control,
  isSaving,
  onSave,
  onReset,
  description,
}: ClassificationRowInnerProps) {
  const category = useWatch({
    control,
    name: `entries.${index}.category`,
  });

  const isSubcutaneous = (category || "") === "Tratamiento subcutáneo";

  return (
    <article className="border-base-300 bg-base-100 space-y-4 rounded-2xl border p-5 text-sm shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
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
        <Button type="button" onClick={() => onSave(event, index)} disabled={isSaving}>
          {isSaving ? "Guardando..." : "Guardar y continuar"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => onReset(index, event)} disabled={isSaving}>
          Limpiar cambios
        </Button>
      </div>
    </article>
  );
}

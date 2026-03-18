import {
  Button,
  Card,
  Checkbox,
  Description,
  Input,
  Label,
  ListBox,
  Select,
  TextField,
} from "@heroui/react";
import { useStore } from "@tanstack/react-form";
import dayjs from "dayjs";
import type { CalendarUnclassifiedEvent } from "@/features/calendar/types";

import type { ClassificationForm } from "../form-types";
import { isExplicitNoShowEvent } from "../utils/classification";
import { FormattedEventDescription } from "./FormattedEventDescription";

interface ClassificationRowProps {
  categoryChoices: readonly string[];
  event: CalendarUnclassifiedEvent;
  form: ClassificationForm;
  index: number;
  isSaving: boolean;
  onReset: (index: number, event: CalendarUnclassifiedEvent) => void;
  onSave: (event: CalendarUnclassifiedEvent, index: number) => void;
  patchReadingChoices: readonly string[];
  testSubtypeChoices: readonly string[];
  treatmentStageChoices: readonly string[];
}

const SUBCUTANEOUS_CATEGORY = "Tratamiento subcutáneo";
const TEST_CATEGORY = "Test y exámenes";
const NONE_CATEGORY_KEY = "__none_category__";
const NONE_TREATMENT_STAGE_KEY = "__none_treatment_stage__";

function normalizeChoiceValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function resolveChoiceValue(value: null | string | undefined, choices: readonly string[]): string {
  if (!value) {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const exactMatch = choices.find((choice) => choice === trimmed);
  if (exactMatch) {
    return exactMatch;
  }

  const normalizedInput = normalizeChoiceValue(trimmed);
  const normalizedMatch = choices.find(
    (choice) => normalizeChoiceValue(choice) === normalizedInput
  );
  return normalizedMatch ?? trimmed;
}

export function ClassificationRow({
  categoryChoices,
  event,
  form,
  index,
  isSaving,
  onReset,
  onSave,
  patchReadingChoices,
  testSubtypeChoices,
  treatmentStageChoices,
}: Readonly<ClassificationRowProps>) {
  const description = event.description?.trim();

  // Subscribe to category for conditional fields
  const category = useStore(form.store, (state) => state.values.entries[index]?.category ?? "");
  const isSubcutaneous =
    normalizeChoiceValue(category) === normalizeChoiceValue(SUBCUTANEOUS_CATEGORY);
  const isTest = normalizeChoiceValue(category) === normalizeChoiceValue(TEST_CATEGORY);
  const testSubtypePatch = useStore(form.store, (state) =>
    Boolean(state.values.entries[index]?.testSubtypePatch)
  );
  const testPatchFirstReading = useStore(form.store, (state) =>
    Boolean(state.values.entries[index]?.testPatchFirstReading)
  );
  const testPatchSecondReading = useStore(form.store, (state) =>
    Boolean(state.values.entries[index]?.testPatchSecondReading)
  );
  const testPatchThirdReading = useStore(form.store, (state) =>
    Boolean(state.values.entries[index]?.testPatchThirdReading)
  );
  const hasPatchReading = testPatchFirstReading || testPatchSecondReading || testPatchThirdReading;
  const isNoShowLocked = isExplicitNoShowEvent(event);

  return (
    <Card className="border-default-200/70 bg-content1 text-sm shadow-sm">
      <Card.Header className="flex flex-row items-start justify-between gap-4 space-y-0 p-6 pb-4">
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-secondary/70 text-xs uppercase tracking-wide">
            {event.calendarId}
          </span>
          <h2 className="font-semibold text-foreground text-xl leading-tight">
            {event.summary ?? "(Sin título)"}
          </h2>
          <span className="text-foreground-500 text-sm">{formatEventDate(event)}</span>
        </div>
        <div className="flex flex-col items-end gap-2 text-foreground-500 text-xs">
          {event.eventType && event.eventType !== "default" && (
            <span className="rounded-full border border-default-200/70 bg-default-100 px-3 py-1 font-semibold text-foreground">
              {event.eventType}
            </span>
          )}
          {event.category && (
            <span className="rounded-full border border-secondary/25 bg-secondary/15 px-3 py-1 font-semibold text-secondary">
              {event.category}
            </span>
          )}
        </div>
      </Card.Header>
      <Card.Content className="space-y-5 px-6 pt-0 pb-6">
        {description && (
          <div className="rounded-xl border border-default-200/60 bg-default-100/80 p-4 text-foreground">
            <span className="mb-2 block font-semibold text-foreground text-xs uppercase tracking-wide">
              Descripción
            </span>
            <FormattedEventDescription text={description} />
          </div>
        )}

        <div className="grid grid-cols-1 gap-x-4 gap-y-5 text-foreground text-xs sm:grid-cols-2 xl:grid-cols-3">
          <form.Field name={`entries[${index}].category`}>
            {(field: { handleChange: (v: string) => void; state: { value: null | string } }) => {
              const selectedCategory = resolveChoiceValue(field.state.value, categoryChoices);
              const hasLegacyCategory =
                selectedCategory.length > 0 && !categoryChoices.includes(selectedCategory);
              return (
                <Select
                  placeholder="Selecciona una clasificación"
                  onChange={(key) => {
                    field.handleChange(key === NONE_CATEGORY_KEY ? "" : (key as string));
                  }}
                  value={selectedCategory || NONE_CATEGORY_KEY}
                  variant="secondary"
                >
                  <Label>Clasificación</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id={NONE_CATEGORY_KEY} key={NONE_CATEGORY_KEY}>
                        Sin clasificación
                      </ListBox.Item>
                      {hasLegacyCategory && (
                        <ListBox.Item
                          id={selectedCategory}
                          key={`legacy-category-${selectedCategory}`}
                        >
                          {selectedCategory}
                        </ListBox.Item>
                      )}
                      {categoryChoices.map((option: string) => (
                        <ListBox.Item id={option} key={option}>
                          {option}
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              );
            }}
          </form.Field>

          <form.Field name={`entries[${index}].amountExpected`}>
            {(field: { handleChange: (v: string) => void; state: { value: null | string } }) => (
              <TextField
                isDisabled={isTest && hasPatchReading}
                value={isTest && hasPatchReading ? "0" : (field.state.value ?? "")}
                onChange={(v) => field.handleChange(v)}
              >
                <Label>Monto esperado</Label>
                <Input placeholder="50000" type="text" variant="secondary" />
                {isTest && hasPatchReading ? (
                  <Description>Lecturas de parche no tienen costo.</Description>
                ) : null}
              </TextField>
            )}
          </form.Field>

          <form.Field name={`entries[${index}].amountPaid`}>
            {(field: { handleChange: (v: string) => void; state: { value: null | string } }) => (
              <TextField
                isDisabled={isNoShowLocked || (isTest && hasPatchReading)}
                value={
                  isNoShowLocked || (isTest && hasPatchReading) ? "0" : (field.state.value ?? "")
                }
                onChange={(v) => field.handleChange(v)}
              >
                <Label>Monto pagado</Label>
                <Input placeholder="50000" type="text" variant="secondary" />
                {isNoShowLocked ? (
                  <Description>Evento "no asiste": pago forzado a 0.</Description>
                ) : null}
              </TextField>
            )}
          </form.Field>

          {isTest && (
            <>
              <form.Field name={`entries[${index}].testSubtypeSkin`}>
                {(field: {
                  handleChange: (v: boolean) => void;
                  state: { value: boolean | null | undefined };
                }) => (
                  <div className="flex flex-col gap-1 pt-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        aria-label={testSubtypeChoices[0] ?? "Test cutáneo"}
                        isSelected={Boolean(field.state.value)}
                        onChange={field.handleChange}
                        variant="secondary"
                      >
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                      </Checkbox>
                      <span className="text-sm">{testSubtypeChoices[0] ?? "Test cutáneo"}</span>
                    </div>
                  </div>
                )}
              </form.Field>

              <form.Field name={`entries[${index}].testSubtypePatch`}>
                {(field: {
                  handleChange: (v: boolean) => void;
                  state: { value: boolean | null | undefined };
                }) => (
                  <div className="flex flex-col gap-1 pt-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        aria-label={testSubtypeChoices[1] ?? "Test de parche"}
                        isSelected={Boolean(field.state.value)}
                        onChange={(next) => {
                          field.handleChange(next);
                          if (!next) {
                            form.setFieldValue(`entries[${index}].testPatchFirstReading`, false);
                            form.setFieldValue(`entries[${index}].testPatchSecondReading`, false);
                            form.setFieldValue(`entries[${index}].testPatchThirdReading`, false);
                          }
                        }}
                        variant="secondary"
                      >
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                      </Checkbox>
                      <span className="text-sm">{testSubtypeChoices[1] ?? "Test de parche"}</span>
                    </div>
                  </div>
                )}
              </form.Field>

              <form.Field name={`entries[${index}].testPatchFirstReading`}>
                {(field: {
                  handleChange: (v: boolean) => void;
                  state: { value: boolean | null | undefined };
                }) => (
                  <div className="flex flex-col gap-1 pt-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        aria-label={patchReadingChoices[0] ?? "1ra lectura"}
                        isDisabled={!testSubtypePatch}
                        isSelected={Boolean(field.state.value)}
                        onChange={field.handleChange}
                        variant="secondary"
                      >
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                      </Checkbox>
                      <span className="text-sm">{patchReadingChoices[0] ?? "1ra lectura"}</span>
                    </div>
                  </div>
                )}
              </form.Field>

              <form.Field name={`entries[${index}].testPatchSecondReading`}>
                {(field: {
                  handleChange: (v: boolean) => void;
                  state: { value: boolean | null | undefined };
                }) => (
                  <div className="flex flex-col gap-1 pt-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        aria-label={patchReadingChoices[1] ?? "2da lectura"}
                        isDisabled={!testSubtypePatch}
                        isSelected={Boolean(field.state.value)}
                        onChange={field.handleChange}
                        variant="secondary"
                      >
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                      </Checkbox>
                      <span className="text-sm">{patchReadingChoices[1] ?? "2da lectura"}</span>
                    </div>
                  </div>
                )}
              </form.Field>

              <form.Field name={`entries[${index}].testPatchThirdReading`}>
                {(field: {
                  handleChange: (v: boolean) => void;
                  state: { value: boolean | null | undefined };
                }) => (
                  <div className="flex flex-col gap-1 pt-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        aria-label={patchReadingChoices[2] ?? "3ra lectura"}
                        isDisabled={!testSubtypePatch}
                        isSelected={Boolean(field.state.value)}
                        onChange={field.handleChange}
                        variant="secondary"
                      >
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                      </Checkbox>
                      <span className="text-sm">{patchReadingChoices[2] ?? "3ra lectura"}</span>
                    </div>
                  </div>
                )}
              </form.Field>
            </>
          )}

          {isSubcutaneous && (
            <form.Field name={`entries[${index}].dosageValue`}>
              {(field: { handleChange: (v: string) => void; state: { value: null | string } }) => (
                <TextField value={field.state.value ?? ""} onChange={(v) => field.handleChange(v)}>
                  <Label>Dosis</Label>
                  <Input placeholder="0.3" variant="secondary" />
                </TextField>
              )}
            </form.Field>
          )}

          {isSubcutaneous && (
            <form.Field name={`entries[${index}].treatmentStage`}>
              {(field: { handleChange: (v: string) => void; state: { value: null | string } }) => (
                <Select
                  placeholder="Selecciona una etapa"
                  onChange={(key) => {
                    field.handleChange(key === NONE_TREATMENT_STAGE_KEY ? "" : (key as string));
                  }}
                  value={
                    resolveChoiceValue(field.state.value, treatmentStageChoices) ||
                    NONE_TREATMENT_STAGE_KEY
                  }
                  variant="secondary"
                >
                  <Label>Etapa tratamiento</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id={NONE_TREATMENT_STAGE_KEY} key={NONE_TREATMENT_STAGE_KEY}>
                        Sin etapa
                      </ListBox.Item>
                      {treatmentStageChoices.map((option: string) => (
                        <ListBox.Item id={option} key={option}>
                          {option}
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              )}
            </form.Field>
          )}

          <form.Field name={`entries[${index}].attended`}>
            {(field: { handleChange: (v: boolean) => void; state: { value: boolean } }) => (
              <div className="flex flex-col gap-1 pt-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    aria-label="Asistió / llegó"
                    isDisabled={isNoShowLocked}
                    isSelected={isNoShowLocked ? false : Boolean(field.state.value)}
                    onChange={field.handleChange}
                    variant="secondary"
                  >
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                  </Checkbox>
                  <span className="text-sm">
                    {isNoShowLocked ? "No asistió / no llegó" : "Asistió / llegó"}
                  </span>
                </div>
                {isNoShowLocked && (
                  <span className="pl-8 text-default-500 text-xs">
                    Bloqueado por detección automática de no-show.
                  </span>
                )}
              </div>
            )}
          </form.Field>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-default-200/70 border-t pt-4">
          <Button
            variant="primary"
            isDisabled={isSaving}
            onPress={() => {
              onSave(event, index);
            }}
            size="sm"
            type="button"
          >
            {isSaving ? "Guardando..." : "Guardar y continuar"}
          </Button>
          <Button
            isDisabled={isSaving}
            onPress={() => {
              onReset(index, event);
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            Limpiar cambios
          </Button>
        </div>
      </Card.Content>
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
    if (event.endDate && !dayjs(event.endDate).isSame(start, "day")) {
      const end = dayjs(event.endDate);
      return `${start.format("DD MMM YYYY")} – ${end.format("DD MMM YYYY")}`;
    }
    return start.format("DD MMM YYYY");
  }
  return "Sin fecha";
}

import {
  Calendar,
  DateField,
  DatePicker,
  Description,
  Label,
  ListBox,
  NumberField,
  Select,
} from "@heroui/react";
import { parseDate } from "@internationalized/date";
import dayjs from "dayjs";
import { GRID_2_COL_MD } from "@/lib/styles";

import type { ServiceFrequency, ServiceRecurrenceType } from "../../types";
import type { ServiceFormState } from "../ServiceForm";

interface SchedulingSectionProps {
  dueDay?: null | number;
  effectiveMonths: number;
  frequency?: ServiceFrequency;
  monthsToGenerate?: number;
  onChange: <K extends keyof ServiceFormState>(key: K, value: ServiceFormState[K]) => void;
  recurrenceType?: ServiceRecurrenceType;
  startDate?: Date;
}

const FREQUENCY_OPTIONS: { label: string; value: ServiceFrequency }[] = [
  { label: "Semanal", value: "WEEKLY" },
  { label: "Quincenal", value: "BIWEEKLY" },
  { label: "Mensual", value: "MONTHLY" },
  { label: "Bimensual", value: "BIMONTHLY" },
  { label: "Trimestral", value: "QUARTERLY" },
  { label: "Semestral", value: "SEMIANNUAL" },
  { label: "Anual", value: "ANNUAL" },
  { label: "Única vez", value: "ONCE" },
];

export function SchedulingSection({
  dueDay,
  effectiveMonths,
  frequency,
  onChange,
  recurrenceType,
  startDate,
}: SchedulingSectionProps) {
  return (
    <section className={GRID_2_COL_MD}>
      <Select
        onChange={(key) => {
          onChange("frequency", key as ServiceFrequency);
        }}
        value={frequency ?? "MONTHLY"}
      >
        <Label>Frecuencia</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {FREQUENCY_OPTIONS.map((option) => (
              <ListBox.Item id={option.value} key={option.value}>
                {option.label}
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
      <DatePicker
        isRequired
        onChange={(value) => {
          if (!value) {
            return;
          }
          onChange("startDate", dayjs(value.toString(), "YYYY-MM-DD").toDate());
        }}
        value={startDate ? parseDate(dayjs(startDate).format("YYYY-MM-DD")) : undefined}
      >
        <Label>Fecha de inicio</Label>
        <DateField.Group>
          <DateField.InputContainer>
            <DateField.Input>
              {(segment) => <DateField.Segment segment={segment} />}
            </DateField.Input>
          </DateField.InputContainer>
          <DateField.Suffix>
            <DatePicker.Trigger>
              <DatePicker.TriggerIndicator />
            </DatePicker.Trigger>
          </DateField.Suffix>
        </DateField.Group>
        <DatePicker.Popover>
          <Calendar aria-label="Fecha de inicio">
            <Calendar.Header>
              <Calendar.YearPickerTrigger>
                <Calendar.YearPickerTriggerHeading />
                <Calendar.YearPickerTriggerIndicator />
              </Calendar.YearPickerTrigger>
              <Calendar.NavButton slot="previous" />
              <Calendar.NavButton slot="next" />
            </Calendar.Header>
            <Calendar.Grid>
              <Calendar.GridHeader>
                {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
              </Calendar.GridHeader>
              <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
            </Calendar.Grid>
            <Calendar.YearPickerGrid>
              <Calendar.YearPickerGridBody>
                {({ year }) => <Calendar.YearPickerCell year={year} />}
              </Calendar.YearPickerGridBody>
            </Calendar.YearPickerGrid>
          </Calendar>
        </DatePicker.Popover>
      </DatePicker>

      <NumberField
        isDisabled={recurrenceType === "ONE_OFF" || frequency === "ONCE"}
        maxValue={60}
        minValue={1}
        onChange={(value) => {
          onChange("monthsToGenerate", Number.isNaN(value) ? 1 : (value ?? 1));
        }}
        value={effectiveMonths}
      >
        <Label>Meses a generar</Label>
        <NumberField.Group className="grid-cols-1">
          <NumberField.Input />
        </NumberField.Group>
        {recurrenceType === "ONE_OFF" || frequency === "ONCE" ? (
          <Description>Para servicios puntuales se genera un único periodo</Description>
        ) : null}
      </NumberField>

      <NumberField
        maxValue={31}
        minValue={1}
        onChange={(value) => {
          onChange("dueDay", Number.isNaN(value) ? null : (value ?? null));
        }}
        value={dueDay == null ? Number.NaN : dueDay}
      >
        <Label>Día de vencimiento</Label>
        <NumberField.Group className="grid-cols-1">
          <NumberField.Input />
        </NumberField.Group>
      </NumberField>
    </section>
  );
}

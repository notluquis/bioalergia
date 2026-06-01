import {
  Calendar,
  DateField,
  DatePicker,
  DateRangePicker,
  Description,
  FieldError,
  Label,
  RangeCalendar,
} from "@heroui/react";
import { parseDate, parseDateTime } from "@internationalized/date";
import type { ComponentProps } from "react";

type DatePickerRootProps = ComponentProps<typeof DatePicker>;

interface AppDatePickerProps extends Omit<DatePickerRootProps, "value" | "onChange" | "children"> {
  label?: string;
  description?: string;
  errorMessage?: string;
  /** ISO date "YYYY-MM-DD" */
  value?: string | null;
  /** Returns ISO date "YYYY-MM-DD" or empty string if cleared */
  onChange?: (value: string) => void;
  className?: string;
}

/**
 * Plain date picker — replaces native <input type="date">.
 * Wraps HeroUI v3 DatePicker with sensible defaults so callers stay terse.
 * Value is exchanged as ISO YYYY-MM-DD strings (matches existing useState shapes).
 */
export function AppDatePicker({
  label,
  description,
  errorMessage,
  value,
  onChange,
  className,
  isInvalid,
  ...rest
}: AppDatePickerProps) {
  const cd = value ? safeParseDate(value) : null;

  return (
    <DatePicker
      {...rest}
      className={className}
      isInvalid={isInvalid ?? Boolean(errorMessage)}
      value={cd ?? undefined}
      onChange={(next) => {
        onChange?.(next ? next.toString() : "");
      }}
    >
      {label ? <Label>{label}</Label> : null}
      <DateField.Group>
        <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        <DateField.Suffix>
          <DatePicker.Trigger>
            <DatePicker.TriggerIndicator />
          </DatePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      {description ? <Description>{description}</Description> : null}
      {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
      <DatePicker.Popover>
        <Calendar aria-label={label ?? "Seleccionar fecha"}>
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
  );
}

interface AppDateTimePickerProps extends Omit<AppDatePickerProps, "value" | "onChange"> {
  /** ISO datetime "YYYY-MM-DDTHH:mm" (matches native datetime-local) */
  value?: string | null;
  onChange?: (value: string) => void;
}

/**
 * Date+time picker — replaces native <input type="datetime-local">.
 * Values are exchanged as "YYYY-MM-DDTHH:mm" strings.
 */
export function AppDateTimePicker({
  label,
  description,
  errorMessage,
  value,
  onChange,
  className,
  isInvalid,
  ...rest
}: AppDateTimePickerProps) {
  const cd = value ? safeParseDateTime(value) : null;

  return (
    <DatePicker
      {...rest}
      className={className}
      granularity="minute"
      hideTimeZone
      isInvalid={isInvalid ?? Boolean(errorMessage)}
      value={cd ?? undefined}
      onChange={(next) => {
        if (!next) {
          onChange?.("");
          return;
        }
        // CalendarDateTime#toString() returns "YYYY-MM-DDTHH:mm:ss"
        onChange?.(next.toString().slice(0, 16));
      }}
    >
      {label ? <Label>{label}</Label> : null}
      <DateField.Group>
        <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        <DateField.Suffix>
          <DatePicker.Trigger>
            <DatePicker.TriggerIndicator />
          </DatePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      {description ? <Description>{description}</Description> : null}
      {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
      <DatePicker.Popover>
        <Calendar aria-label={label ?? "Seleccionar fecha y hora"}>
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
  );
}

type DateRangePickerRootProps = ComponentProps<typeof DateRangePicker>;

interface AppDateRangePickerProps extends Omit<
  DateRangePickerRootProps,
  "value" | "onChange" | "children"
> {
  label?: string;
  description?: string;
  errorMessage?: string;
  /** ISO start date "YYYY-MM-DD" */
  startValue?: string | null;
  /** ISO end date "YYYY-MM-DD" */
  endValue?: string | null;
  /** Returns ISO "YYYY-MM-DD" strings ("" when cleared) */
  onChange?: (start: string, end: string) => void;
  className?: string;
  /** Months shown in the popover calendar. Default 1 (safe inside modals). */
  visibleMonths?: number;
}

/**
 * Date-range picker — one calendar, drag-select a from→end range.
 * Replaces the anti-pattern of two side-by-side single DatePickers ("Desde" +
 * "Hasta"). Value is exchanged as ISO YYYY-MM-DD strings (matches the existing
 * useState shapes). `max-w-none` on the popover keeps the calendar from
 * overflowing a narrow field (HeroUI 3.1 clamps it to trigger width).
 */
export function AppDateRangePicker({
  label,
  description,
  errorMessage,
  startValue,
  endValue,
  onChange,
  className,
  visibleMonths = 1,
  isInvalid,
  ...rest
}: AppDateRangePickerProps) {
  const start = startValue ? safeParseDate(startValue) : null;
  const end = endValue ? safeParseDate(endValue) : null;
  const value = start && end ? { end, start } : null;

  return (
    <DateRangePicker
      {...rest}
      className={className}
      isInvalid={isInvalid ?? Boolean(errorMessage)}
      value={value ?? undefined}
      onChange={(next) => {
        onChange?.(next ? next.start.toString() : "", next ? next.end.toString() : "");
      }}
    >
      {label ? <Label>{label}</Label> : null}
      <DateField.Group fullWidth>
        <DateField.InputContainer>
          <DateField.Input slot="start">
            {(segment) => <DateField.Segment segment={segment} />}
          </DateField.Input>
          <DateRangePicker.RangeSeparator />
          <DateField.Input slot="end">
            {(segment) => <DateField.Segment segment={segment} />}
          </DateField.Input>
        </DateField.InputContainer>
        <DateField.Suffix>
          <DateRangePicker.Trigger>
            <DateRangePicker.TriggerIndicator />
          </DateRangePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      {description ? <Description>{description}</Description> : null}
      {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
      <DateRangePicker.Popover className="max-w-none">
        <RangeCalendar
          aria-label={label ?? "Seleccionar rango de fechas"}
          visibleDuration={{ months: visibleMonths }}
        >
          <RangeCalendar.Header>
            <RangeCalendar.YearPickerTrigger>
              <RangeCalendar.YearPickerTriggerHeading />
              <RangeCalendar.YearPickerTriggerIndicator />
            </RangeCalendar.YearPickerTrigger>
            <RangeCalendar.NavButton slot="previous" />
            <RangeCalendar.NavButton slot="next" />
          </RangeCalendar.Header>
          <RangeCalendar.Grid>
            <RangeCalendar.GridHeader>
              {(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}
            </RangeCalendar.GridHeader>
            <RangeCalendar.GridBody>
              {(date) => <RangeCalendar.Cell date={date} />}
            </RangeCalendar.GridBody>
          </RangeCalendar.Grid>
          <RangeCalendar.YearPickerGrid>
            <RangeCalendar.YearPickerGridBody>
              {({ year }) => <RangeCalendar.YearPickerCell year={year} />}
            </RangeCalendar.YearPickerGridBody>
          </RangeCalendar.YearPickerGrid>
        </RangeCalendar>
      </DateRangePicker.Popover>
    </DateRangePicker>
  );
}

function safeParseDate(s: string) {
  try {
    return parseDate(s);
  } catch {
    return null;
  }
}

function safeParseDateTime(s: string) {
  try {
    // parseDateTime accepts "YYYY-MM-DDTHH:mm" and "YYYY-MM-DDTHH:mm:ss"
    return parseDateTime(s.length === 16 ? `${s}:00` : s);
  } catch {
    return null;
  }
}

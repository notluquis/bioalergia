import { Button, Chip, DateField, DateRangePicker, Label } from "@heroui/react";
import { parseDate } from "@internationalized/date";
import dayjs from "dayjs";
import { useMemo, useState } from "react";

import { DateRangeCalendar } from "@/components/ui/DateRangeCalendar";
import { ExpensePlaceholder } from "../components/ExpensePlaceholder";
import { FinancialSummaryCards } from "../components/FinancialSummaryCards";
import { IncomeBreakdown } from "../components/IncomeBreakdown";
import { useFinancialSummary } from "../hooks/useFinancialSummary";
import type { DateRange } from "../types";

export function FinancialDashboardPage() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: dayjs().startOf("month").format("YYYY-MM-DD"),
    to: dayjs().endOf("month").format("YYYY-MM-DD"),
  });

  const { summary, isLoading } = useFinancialSummary(dateRange);

  const handleDateChange = (field: keyof DateRange, value: string) => {
    setDateRange((prev) => ({ ...prev, [field]: value }));
  };

  const rangeValue = useMemo(
    () => ({
      start: parseDate(dateRange.from),
      end: parseDate(dateRange.to),
    }),
    [dateRange.from, dateRange.to],
  );

  return (
    <div className="space-y-8 p-6 md:p-8">
      {/* Header & Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-bold text-2xl tracking-tight">Tablero Financiero</h2>
          <p className="text-default-500 text-sm">
            Resumen de ingresos por tratamientos y gastos operativos.
          </p>
        </div>

        <DateRangePicker
          aria-label="Rango de fechas"
          className="w-full md:w-auto"
          onChange={(value) => {
            if (!value) {
              return;
            }
            handleDateChange("from", value.start.toString());
            handleDateChange("to", value.end.toString());
          }}
          value={rangeValue}
        >
          <Label>Rango de fechas</Label>
          <DateField.Group>
            <DateField.Input slot="start">
              {(segment) => <DateField.Segment segment={segment} />}
            </DateField.Input>
            <DateRangePicker.RangeSeparator />
            <DateField.Input slot="end">
              {(segment) => <DateField.Segment segment={segment} />}
            </DateField.Input>
            <DateField.Suffix>
              <DateRangePicker.Trigger>
                <DateRangePicker.TriggerIndicator />
              </DateRangePicker.Trigger>
            </DateField.Suffix>
          </DateField.Group>
          <DateRangePicker.Popover>
            <DateRangeCalendar visibleDuration={{ months: 2 }} />
          </DateRangePicker.Popover>
        </DateRangePicker>
      </div>

      {/* Summary Cards */}
      <FinancialSummaryCards summary={summary} isLoading={isLoading} />

      {/* Main Content: Incomes vs Expenses */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left: Income Breakdown (2/3 width) */}
        <div className="space-y-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-xl">Desglose de Ingresos</h2>
            <Chip color="success" variant="soft">
              Desde Calendario
            </Chip>
          </div>
          <IncomeBreakdown summary={summary} isLoading={isLoading} />
        </div>

        {/* Right: Expenses (1/3 width) */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-xl">Gastos</h2>
            <Button size="sm" variant="ghost">
              + Nuevo Gasto
            </Button>
          </div>
          <ExpensePlaceholder />
        </div>
      </div>
    </div>
  );
}

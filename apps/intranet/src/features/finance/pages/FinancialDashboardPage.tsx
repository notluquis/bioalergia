import { endOfMonth, startOfMonth } from "@/lib/dates";
import { Button, Chip } from "@heroui/react";
import { useState } from "react";
import { AppDateRangePicker } from "@/components/forms/AppDatePicker";

import { ExpensePlaceholder } from "../components/ExpensePlaceholder";
import { FinancialSummaryCards } from "../components/FinancialSummaryCards";
import { IncomeBreakdown } from "../components/IncomeBreakdown";
import { useFinancialSummary } from "../hooks/useFinancialSummary";
import type { DateRange } from "../types";

export function FinancialDashboardPage() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(),
    to: endOfMonth(),
  });

  const { summary, isLoading } = useFinancialSummary(dateRange);

  return (
    <div className="space-y-8 p-6 md:p-8">
      {/* Header & Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p className="text-default-500 text-sm">
          Resumen de ingresos por tratamientos y gastos operativos.
        </p>

        <AppDateRangePicker
          label="Rango de fechas"
          className="w-full md:w-auto"
          visibleMonths={2}
          startValue={dateRange.from}
          endValue={dateRange.to}
          onChange={(start, end) => {
            if (!start || !end) {
              return;
            }
            setDateRange({ from: start, to: end });
          }}
        />
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
            <Button size="sm" variant="outline">
              + Nuevo Gasto
            </Button>
          </div>
          <ExpensePlaceholder />
        </div>
      </div>
    </div>
  );
}

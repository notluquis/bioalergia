import { Button, Chip, Input, TextField } from "@heroui/react";
import dayjs from "dayjs";
import { useState } from "react";

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

  return (
    <div className="space-y-8 p-6 md:p-8">
      {/* Header & Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tablero Financiero</h1>
          <p className="text-base-content/60 text-sm">
            Resumen de ingresos por tratamientos y gastos operativos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <TextField aria-label="Desde">
            <Input
              type="date"
              value={dateRange.from}
              onChange={(e) => handleDateChange("from", e.target.value)}
            />
          </TextField>
          <span className="text-base-content/50 text-sm">ha</span>
          <TextField aria-label="Hasta">
            <Input
              type="date"
              value={dateRange.to}
              onChange={(e) => handleDateChange("to", e.target.value)}
            />
          </TextField>
        </div>
      </div>

      {/* Summary Cards */}
      <FinancialSummaryCards summary={summary} isLoading={isLoading} />

      {/* Main Content: Incomes vs Expenses */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left: Income Breakdown (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Desglose de Ingresos</h2>
            <Chip color="success" variant="soft">
              Desde Calendario
            </Chip>
          </div>
          <IncomeBreakdown summary={summary} isLoading={isLoading} />
        </div>

        {/* Right: Expenses (1/3 width) */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Gastos</h2>
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

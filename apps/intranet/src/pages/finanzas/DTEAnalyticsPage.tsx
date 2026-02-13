import { Card, Tabs } from "@heroui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { BarChart3, TrendingUp } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Select, SelectItem } from "@/components/ui/Select";
import { dteAnalyticsKeys } from "@/features/finance/dte-analytics/queries";
import type {
  ComparisonChartData,
  MonthlyChartData,
  MonthlySummaryProps,
  YearlyTotals,
} from "@/features/finance/dte-analytics/types";
import { CHART_COLORS } from "@/features/finance/dte-analytics/types";
import {
  buildComparisonChartData,
  buildMonthlyChartData,
  calculateYearlyTotals,
  extractYearsFromSummary,
  formatCurrency,
  formatCurrencyCompact,
  formatNumber,
  safeYearSelection,
} from "@/features/finance/dte-analytics/utils";

export function DTEAnalyticsPage() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());

  // Load all purchases and sales data to extract years with actual data
  const { data: allPurchases } = useSuspenseQuery(dteAnalyticsKeys.purchases());
  const { data: allSales } = useSuspenseQuery(dteAnalyticsKeys.sales());

  // Extract years from data and combine
  const yearOptions = useMemo(() => {
    const purchaseYears = extractYearsFromSummary(allPurchases);
    const salesYears = extractYearsFromSummary(allSales);
    // Combine and deduplicate
    const allYears = new Set([...purchaseYears, ...salesYears]);
    return Array.from(allYears).sort().reverse();
  }, [allPurchases, allSales]);

  // Ensure selected year is always valid
  const validatedYear = useMemo(
    () => safeYearSelection(selectedYear, yearOptions),
    [selectedYear, yearOptions],
  );

  return (
    <div className="container mx-auto space-y-6 p-6">
      <Tabs aria-label="DTE Analytics Tabs" defaultSelectedKey="purchases-monthly">
        <Tabs.List
          aria-label="Opciones de visualización"
          className="rounded-lg bg-default-50/50 p-1"
        >
          <Tabs.Tab id="purchases-monthly" className="gap-2">
            <BarChart3 className="size-4" />
            Compras Mensual
          </Tabs.Tab>
          <Tabs.Tab id="sales-monthly" className="gap-2">
            <BarChart3 className="size-4" />
            Ventas Mensual
          </Tabs.Tab>
          <Tabs.Tab id="purchases-comparison" className="gap-2">
            <TrendingUp className="size-4" />
            Compras Comparativa
          </Tabs.Tab>
          <Tabs.Tab id="sales-comparison" className="gap-2">
            <TrendingUp className="size-4" />
            Ventas Comparativa
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel id="purchases-monthly">
          <PurchasesMonthlySummary
            selectedYear={validatedYear}
            setSelectedYear={setSelectedYear}
            yearOptions={yearOptions}
          />
        </Tabs.Panel>

        <Tabs.Panel id="sales-monthly">
          <SalesMonthlySummary
            selectedYear={validatedYear}
            setSelectedYear={setSelectedYear}
            yearOptions={yearOptions}
          />
        </Tabs.Panel>

        <Tabs.Panel id="purchases-comparison">
          <PurchasesComparison />
        </Tabs.Panel>

        <Tabs.Panel id="sales-comparison">
          <SalesComparison />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

/**
 * Monthly summary component for purchases
 * Shows single year with bar chart and KPI cards
 */
function PurchasesMonthlySummary({
  selectedYear,
  setSelectedYear,
  yearOptions,
}: MonthlySummaryProps) {
  const { data: summary } = useSuspenseQuery(dteAnalyticsKeys.purchases(Number(selectedYear)));

  // Build typed chart data
  const chartData = useMemo<MonthlyChartData[]>(
    () => buildMonthlyChartData(summary, selectedYear),
    [summary, selectedYear],
  );

  // Calculate totals from chart data
  const totals = useMemo<YearlyTotals>(() => calculateYearlyTotals(chartData), [chartData]);

  // Callback for year selection with type safety
  const handleYearChange = useCallback(
    (key: string | number | null) => {
      if (key && typeof key === "string") {
        setSelectedYear(key);
      }
    },
    [setSelectedYear],
  );

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center gap-4">
        <Select
          label="Año"
          placeholder="Seleccionar año"
          value={selectedYear}
          onChange={handleYearChange}
        >
          {yearOptions.map((year) => (
            <SelectItem key={year} id={year}>
              {year}
            </SelectItem>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <Card>
          <Card.Header>
            <Card.Title className="text-sm">Total Compras</Card.Title>
          </Card.Header>
          <Card.Content>
            <span className="font-bold text-2xl">{formatCurrency(totals.totalAmount)}</span>
          </Card.Content>
        </Card>
        <Card>
          <Card.Header>
            <Card.Title className="text-sm">Exento</Card.Title>
          </Card.Header>
          <Card.Content>
            <span className="font-bold text-2xl">{formatCurrency(totals.exemptAmount)}</span>
          </Card.Content>
        </Card>
        <Card>
          <Card.Header>
            <Card.Title className="text-sm">Neto</Card.Title>
          </Card.Header>
          <Card.Content>
            <span className="font-bold text-2xl">{formatCurrency(totals.netAmount)}</span>
          </Card.Content>
        </Card>
        <Card>
          <Card.Header>
            <Card.Title className="text-sm">IVA Recuperable</Card.Title>
          </Card.Header>
          <Card.Content>
            <span className="font-bold text-2xl">{formatCurrency(totals.taxAmount)}</span>
          </Card.Content>
        </Card>
        <Card>
          <Card.Header>
            <Card.Title className="text-sm">Documentos</Card.Title>
          </Card.Header>
          <Card.Content>
            <span className="font-bold text-2xl">{formatNumber(totals.count)}</span>
          </Card.Content>
        </Card>
      </div>

      <Card>
        <Card.Header>
          <Card.Title>Compras Mensuales {selectedYear} (Exento + Neto + IVA)</Card.Title>
        </Card.Header>
        <Card.Content>
          <ResponsiveContainer height={400} width="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={formatCurrencyCompact} />
              <Tooltip
                formatter={(value: number | undefined) =>
                  value !== undefined ? formatCurrency(value) : "N/A"
                }
                labelStyle={{ color: "#000" }}
                contentStyle={{ backgroundColor: "#fff" }}
              />
              <Legend />
              <Bar dataKey="exemptAmount" stackId="total" fill="#8b5cf6" name="Exento" />
              <Bar dataKey="netAmount" stackId="total" fill="#10b981" name="Neto" />
              <Bar dataKey="taxAmount" stackId="total" fill="#f59e0b" name="IVA" />
            </BarChart>
          </ResponsiveContainer>
        </Card.Content>
      </Card>
    </div>
  );
}

/**
 * Monthly summary component for sales
 * Mirrors purchases component with sales data
 */
function SalesMonthlySummary({ selectedYear, setSelectedYear, yearOptions }: MonthlySummaryProps) {
  const { data: summary } = useSuspenseQuery(dteAnalyticsKeys.sales(Number(selectedYear)));

  const chartData = useMemo<MonthlyChartData[]>(
    () => buildMonthlyChartData(summary, selectedYear),
    [summary, selectedYear],
  );

  const totals = useMemo<YearlyTotals>(() => calculateYearlyTotals(chartData), [chartData]);

  const handleYearChange = useCallback(
    (key: string | number | null) => {
      if (key && typeof key === "string") {
        setSelectedYear(key);
      }
    },
    [setSelectedYear],
  );

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center gap-4">
        <Select
          label="Año"
          placeholder="Seleccionar año"
          value={selectedYear}
          onChange={handleYearChange}
        >
          {yearOptions.map((year) => (
            <SelectItem key={year} id={year}>
              {year}
            </SelectItem>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <Card>
          <Card.Header>
            <Card.Title className="text-sm">Total Ventas</Card.Title>
          </Card.Header>
          <Card.Content>
            <span className="font-bold text-2xl">{formatCurrency(totals.totalAmount)}</span>
          </Card.Content>
        </Card>
        <Card>
          <Card.Header>
            <Card.Title className="text-sm">Exento</Card.Title>
          </Card.Header>
          <Card.Content>
            <span className="font-bold text-2xl">{formatCurrency(totals.exemptAmount)}</span>
          </Card.Content>
        </Card>
        <Card>
          <Card.Header>
            <Card.Title className="text-sm">Neto</Card.Title>
          </Card.Header>
          <Card.Content>
            <span className="font-bold text-2xl">{formatCurrency(totals.netAmount)}</span>
          </Card.Content>
        </Card>
        <Card>
          <Card.Header>
            <Card.Title className="text-sm">IVA</Card.Title>
          </Card.Header>
          <Card.Content>
            <span className="font-bold text-2xl">{formatCurrency(totals.taxAmount)}</span>
          </Card.Content>
        </Card>
        <Card>
          <Card.Header>
            <Card.Title className="text-sm">Documentos</Card.Title>
          </Card.Header>
          <Card.Content>
            <span className="font-bold text-2xl">{formatNumber(totals.count)}</span>
          </Card.Content>
        </Card>
      </div>

      <Card>
        <Card.Header>
          <Card.Title>Ventas Mensuales {selectedYear} (Exento + Neto + IVA)</Card.Title>
        </Card.Header>
        <Card.Content>
          <ResponsiveContainer height={400} width="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={formatCurrencyCompact} />
              <Tooltip
                formatter={(value: number | undefined) =>
                  value !== undefined ? formatCurrency(value) : "N/A"
                }
                labelStyle={{ color: "#000" }}
                contentStyle={{ backgroundColor: "#fff" }}
              />
              <Legend />
              <Bar dataKey="exemptAmount" stackId="total" fill="#8b5cf6" name="Exento" />
              <Bar dataKey="netAmount" stackId="total" fill="#10b981" name="Neto" />
              <Bar dataKey="taxAmount" stackId="total" fill="#f59e0b" name="IVA" />
            </BarChart>
          </ResponsiveContainer>
        </Card.Content>
      </Card>
    </div>
  );
}

/**
 * Multi-year comparison component for purchases
 * Shows LineChart with all years on same axis
 */
function PurchasesComparison() {
  const { data: summary } = useSuspenseQuery(dteAnalyticsKeys.purchases());

  const chartData = useMemo<ComparisonChartData[]>(
    () => buildComparisonChartData(summary),
    [summary],
  );

  const years = useMemo<string[]>(() => extractYearsFromSummary(summary), [summary]);

  return (
    <div className="space-y-4 pt-4">
      <Card>
        <Card.Header>
          <Card.Title>Comparación de Compras (Todos los Años)</Card.Title>
        </Card.Header>
        <Card.Content>
          <ResponsiveContainer height={400} width="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={formatCurrencyCompact} />
              <Tooltip
                formatter={(value: number | undefined) =>
                  value !== undefined ? formatCurrency(value) : "N/A"
                }
                labelStyle={{ color: "#000" }}
              />
              <Legend />
              {years.map((year, idx) => (
                <Line
                  key={year}
                  dataKey={year}
                  stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                  name={year}
                  dot
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Card.Content>
      </Card>
    </div>
  );
}

/**
 * Multi-year comparison component for sales
 * Mirrors purchases comparison with sales data
 */
function SalesComparison() {
  const { data: summary } = useSuspenseQuery(dteAnalyticsKeys.sales());

  const chartData = useMemo<ComparisonChartData[]>(
    () => buildComparisonChartData(summary),
    [summary],
  );

  const years = useMemo<string[]>(() => extractYearsFromSummary(summary), [summary]);

  return (
    <div className="space-y-4 pt-4">
      <Card>
        <Card.Header>
          <Card.Title>Comparación de Ventas (Todos los Años)</Card.Title>
        </Card.Header>
        <Card.Content>
          <ResponsiveContainer height={400} width="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={formatCurrencyCompact} />
              <Tooltip
                formatter={(value: number | undefined) =>
                  value !== undefined ? formatCurrency(value) : "N/A"
                }
                labelStyle={{ color: "#000" }}
              />
              <Legend />
              {years.map((year, idx) => (
                <Line
                  key={year}
                  dataKey={year}
                  stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                  name={year}
                  dot
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Card.Content>
      </Card>
    </div>
  );
}

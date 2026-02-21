import { Card, Label, ListBox, Select } from "@heroui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { dteAnalyticsKeys } from "@/features/finance/dte-analytics/queries";
import type { MonthlyChartData, YearlyTotals } from "@/features/finance/dte-analytics/types";
import {
  buildMonthlyChartData,
  calculateYearlyTotals,
  formatCurrency,
  formatCurrencyCompact,
  formatNumber,
} from "@/features/finance/dte-analytics/utils";

type DteMonthlySummaryPanelProps = {
  kind: "purchases" | "sales";
  selectedYear: string;
  setSelectedYear: (year: string) => void;
  yearOptions: string[];
};

export function DteMonthlySummaryPanel({
  kind,
  selectedYear,
  setSelectedYear,
  yearOptions,
}: DteMonthlySummaryPanelProps) {
  const { data: summary } = useSuspenseQuery(
    kind === "purchases"
      ? dteAnalyticsKeys.purchases(Number(selectedYear))
      : dteAnalyticsKeys.sales(Number(selectedYear)),
  );

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

  const labels =
    kind === "purchases"
      ? {
          docs: "Documentos",
          netTax: "IVA Recuperable",
          title: `Compras Mensuales ${selectedYear} (Exento + Neto + IVA)`,
          total: "Total Compras",
        }
      : {
          docs: "Documentos",
          netTax: "IVA",
          title: `Ventas Mensuales ${selectedYear} (Exento + Neto + IVA)`,
          total: "Total Ventas",
        };

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center gap-4">
        <Select placeholder="Seleccionar año" value={selectedYear} onChange={handleYearChange}>
          <Label>Año</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {yearOptions.map((year) => (
                <ListBox.Item key={year} id={year}>
                  {year}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <Card>
          <Card.Header>
            <Card.Title className="text-sm">{labels.total}</Card.Title>
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
            <Card.Title className="text-sm">{labels.netTax}</Card.Title>
          </Card.Header>
          <Card.Content>
            <span className="font-bold text-2xl">{formatCurrency(totals.taxAmount)}</span>
          </Card.Content>
        </Card>
        <Card>
          <Card.Header>
            <Card.Title className="text-sm">{labels.docs}</Card.Title>
          </Card.Header>
          <Card.Content>
            <span className="font-bold text-2xl">{formatNumber(totals.count)}</span>
          </Card.Content>
        </Card>
      </div>

      <Card>
        <Card.Header>
          <Card.Title>{labels.title}</Card.Title>
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

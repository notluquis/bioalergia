// design-lint-ignore-file: hardcoded-hex
// TODO(2026-Q3): migrate inline chart fill hex values to useChartPalette().
import { Card, Description, Label, ListBox, Select, Surface } from "@heroui/react";
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
import {
  CHART_THEME,
  type MonthlyChartData,
  type YearlyTotals,
} from "@/features/finance/dte-analytics/types";
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
  const selectedYearNumber = useMemo(() => {
    if (!/^\d{4}$/.test(selectedYear)) {
      return undefined;
    }
    const parsed = Number(selectedYear);
    return Number.isFinite(parsed) ? parsed : undefined;
  }, [selectedYear]);

  const { data: summary } = useSuspenseQuery(
    kind === "purchases"
      ? dteAnalyticsKeys.purchases(selectedYearNumber)
      : dteAnalyticsKeys.sales(selectedYearNumber)
  );

  const chartData = useMemo<MonthlyChartData[]>(
    () => buildMonthlyChartData(summary, selectedYear),
    [summary, selectedYear]
  );

  const totals = useMemo<YearlyTotals>(() => calculateYearlyTotals(chartData), [chartData]);

  const handleYearChange = useCallback(
    (key: string | number | null) => {
      if (key && typeof key === "string") {
        setSelectedYear(key);
      }
    },
    [setSelectedYear]
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
      <Surface className="flex items-center gap-4 rounded-2xl p-3" variant="secondary">
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
      </Surface>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <Card variant="secondary">
          <Card.Header>
            <Card.Title className="text-sm">{labels.total}</Card.Title>
          </Card.Header>
          <Card.Content>
            <span className="font-bold text-2xl">{formatCurrency(totals.totalAmount)}</span>
          </Card.Content>
        </Card>
        <Card variant="secondary">
          <Card.Header>
            <Card.Title className="text-sm">Exento</Card.Title>
          </Card.Header>
          <Card.Content>
            <span className="font-bold text-2xl">{formatCurrency(totals.exemptAmount)}</span>
          </Card.Content>
        </Card>
        <Card variant="secondary">
          <Card.Header>
            <Card.Title className="text-sm">Neto</Card.Title>
          </Card.Header>
          <Card.Content>
            <span className="font-bold text-2xl">{formatCurrency(totals.netAmount)}</span>
          </Card.Content>
        </Card>
        <Card variant="secondary">
          <Card.Header>
            <Card.Title className="text-sm">{labels.netTax}</Card.Title>
          </Card.Header>
          <Card.Content>
            <span className="font-bold text-2xl">{formatCurrency(totals.taxAmount)}</span>
          </Card.Content>
        </Card>
        <Card variant="secondary">
          <Card.Header>
            <Card.Title className="text-sm">{labels.docs}</Card.Title>
          </Card.Header>
          <Card.Content>
            <span className="font-bold text-2xl">{formatNumber(totals.count)}</span>
          </Card.Content>
        </Card>
      </div>

      <Card variant="secondary">
        <Card.Header>
          <Card.Title>{labels.title}</Card.Title>
          <Card.Description>
            Serie apilada con escala monetaria y colores consistentes para DTE analytics.
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <ResponsiveContainer height={400} width="100%">
            <BarChart data={chartData}>
              <CartesianGrid stroke={CHART_THEME.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" stroke={CHART_THEME.axis} tickLine={false} axisLine={false} />
              <YAxis
                axisLine={false}
                niceTicks="auto"
                stroke={CHART_THEME.axis}
                tickFormatter={formatCurrencyCompact}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: CHART_THEME.tooltipBackground,
                  border: `1px solid ${CHART_THEME.tooltipBorder}`,
                  borderRadius: 16,
                  boxShadow: "0 18px 48px rgba(15, 23, 42, 0.28)",
                }}
                formatter={(value) => (typeof value === "number" ? formatCurrency(value) : "N/A")}
                itemStyle={{ color: CHART_THEME.tooltipValue }}
                labelStyle={{ color: CHART_THEME.tooltipLabel, fontWeight: 600 }}
                cursor={{ fill: "rgba(148, 163, 184, 0.12)" }}
              />
              <Legend wrapperStyle={{ color: CHART_THEME.legend, paddingTop: 12 }} />
              <Bar
                dataKey="exemptAmount"
                stackId="total"
                fill="#3b82f6"
                name="Exento"
                radius={[6, 6, 0, 0]}
              />
              <Bar
                dataKey="netAmount"
                stackId="total"
                fill="#10b981"
                name="Neto"
                radius={[6, 6, 0, 0]}
              />
              <Bar
                dataKey="taxAmount"
                stackId="total"
                fill="#f59e0b"
                name="IVA"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
          <Description className="mt-3 text-xs">
            Totales expresados en CLP. La leyenda y tooltip usan la misma jerarquía visual en todas
            las vistas comparativas.
          </Description>
        </Card.Content>
      </Card>
    </div>
  );
}

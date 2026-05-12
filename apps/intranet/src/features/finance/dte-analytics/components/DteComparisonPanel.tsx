import { Card, Description } from "@heroui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { dteAnalyticsKeys } from "@/features/finance/dte-analytics/queries";
import { CHART_COLORS, CHART_THEME } from "@/features/finance/dte-analytics/types";
import {
  buildComparisonChartData,
  extractYearsFromSummary,
  formatCurrency,
  formatCurrencyCompact,
} from "@/features/finance/dte-analytics/utils";

type DteComparisonPanelProps = {
  kind: "purchases" | "sales";
};

export function DteComparisonPanel({ kind }: DteComparisonPanelProps) {
  const { data: summary } = useSuspenseQuery(
    kind === "purchases" ? dteAnalyticsKeys.purchases() : dteAnalyticsKeys.sales()
  );

  const chartData = useMemo(() => buildComparisonChartData(summary), [summary]);
  const years = useMemo(() => extractYearsFromSummary(summary), [summary]);

  const title =
    kind === "purchases"
      ? "Comparación de Compras (Todos los Años)"
      : "Comparación de Ventas (Todos los Años)";

  return (
    <div className="space-y-4 pt-4">
      <Card variant="secondary">
        <Card.Header>
          <Card.Title>{title}</Card.Title>
          <Card.Description>
            Comparación multi-año con escala compartida y estados visuales consistentes.
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <ResponsiveContainer height={400} width="100%">
            <LineChart data={chartData}>
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
                cursor={{ stroke: "rgba(148, 163, 184, 0.35)", strokeWidth: 1 }}
              />
              <Legend wrapperStyle={{ color: CHART_THEME.legend, paddingTop: 12 }} />
              {years.map((year, idx) => (
                <Line
                  key={year}
                  dataKey={year}
                  activeDot={{ r: 5 }}
                  stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  name={year}
                  dot
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <Description className="mt-3 text-xs">
            Cada línea representa un año distinto y comparte la misma convención de tooltip y
            contraste que el resumen mensual.
          </Description>
        </Card.Content>
      </Card>
    </div>
  );
}

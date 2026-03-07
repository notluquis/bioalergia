import { Card } from "@heroui/react";
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
import { CHART_COLORS } from "@/features/finance/dte-analytics/types";
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
    kind === "purchases" ? dteAnalyticsKeys.purchases() : dteAnalyticsKeys.sales(),
  );

  const chartData = useMemo(() => buildComparisonChartData(summary), [summary]);
  const years = useMemo(() => extractYearsFromSummary(summary), [summary]);

  const title =
    kind === "purchases"
      ? "Comparación de Compras (Todos los Años)"
      : "Comparación de Ventas (Todos los Años)";

  return (
    <div className="space-y-4 pt-4">
      <Card>
        <Card.Header>
          <Card.Title>{title}</Card.Title>
        </Card.Header>
        <Card.Content>
          <ResponsiveContainer height={400} width="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis niceTicks="auto" tickFormatter={formatCurrencyCompact} />
              <Tooltip
                formatter={(value) => (typeof value === "number" ? formatCurrency(value) : "N/A")}
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

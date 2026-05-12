import { Card, Label, ListBox, Select, Surface } from "@heroui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
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

import { doctoraliaAnalyticsKeys } from "@/features/doctoralia/analytics/queries";
import {
  DOCTORALIA_CHART_THEME,
  DOCTORALIA_COMPARISON_LINE_COLORS,
  DOCTORALIA_METRIC_LABELS,
  type DoctoraliaMetricKey,
} from "@/features/doctoralia/analytics/types";
import {
  buildDoctoraliaComparisonChartData,
  extractDoctoraliaYearsFromSummary,
  formatDoctoraliaNumber,
} from "@/features/doctoralia/analytics/utils";

type DoctoraliaComparisonPanelProps = {
  metric: DoctoraliaMetricKey;
  setMetric: (metric: DoctoraliaMetricKey) => void;
};

const METRIC_OPTIONS: readonly DoctoraliaMetricKey[] = [
  "total",
  "programmed",
  "cancelled",
  "attended",
] as const;

function isDoctoraliaMetricKey(value: string): value is DoctoraliaMetricKey {
  return (METRIC_OPTIONS as readonly string[]).includes(value);
}

export function DoctoraliaComparisonPanel({ metric, setMetric }: DoctoraliaComparisonPanelProps) {
  const { data: summary } = useSuspenseQuery(doctoraliaAnalyticsKeys.monthlySummary());

  const chartData = useMemo(
    () => buildDoctoraliaComparisonChartData(summary, metric),
    [summary, metric]
  );
  const years = useMemo(() => extractDoctoraliaYearsFromSummary(summary), [summary]);

  const handleMetricChange = useCallback(
    (key: string | number | null) => {
      if (key && typeof key === "string" && isDoctoraliaMetricKey(key)) {
        setMetric(key);
      }
    },
    [setMetric]
  );

  return (
    <div className="space-y-4 pt-4">
      <Surface className="flex items-center gap-4 rounded-2xl p-3" variant="secondary">
        <Select placeholder="Métrica" value={metric} onChange={handleMetricChange}>
          <Label>Métrica</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {METRIC_OPTIONS.map((option) => (
                <ListBox.Item key={option} id={option}>
                  {DOCTORALIA_METRIC_LABELS[option]}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </Surface>

      <Card variant="secondary">
        <Card.Header>
          <Card.Title>{`Comparativa multi-año — ${DOCTORALIA_METRIC_LABELS[metric]}`}</Card.Title>
          <Card.Description>
            Cada línea es un año. Basado en calendar appointments agrupados por fecha de la cita
            (startAt).
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <ResponsiveContainer height={400} width="100%">
            <LineChart data={chartData}>
              <CartesianGrid
                stroke={DOCTORALIA_CHART_THEME.grid}
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                stroke={DOCTORALIA_CHART_THEME.axis}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                axisLine={false}
                stroke={DOCTORALIA_CHART_THEME.axis}
                tickFormatter={formatDoctoraliaNumber}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: DOCTORALIA_CHART_THEME.tooltipBackground,
                  border: `1px solid ${DOCTORALIA_CHART_THEME.tooltipBorder}`,
                  borderRadius: 16,
                  boxShadow: "0 18px 48px rgba(15, 23, 42, 0.28)",
                }}
                formatter={(value) =>
                  typeof value === "number" ? formatDoctoraliaNumber(value) : "N/A"
                }
                itemStyle={{ color: DOCTORALIA_CHART_THEME.tooltipValue }}
                labelStyle={{ color: DOCTORALIA_CHART_THEME.tooltipLabel, fontWeight: 600 }}
                cursor={{ stroke: "rgba(148, 163, 184, 0.35)", strokeWidth: 1 }}
              />
              <Legend wrapperStyle={{ color: DOCTORALIA_CHART_THEME.legend, paddingTop: 12 }} />
              {years.map((year, idx) => (
                <Line
                  key={year}
                  dataKey={year}
                  activeDot={{ r: 5 }}
                  stroke={
                    DOCTORALIA_COMPARISON_LINE_COLORS[
                      idx % DOCTORALIA_COMPARISON_LINE_COLORS.length
                    ]
                  }
                  strokeLinecap="round"
                  strokeLinejoin="round"
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

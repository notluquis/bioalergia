import { Card, Description, Label, ListBox, Select, Surface } from "@heroui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { doctoraliaAnalyticsKeys } from "@/features/doctoralia/analytics/queries";
import {
  DOCTORALIA_CHART_COLORS,
  DOCTORALIA_CHART_THEME,
  type DoctoraliaMonthlyChartDatum,
  type DoctoraliaYearlyTotals,
} from "@/features/doctoralia/analytics/types";
import {
  buildDoctoraliaMonthlyChartData,
  calculateDoctoraliaYearlyTotals,
  formatDoctoraliaNumber,
  formatDoctoraliaPercent,
} from "@/features/doctoralia/analytics/utils";

type DoctoraliaMonthlyPanelProps = {
  selectedYear: string;
  setSelectedYear: (year: string) => void;
  yearOptions: string[];
};

export function DoctoraliaMonthlyPanel({
  selectedYear,
  setSelectedYear,
  yearOptions,
}: DoctoraliaMonthlyPanelProps) {
  const selectedYearNumber = useMemo(() => {
    if (!/^\d{4}$/.test(selectedYear)) return undefined;
    const parsed = Number(selectedYear);
    return Number.isFinite(parsed) ? parsed : undefined;
  }, [selectedYear]);

  const { data: summary } = useSuspenseQuery(
    doctoraliaAnalyticsKeys.monthlySummary(selectedYearNumber)
  );

  const chartData = useMemo<DoctoraliaMonthlyChartDatum[]>(
    () => buildDoctoraliaMonthlyChartData(summary, selectedYear),
    [summary, selectedYear]
  );

  const totals = useMemo<DoctoraliaYearlyTotals>(
    () => calculateDoctoraliaYearlyTotals(chartData),
    [chartData]
  );

  const handleYearChange = useCallback(
    (key: string | number | null) => {
      if (key && typeof key === "string") setSelectedYear(key);
    },
    [setSelectedYear]
  );

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
            <Card.Title className="text-sm">Total</Card.Title>
          </Card.Header>
          <Card.Content>
            <span className="font-bold text-2xl">{formatDoctoraliaNumber(totals.total)}</span>
          </Card.Content>
        </Card>
        <Card variant="secondary">
          <Card.Header>
            <Card.Title className="text-sm">Programadas</Card.Title>
          </Card.Header>
          <Card.Content>
            <span className="font-bold text-2xl">{formatDoctoraliaNumber(totals.programmed)}</span>
          </Card.Content>
        </Card>
        <Card variant="secondary">
          <Card.Header>
            <Card.Title className="text-sm">Atendidas</Card.Title>
          </Card.Header>
          <Card.Content>
            <span className="font-bold text-2xl">{formatDoctoraliaNumber(totals.attended)}</span>
          </Card.Content>
        </Card>
        <Card variant="secondary">
          <Card.Header>
            <Card.Title className="text-sm">Canceladas</Card.Title>
          </Card.Header>
          <Card.Content>
            <span className="font-bold text-2xl">{formatDoctoraliaNumber(totals.cancelled)}</span>
          </Card.Content>
        </Card>
        <Card variant="secondary">
          <Card.Header>
            <Card.Title className="text-sm">No-show</Card.Title>
          </Card.Header>
          <Card.Content>
            <span className="font-bold text-2xl">{formatDoctoraliaNumber(totals.noShow)}</span>
          </Card.Content>
        </Card>
      </div>

      <Card variant="secondary">
        <Card.Header>
          <Card.Title>{`Citas Mensuales ${selectedYear} (Programadas + Atendidas + Canceladas + No-show)`}</Card.Title>
          <Card.Description>
            Serie apilada por estado de la cita con línea de tasa de cancelación en eje secundario.
            Basado en <strong>calendar appointments</strong> agrupados por fecha de la cita
            (startAt).
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <ResponsiveContainer height={400} width="100%">
            <ComposedChart data={chartData}>
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
                yAxisId="counts"
                axisLine={false}
                stroke={DOCTORALIA_CHART_THEME.axis}
                tickFormatter={formatDoctoraliaNumber}
                tickLine={false}
              />
              <YAxis
                yAxisId="rate"
                axisLine={false}
                orientation="right"
                stroke={DOCTORALIA_CHART_COLORS.cancellationRate}
                tickFormatter={(value) =>
                  typeof value === "number" ? formatDoctoraliaPercent(value) : ""
                }
                tickLine={false}
                domain={[0, "auto"]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: DOCTORALIA_CHART_THEME.tooltipBackground,
                  border: `1px solid ${DOCTORALIA_CHART_THEME.tooltipBorder}`,
                  borderRadius: 16,
                  boxShadow: "0 18px 48px rgba(15, 23, 42, 0.28)",
                }}
                formatter={(value, name) => {
                  if (typeof value !== "number") return "N/A";
                  if (name === "Tasa de cancelación") return formatDoctoraliaPercent(value);
                  return formatDoctoraliaNumber(value);
                }}
                itemStyle={{ color: DOCTORALIA_CHART_THEME.tooltipValue }}
                labelStyle={{ color: DOCTORALIA_CHART_THEME.tooltipLabel, fontWeight: 600 }}
                cursor={{ fill: "rgba(148, 163, 184, 0.12)" }}
              />
              <Legend wrapperStyle={{ color: DOCTORALIA_CHART_THEME.legend, paddingTop: 12 }} />
              <Bar
                yAxisId="counts"
                dataKey="programmed"
                stackId="total"
                fill={DOCTORALIA_CHART_COLORS.programmed}
                name="Programadas"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                yAxisId="counts"
                dataKey="attended"
                stackId="total"
                fill={DOCTORALIA_CHART_COLORS.attended}
                name="Atendidas"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                yAxisId="counts"
                dataKey="cancelled"
                stackId="total"
                fill={DOCTORALIA_CHART_COLORS.cancelled}
                name="Canceladas"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                yAxisId="counts"
                dataKey="noShow"
                stackId="total"
                fill={DOCTORALIA_CHART_COLORS.noShow}
                name="No-show"
                radius={[6, 6, 0, 0]}
              />
              <Line
                yAxisId="rate"
                type="monotone"
                dataKey="cancellationRate"
                stroke={DOCTORALIA_CHART_COLORS.cancellationRate}
                strokeWidth={2}
                dot={{ r: 3, fill: DOCTORALIA_CHART_COLORS.cancellationRate }}
                activeDot={{ r: 5 }}
                name="Tasa de cancelación"
              />
            </ComposedChart>
          </ResponsiveContainer>
          <Description className="mt-3 text-xs">
            Tasa de cancelación = canceladas / total del mes. La línea usa el eje derecho.
          </Description>
        </Card.Content>
      </Card>
    </div>
  );
}

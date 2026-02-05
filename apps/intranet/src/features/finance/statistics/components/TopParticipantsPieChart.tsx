/**
 * Top Participants Pie Chart - Recharts Implementation
 */

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { fmtCLP } from "@/lib/format";

import type { TopParticipantData } from "../types";

interface TopParticipantsPieChartProps {
  data: TopParticipantData[];
}

const COLORS = [
  "hsl(var(--p))", // primary
  "hsl(var(--s))", // secondary
  "hsl(var(--a))", // accent
  "hsl(var(--su))", // success
  "hsl(var(--wa))", // warning
];
export function TopParticipantsPieChart({ data }: TopParticipantsPieChartProps) {
  const chartData = data.map((item) => ({
    name: item.personName,
    value: item.total,
  }));

  return (
    <ResponsiveContainer height={280} width="100%">
      <PieChart>
        <Pie
          cx="50%"
          cy="50%"
          data={chartData}
          dataKey="value"
          label={(entry) => entry.name}
          labelLine={false}
          outerRadius={80}
        >
          {chartData.map((_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: colors depend on index
            <Cell fill={COLORS[index % COLORS.length]} key={`cell-${index}`} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--b1))",
            border: "1px solid hsl(var(--bc) / 0.2)",
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
          }}
          formatter={(value) => fmtCLP(Number(value))}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

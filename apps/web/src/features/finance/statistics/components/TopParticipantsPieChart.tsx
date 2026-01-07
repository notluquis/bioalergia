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

export default function TopParticipantsPieChart({ data }: TopParticipantsPieChartProps) {
  const chartData = data.map((item) => ({
    name: item.personName,
    value: item.total,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={(entry) => entry.name}
          outerRadius={80}
          dataKey="value"
        >
          {chartData.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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

/**
 * Monthly Flow Chart Inner - Recharts Implementation
 * Separated for code splitting
 */

import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { fmtCLP } from "@/lib/format";

import type { MonthlyFlowData } from "../types";

import "dayjs/locale/es";

dayjs.extend(customParseFormat);
dayjs.locale("es");

interface MonthlyFlowChartInnerProps {
  data: MonthlyFlowData[];
}

export default function MonthlyFlowChartInner({ data }: MonthlyFlowChartInnerProps) {
  const chartData = data.map((item) => {
    // item.month viene como "YYYY-MM" (e.g., "2025-01")
    const monthDate = dayjs(item.month + "-01", "YYYY-MM-DD");
    return {
      Egresos: item.out,
      Ingresos: item.in,
      month: monthDate.isValid() ? monthDate.format("MMM YY") : item.month,
      Neto: item.net,
    };
  });

  return (
    <ResponsiveContainer height={320} width="100%">
      <BarChart data={chartData} margin={{ bottom: 10, left: 10, right: 10, top: 10 }}>
        <CartesianGrid className="stroke-base-300" strokeDasharray="3 3" />
        <XAxis className="text-base-content/70 text-xs" dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis
          className="text-base-content/70 text-xs"
          tick={{ fontSize: 12 }}
          tickFormatter={(value) => {
            const num = typeof value === "number" ? value : 0;
            if (num >= 1_000_000) return `$${Math.round(num / 1_000_000)}M`;
            if (num >= 1000) return `$${Math.round(num / 1000)}K`;
            return fmtCLP(num);
          }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--b1))",
            border: "1px solid hsl(var(--bc) / 0.2)",
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
          }}
          formatter={(value) => {
            const num = typeof value === "number" ? value : 0;
            return fmtCLP(num);
          }}
        />
        <Legend iconType="circle" wrapperStyle={{ fontSize: "0.875rem" }} />
        <Bar dataKey="Ingresos" fill="hsl(var(--su))" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Egresos" fill="hsl(var(--er))" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Neto" fill="hsl(var(--p))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

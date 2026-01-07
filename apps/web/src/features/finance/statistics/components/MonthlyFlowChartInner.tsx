/**
 * Monthly Flow Chart Inner - Recharts Implementation
 * Separated for code splitting
 */

import "dayjs/locale/es";

import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { fmtCLP } from "@/lib/format";

import type { MonthlyFlowData } from "../types";

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
      month: monthDate.isValid() ? monthDate.format("MMM YY") : item.month,
      Ingresos: item.in,
      Egresos: item.out,
      Neto: item.net,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-base-300" />
        <XAxis dataKey="month" className="text-base-content/70 text-xs" tick={{ fontSize: 12 }} />
        <YAxis
          className="text-base-content/70 text-xs"
          tick={{ fontSize: 12 }}
          tickFormatter={(value) => {
            const num = typeof value === "number" ? value : 0;
            if (num >= 1_000_000) return `$${Math.round(num / 1_000_000)}M`;
            if (num >= 1_000) return `$${Math.round(num / 1_000)}K`;
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
        <Legend wrapperStyle={{ fontSize: "0.875rem" }} iconType="circle" />
        <Bar dataKey="Ingresos" fill="hsl(var(--su))" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Egresos" fill="hsl(var(--er))" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Neto" fill="hsl(var(--p))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

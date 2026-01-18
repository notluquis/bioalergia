/**
 * Monthly Flow Chart Component
 * Displays monthly income/expense trends
 */

import { TrendingUp } from "lucide-react";
import { lazy, Suspense } from "react";

import type { MonthlyFlowData } from "../types";

// Lazy load Recharts (heavy dependency)
const MonthlyFlowChartInner = lazy(() => import("./MonthlyFlowChartInner.js"));

interface MonthlyFlowChartProps {
  readonly data: MonthlyFlowData[];
}

export default function MonthlyFlowChart({ data }: MonthlyFlowChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-base-100 border-base-200 rounded-2xl border p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
          <TrendingUp className="text-primary h-5 w-5" />
          Flujo mensual
        </h2>
        <div className="text-base-content/60 py-8 text-center text-sm">
          No hay datos para mostrar en el rango seleccionado
        </div>
      </div>
    );
  }

  return (
    <div className="bg-base-100 border-base-200 rounded-2xl border p-6 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
        <TrendingUp className="text-primary h-5 w-5" />
        Flujo mensual
      </h2>
      <Suspense
        fallback={
          <div className="flex h-80 items-center justify-center">
            <span className="loading loading-spinner loading-lg text-primary" />
          </div>
        }
      >
        <MonthlyFlowChartInner data={data} />
      </Suspense>
    </div>
  );
}

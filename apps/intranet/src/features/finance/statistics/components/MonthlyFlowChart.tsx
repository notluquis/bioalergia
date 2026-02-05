/**
 * Monthly Flow Chart Component
 * Displays monthly income/expense trends
 */

import { Card, Spinner } from "@heroui/react";
import { TrendingUp } from "lucide-react";
import { lazy, Suspense } from "react";

import type { MonthlyFlowData } from "../types";

// Lazy load Recharts (heavy dependency)
const MonthlyFlowChartInner = lazy(() =>
  import("./MonthlyFlowChartInner.js").then((m) => ({ default: m.MonthlyFlowChartInner })),
);

interface MonthlyFlowChartProps {
  readonly data: MonthlyFlowData[];
}
export function MonthlyFlowChart({ data }: MonthlyFlowChartProps) {
  if (data.length === 0) {
    return (
      <Card className="p-6">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-lg">
          <TrendingUp className="h-5 w-5 text-primary" />
          Flujo mensual
        </h2>
        <div className="py-8 text-center text-default-500 text-sm">
          No hay datos para mostrar en el rango seleccionado
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="mb-4 flex items-center gap-2 font-bold text-lg">
        <TrendingUp className="h-5 w-5 text-primary" />
        Flujo mensual
      </h2>
      <Suspense
        fallback={
          <div className="flex h-80 items-center justify-center">
            <Spinner className="text-primary" color="current" size="lg" />
          </div>
        }
      >
        <MonthlyFlowChartInner data={data} />
      </Suspense>
    </Card>
  );
}

import { Zap, ZapOff } from "lucide-react";

import { usePerformanceMode } from "@/hooks/use-performance-mode";

export function PerformanceIndicator() {
  const { mode, reason } = usePerformanceMode();

  return (
    <div
      className="flex items-center gap-1.5 rounded-full border border-default-200/60 bg-default-50/50 px-2.5 py-1 text-xs"
      title={`Modo: ${mode === "high" ? "Alto rendimiento" : "Rendimiento optimizado"} - ${reason}`}
    >
      {mode === "high" ? (
        <>
          <Zap className="h-3.5 w-3.5 text-success" />
          <span className="font-medium text-success">Alto rendimiento</span>
        </>
      ) : (
        <>
          <ZapOff className="h-3.5 w-3.5 text-warning" />
          <span className="font-medium text-warning">Optimizado</span>
        </>
      )}
    </div>
  );
}

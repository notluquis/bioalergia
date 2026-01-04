import { Zap, ZapOff } from "lucide-react";

import { usePerformanceMode } from "@/hooks/usePerformanceMode";

export function PerformanceIndicator() {
  const { mode, reason } = usePerformanceMode();

  return (
    <div
      className="border-base-300/60 bg-base-200/50 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
      title={`Modo: ${mode === "high" ? "Alto rendimiento" : "Rendimiento optimizado"} - ${reason}`}
    >
      {mode === "high" ? (
        <>
          <Zap className="text-success h-3.5 w-3.5" />
          <span className="text-success font-medium">Alto rendimiento</span>
        </>
      ) : (
        <>
          <ZapOff className="text-warning h-3.5 w-3.5" />
          <span className="text-warning font-medium">Optimizado</span>
        </>
      )}
    </div>
  );
}

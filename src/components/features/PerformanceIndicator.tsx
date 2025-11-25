import { usePerformanceMode } from "@/hooks/usePerformanceMode";
import { Zap, ZapOff } from "lucide-react";

export function PerformanceIndicator() {
  const { mode, reason } = usePerformanceMode();

  return (
    <div
      className="flex items-center gap-1.5 rounded-full border border-base-300/60 bg-base-200/50 px-2.5 py-1 text-xs"
      title={`Modo: ${mode === "high" ? "Alto rendimiento" : "Rendimiento optimizado"} - ${reason}`}
    >
      {mode === "high" ? (
        <>
          <Zap className="h-3.5 w-3.5 text-success" />
          <span className="text-success font-medium">Alto rendimiento</span>
        </>
      ) : (
        <>
          <ZapOff className="h-3.5 w-3.5 text-warning" />
          <span className="text-warning font-medium">Optimizado</span>
        </>
      )}
    </div>
  );
}

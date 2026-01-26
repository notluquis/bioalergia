import { useEffect, useState } from "react";

export type PerformanceMode = "high" | "low";

interface PerformanceInfo {
  mode: PerformanceMode;
  reason: string;
  score: number;
}

export function usePerformanceMode(): PerformanceInfo {
  const [info, setInfo] = useState<PerformanceInfo>(() => detectPerformanceMode());

  useEffect(() => {
    // Re-detect on mount (in case device changes)
    setInfo(detectPerformanceMode());
  }, []);

  return info;
}

function detectPerformanceMode(): PerformanceInfo {
  let score = 100;
  const reasons: string[] = [];

  // Check CPU cores
  if (navigator.hardwareConcurrency) {
    const cores = navigator.hardwareConcurrency;
    if (cores <= 4) {
      score -= 30;
      reasons.push(`${cores} núcleos`);
    }
  }

  // Check RAM
  if ("deviceMemory" in navigator) {
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    if (memory && memory < 4) {
      score -= 30;
      reasons.push(`${memory}GB RAM`);
    }
  }

  // Check connection
  if ("connection" in navigator) {
    const conn = (
      navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } }
    ).connection;
    if (conn?.saveData) {
      score -= 20;
      reasons.push("Modo ahorro datos");
    }
    if (conn?.effectiveType === "slow-2g" || conn?.effectiveType === "2g") {
      score -= 20;
      reasons.push("Conexión lenta");
    }
  }

  // Determine mode
  const mode: PerformanceMode = score >= 70 ? "high" : "low";
  const reason = reasons.length > 0 ? reasons.join(", ") : "Hardware potente";

  return { mode, reason, score };
}

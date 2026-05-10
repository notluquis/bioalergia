import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "@/lib/toast-interceptor";
import { usePhoneQualitySummary } from "./useWaCloud";

// Watches the per-phone quality summary and surfaces a toast when the
// critical-unack count grows or the quality rating drops to RED. Mount
// this once at the top of any wa-cloud page (already mounted in the
// inbox layout). Quiet during the first render so we don't spam on
// page reload.
export function useQualityAlerts(phoneNumberId: number | undefined) {
  const q = usePhoneQualitySummary(phoneNumberId);
  const qc = useQueryClient();
  const prev = useRef<{ critical: number; rating: string | null } | null>(null);

  useEffect(() => {
    if (!q.data) return;
    const cur = {
      critical: q.data.criticalUnacknowledged,
      rating: q.data.qualityRating,
    };
    if (prev.current === null) {
      prev.current = cur;
      return;
    }
    const newCritical = cur.critical - prev.current.critical;
    const droppedToRed = cur.rating === "RED" && prev.current.rating !== "RED";

    if (droppedToRed) {
      toast.error(
        "Calidad del número bajó a RED. Pausa campañas y revisa el contenido inmediatamente."
      );
      // Force-refresh broadcasts list so operator sees auto-paused entries.
      void qc.invalidateQueries({ queryKey: ["wa-cloud", "broadcasts"] });
    } else if (newCritical > 0) {
      toast.error(`Nueva alerta crítica WhatsApp (${newCritical} sin reconocer).`);
    }
    prev.current = cur;
  }, [q.data, qc]);
}

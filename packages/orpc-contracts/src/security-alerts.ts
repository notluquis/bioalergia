import { oc } from "@orpc/contract";
import { z } from "zod";

// Panel READ-ONLY del estado de alertas de seguridad ya emitidas.
// Modelo SecurityAlertState: clave compuesta [scope, alertType] + lastSentAt
// (timestamp del último envío deduplicado). Lo escribe lib/security-alerts.ts
// (markSent → upsert). Esta superficie sólo lo lista para el operador.
export const securityAlertStateSchema = z.object({
  scope: z.string(),
  alertType: z.string(),
  lastSentAt: z.date(),
});

export const securityAlertsListResponseSchema = z.object({
  states: z.array(securityAlertStateSchema),
});

export const securityAlertsContract = {
  list: oc.route({ method: "GET", path: "/states" }).output(securityAlertsListResponseSchema),
};

export type SecurityAlertsContract = typeof securityAlertsContract;
export type SecurityAlertStateDto = z.infer<typeof securityAlertStateSchema>;

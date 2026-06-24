import { db } from "@finanzas/db";

/**
 * Panel READ-ONLY del estado de alertas de seguridad ya emitidas.
 *
 * `SecurityAlertState` es la tabla de dedupe que mantiene
 * `lib/security-alerts.ts` (markSent → upsert por clave compuesta
 * [scope, alertType]). Cada fila registra cuándo se envió por última vez
 * una alerta de una familia (alertType) sobre un sujeto (scope). Esta capa
 * de servicio sólo las lista, ordenadas por la más reciente primero, para
 * que el operador vea de un vistazo qué alertas se han disparado y cuándo.
 *
 * No hay create/update/delete: el estado lo gobierna el dispatcher de
 * alertas; este panel es puramente observacional.
 */
export async function listSecurityAlertStates(): Promise<{
  states: Awaited<ReturnType<typeof db.securityAlertState.findMany>>;
}> {
  const states = await db.securityAlertState.findMany({
    orderBy: { lastSentAt: "desc" },
  });
  return { states };
}

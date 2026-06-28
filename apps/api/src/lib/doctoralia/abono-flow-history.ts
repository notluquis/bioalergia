import { kysely } from "@finanzas/db";
import { sql } from "kysely";
import { logError } from "../logger.ts";

export async function appendAbonoFlowHistory(
  tokenId: string,
  step: string,
  details: Record<string, unknown> = {},
  error?: unknown
): Promise<void> {
  const message = error instanceof Error ? error.message : error == null ? null : String(error);
  const entry = {
    at: new Date().toISOString(),
    step,
    ...details,
    ...(message ? { error: message } : {}),
  };

  try {
    await sql`
      UPDATE appointment_payment_tokens
      SET
        flow_step = ${step},
        flow_error = ${message},
        flow_history = COALESCE(flow_history, '[]'::jsonb) || ${JSON.stringify([entry])}::jsonb,
        updated_at = now()
      WHERE id = ${tokenId}
    `.execute(kysely);
  } catch (historyError) {
    logError("doctoralia.abono.flow_history_failed", historyError, { step, tokenId });
  }
}

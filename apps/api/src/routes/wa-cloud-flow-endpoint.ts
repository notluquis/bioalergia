// WhatsApp Flows data-exchange endpoint (Meta calls this directly, encrypted).
//
// Meta posts { encrypted_aes_key, encrypted_flow_data, initial_vector }. We
// decrypt with our RSA private key (stored encrypted in Settings), handle the
// action, and reply AES-GCM (text/plain base64). The "ping" health check must
// succeed before a flow can be connected/published in Flow Builder.
//
// Phase 1: ping + INIT/data_exchange skeleton. The intake screens + receipt
// handling land in later phases.

import { db } from "@finanzas/db";
import { Hono } from "hono";
import { getSetting } from "../lib/settings.ts";
import { decryptSecret } from "../lib/secret-cipher.ts";
import { logError, logEvent } from "../lib/logger.ts";
import {
  type FlowRequest,
  decryptFlowRequest,
  encryptFlowResponse,
} from "../lib/flow-crypto.ts";
import {
  createIntakeFromFlow,
  notifyStaffFicha,
  processIntakeReceipt,
} from "../services/intake.ts";

const PRIVATE_KEY_SETTING = "wa.flow.privateKeyEnc";

async function loadPrivateKey(): Promise<string | null> {
  const stored = await getSetting(PRIVATE_KEY_SETTING);
  return decryptSecret(stored);
}

// Every response MUST echo the request `version` (Meta requirement).
async function buildResponse(request: FlowRequest): Promise<Record<string, unknown>> {
  const version = request.version ?? "3.0";
  // Health check.
  if (request.action === "ping") return { version, data: { status: "active" } };
  // Client-side error notification — just acknowledge.
  if ((request.data as { error?: unknown } | undefined)?.error) {
    return { version, data: { acknowledged: true } };
  }

  // NOTE: no INIT handler. The intake flow is launched with flow_action
  // "navigate" + flow_action_payload.data (name/phone prefill, see
  // services/intake.ts::sendIntakeFlow), so Meta never calls the endpoint on
  // open — an INIT handler here would be dead code.

  if (request.action === "data_exchange") {
    const flowToken = request.flow_token ?? null;
    // Guard: don't persist a duplicate/late submission against a payment token
    // that already expired or was processed. Return a validation error on the
    // current screen instead of silently creating a stale intake row.
    if (flowToken) {
      const token = await db.appointmentPaymentToken.findUnique({
        where: { id: flowToken },
        select: { status: true },
      });
      if (token && token.status !== "PENDING") {
        logEvent("wa-flow.endpoint.token_not_pending", { flowToken, status: token.status });
        return {
          version,
          screen: "COMPROBANTE",
          data: { error_message: "Este abono ya no está disponible (expiró o ya fue procesado)." },
        };
      }
    }
    // Final submit: persist the intake (fast, idempotent). The full form data
    // (+ PhotoPicker media) arrives here, not in nfm_reply.
    const data = request.data ?? {};
    const { id, isNew } = await createIntakeFromFlow(flowToken, data);
    if (isNew) {
      // Background: don't block the SUCCESS response on the receipt download/
      // decrypt/R2 upload (Meta's data_exchange call would time out). Process the
      // receipt, THEN notify staff so the ficha carries the comprobante header.
      void processIntakeReceipt(id, data)
        .then(() => notifyStaffFicha(id))
        .catch((err) => logError("wa-flow.endpoint.post_submit_failed", err, { intakeId: id }));
    }
    return {
      version,
      screen: "SUCCESS",
      data: { extension_message_response: { params: { flow_token: request.flow_token ?? "" } } },
    };
  }

  return { version, data: { acknowledged: true } };
}

export const waCloudFlowRoutes = new Hono();

waCloudFlowRoutes.post("/", async (c) => {
  const privateKey = await loadPrivateKey();
  if (!privateKey) {
    logError("wa-flow.endpoint.no_key", new Error("wa.flow.privateKeyEnc not set"), {});
    return c.text("", 500);
  }

  let body: { encrypted_aes_key?: string; encrypted_flow_data?: string; initial_vector?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.text("", 400);
  }
  if (!body.encrypted_aes_key || !body.encrypted_flow_data || !body.initial_vector) {
    return c.text("", 400);
  }

  let request: FlowRequest;
  let aesKey: Buffer;
  let iv: Buffer;
  try {
    ({ request, aesKey, iv } = decryptFlowRequest(body as never, privateKey));
  } catch (err) {
    logError("wa-flow.endpoint.decrypt_failed", err, {});
    // 421 → Meta re-fetches the public key and retries.
    return c.text("", 421);
  }

  try {
    const response = await buildResponse(request);
    logEvent("wa-flow.endpoint.handled", { action: request.action, screen: request.screen });
    c.header("Content-Type", "text/plain");
    return c.text(encryptFlowResponse(response, aesKey, iv));
  } catch (err) {
    logError("wa-flow.endpoint.handle_failed", err, { action: request.action });
    return c.text("", 500);
  }
});

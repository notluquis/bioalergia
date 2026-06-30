// WhatsApp Flows data-exchange endpoint (Meta calls this directly, encrypted).
//
// Meta posts { encrypted_aes_key, encrypted_flow_data, initial_vector }. We
// decrypt with our RSA private key (stored encrypted in Settings), handle the
// action, and reply AES-GCM (text/plain base64). The "ping" health check must
// succeed before a flow can be connected/published in Flow Builder.
//
// Phase 1: ping + INIT/data_exchange skeleton. The intake screens + receipt
// handling land in later phases.

import { Hono } from "hono";
import { getSetting } from "../lib/settings.ts";
import { decryptSecret } from "../lib/secret-cipher.ts";
import { logError, logEvent } from "../lib/logger.ts";
import {
  type FlowRequest,
  decryptFlowRequest,
  encryptFlowResponse,
} from "../lib/flow-crypto.ts";

const PRIVATE_KEY_SETTING = "wa.flow.privateKeyEnc";

async function loadPrivateKey(): Promise<string | null> {
  const stored = await getSetting(PRIVATE_KEY_SETTING);
  return decryptSecret(stored);
}

// Decide the next screen + data for a non-ping action. Phase 1 returns a
// terminal acknowledgement; later phases route the intake screens + persist.
function handleAction(request: FlowRequest): Record<string, unknown> {
  if (request.action === "INIT") {
    // First screen of the flow. Real screens are added with the Flow JSON.
    return { screen: "FICHA", data: {} };
  }
  // data_exchange / BACK — acknowledge for now.
  return { screen: "SUCCESS", data: { extension_message_response: { params: {} } } };
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
    const response =
      request.action === "ping"
        ? { data: { status: "active" } }
        : handleAction(request);
    logEvent("wa-flow.endpoint.handled", { action: request.action, screen: request.screen });
    c.header("Content-Type", "text/plain");
    return c.text(encryptFlowResponse(response, aesKey, iv));
  } catch (err) {
    logError("wa-flow.endpoint.handle_failed", err, { action: request.action });
    return c.text("", 500);
  }
});

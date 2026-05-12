import { logWarn } from "../../../lib/logger.ts";
import { GRAPH_BASE, getAccountForPhoneNumber, graphGet, graphPost, loadAccount } from "./_http.ts";

export type WaMediaUploadResult = { id: string };

/**
 * Upload media to Meta (multipart). Returns the media id usable with
 * sendMediaMessage. Meta keeps uploaded media for 30 days.
 */
export async function uploadMedia(
  phoneNumberId: number,
  file: Blob,
  mimeType: string,
  filename: string
): Promise<{ id: string }> {
  const phone = await getAccountForPhoneNumber(phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = phone.account.systemUserToken!;
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", mimeType);
  form.append("file", file, filename);
  const res = await fetch(`${GRAPH_BASE}/${v}/${phone.phoneNumberId}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) {
    logWarn("[wa-cloud.graph] media upload failed", {
      status: res.status,
      body: text.slice(0, 500),
    });
    throw new Error(`Graph media upload ${res.status}: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as { id: string };
}

export async function markMessageRead(
  phoneNumberId: number,
  metaMessageId: string,
  showTyping = false
) {
  const phone = await getAccountForPhoneNumber(phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = phone.account.systemUserToken!;
  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    status: "read",
    message_id: metaMessageId,
  };
  if (showTyping) {
    body.typing_indicator = { type: "text" };
  }
  return graphPost(`/${phone.phoneNumberId}/messages`, body, token, v);
}

// Explicit delivered confirmation. Meta auto-tracks delivery on the
// outbound side; this endpoint lets us tell Meta we have stored an
// inbound message even before the operator opens the conversation,
// improving end-to-end tracking + giving the patient earlier "two
// gray ticks" feedback.
export async function markMessageDelivered(phoneNumberId: number, metaMessageId: string) {
  const phone = await getAccountForPhoneNumber(phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = phone.account.systemUserToken!;
  return graphPost(
    `/${phone.phoneNumberId}/messages`,
    {
      messaging_product: "whatsapp",
      status: "delivered",
      message_id: metaMessageId,
    },
    token,
    v
  );
}

export async function downloadMediaUrl(mediaId: string, accountId: number) {
  const account = await loadAccount(accountId);
  if (!account?.systemUserToken) throw new Error("Account sin token");
  const meta = await graphGet<{
    url: string;
    mime_type: string;
    sha256: string;
    file_size: number;
  }>(`/${mediaId}`, account.systemUserToken, account.graphApiVersion);
  return meta;
}

export async function uploadProfilePictureHandle(
  phoneNumberId: number,
  file: Blob,
  filename: string
): Promise<string> {
  const phone = await getAccountForPhoneNumber(phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = phone.account.systemUserToken!;
  const appId = phone.account.appId;
  if (!appId) throw new Error("Account sin appId — configura en Settings antes de subir foto");

  const startUrl = `${GRAPH_BASE}/${v}/${appId}/uploads?file_name=${encodeURIComponent(filename)}&file_length=${file.size}&file_type=${encodeURIComponent(file.type || "image/jpeg")}&access_token=${encodeURIComponent(token)}`;
  const startRes = await fetch(startUrl, { method: "POST" });
  const startText = await startRes.text();
  if (!startRes.ok) {
    throw new Error(`Resumable start ${startRes.status}: ${startText.slice(0, 300)}`);
  }
  const { id: sessionId } = JSON.parse(startText) as { id: string };

  const buf = await file.arrayBuffer();
  const uploadUrl = `${GRAPH_BASE}/${v}/${sessionId}`;
  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${token}`,
      file_offset: "0",
    },
    body: buf,
  });
  const uploadText = await uploadRes.text();
  if (!uploadRes.ok) {
    throw new Error(`Resumable upload ${uploadRes.status}: ${uploadText.slice(0, 300)}`);
  }
  const { h } = JSON.parse(uploadText) as { h: string };
  return h;
}

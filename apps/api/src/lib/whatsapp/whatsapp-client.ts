/**
 * Meta WhatsApp Business API client
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/
 */

const GRAPH_API_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION ?? "v25.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

type WhatsappMessageStatus = null | string;

export interface WhatsappTemplateComponent {
  index?: number;
  parameters?: Array<{ text?: string; type: "currency" | "date_time" | "text" }>;
  sub_type?: string;
  type: "body" | "button" | "header";
}

export interface WhatsappSendResponseContact {
  input: null | string;
  waId: null | string;
}

export interface WhatsappSendResult {
  contacts: WhatsappSendResponseContact[];
  messageId: string;
  messageStatus: WhatsappMessageStatus;
  raw: unknown;
  status: "sent";
}

export interface WhatsappMediaPayload {
  caption?: string;
  filename?: string;
  id?: string;
  link?: string;
}

export interface WhatsappReplyButtonOption {
  id: string;
  title: string;
}

export interface WhatsappListSection {
  rows: Array<{
    description?: string;
    id: string;
    title: string;
  }>;
  title: string;
}

function getConfig() {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    throw new Error(
      "WhatsApp no configurado. Faltan WHATSAPP_ACCESS_TOKEN o WHATSAPP_PHONE_NUMBER_ID",
    );
  }

  return { accessToken, phoneNumberId };
}

function buildContext(replyToMessageId?: null | string) {
  if (!replyToMessageId) {
    return {};
  }

  return {
    context: {
      message_id: replyToMessageId,
    },
  };
}

function buildMediaContent(
  mediaType: "audio" | "document" | "image" | "sticker" | "video",
  payload: WhatsappMediaPayload,
) {
  if (!payload.id && !payload.link) {
    throw new Error(`WhatsApp ${mediaType} requiere id o link`);
  }

  const base: Record<string, unknown> = {};
  if (payload.id) {
    base.id = payload.id;
  }
  if (payload.link) {
    base.link = payload.link;
  }

  if (payload.caption && mediaType !== "audio" && mediaType !== "sticker") {
    base.caption = payload.caption;
  }

  if (payload.filename && mediaType === "document") {
    base.filename = payload.filename;
  }

  return base;
}

async function sendWhatsappRequest(body: Record<string, unknown>): Promise<WhatsappSendResult> {
  const { accessToken, phoneNumberId } = getConfig();

  const res = await fetch(`${GRAPH_API_BASE}/${phoneNumberId}/messages`, {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "unknown error");
    throw new Error(`WhatsApp API error ${res.status}: ${errorText}`);
  }

  const data = (await res.json()) as {
    contacts?: Array<{ input?: string; wa_id?: string }>;
    messages?: Array<{ id: string; message_status?: string }>;
    success?: boolean;
  };

  return {
    contacts:
      data.contacts?.map((contact) => ({
        input: contact.input ?? null,
        waId: contact.wa_id ?? null,
      })) ?? [],
    messageId: data.messages?.[0]?.id ?? "",
    messageStatus: data.messages?.[0]?.message_status ?? null,
    raw: data,
    status: "sent",
  };
}

export async function sendTemplateMessage(
  to: string,
  templateName: string,
  languageCode: string,
  components?: WhatsappTemplateComponent[],
): Promise<WhatsappSendResult> {
  return await sendWhatsappRequest({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    template: {
      ...(components && components.length > 0 ? { components } : {}),
      language: { code: languageCode },
      name: templateName,
    },
    to: normalizePhone(to),
    type: "template",
  });
}

export async function sendTextMessage(
  to: string,
  body: string,
  options?: {
    previewUrl?: boolean;
    replyToMessageId?: null | string;
  },
): Promise<WhatsappSendResult> {
  return await sendWhatsappRequest({
    ...buildContext(options?.replyToMessageId),
    messaging_product: "whatsapp",
    recipient_type: "individual",
    text: {
      body,
      ...(options?.previewUrl ? { preview_url: true } : {}),
    },
    to: normalizePhone(to),
    type: "text",
  });
}

export async function sendContextualTextReply(
  to: string,
  body: string,
  quotedMessageId: string,
  options?: {
    previewUrl?: boolean;
  },
) {
  return await sendTextMessage(to, body, {
    previewUrl: options?.previewUrl,
    replyToMessageId: quotedMessageId,
  });
}

export async function sendMediaMessage(args: {
  media: WhatsappMediaPayload;
  mediaType: "audio" | "document" | "image" | "sticker" | "video";
  phone: string;
  replyToMessageId?: null | string;
}) {
  return await sendWhatsappRequest({
    ...buildContext(args.replyToMessageId),
    messaging_product: "whatsapp",
    recipient_type: "individual",
    [args.mediaType]: buildMediaContent(args.mediaType, args.media),
    to: normalizePhone(args.phone),
    type: args.mediaType,
  });
}

export async function sendReactionMessage(args: {
  emoji: string;
  messageId: string;
  phone: string;
}) {
  return await sendWhatsappRequest({
    messaging_product: "whatsapp",
    reaction: {
      emoji: args.emoji,
      message_id: args.messageId,
    },
    recipient_type: "individual",
    to: normalizePhone(args.phone),
    type: "reaction",
  });
}

export async function markMessageAsRead(messageId: string) {
  return await sendWhatsappRequest({
    message_id: messageId,
    messaging_product: "whatsapp",
    status: "read",
  });
}

export async function sendTypingIndicator(messageId: string) {
  return await sendWhatsappRequest({
    message_id: messageId,
    messaging_product: "whatsapp",
    status: "read",
    typing_indicator: {
      type: "text",
    },
  });
}

export async function sendInteractiveReplyButtonsMessage(args: {
  body: string;
  buttons: WhatsappReplyButtonOption[];
  footer?: string;
  headerText?: string;
  phone: string;
}) {
  return await sendWhatsappRequest({
    interactive: {
      ...(args.footer ? { footer: { text: args.footer } } : {}),
      ...(args.headerText ? { header: { text: args.headerText, type: "text" } } : {}),
      action: {
        buttons: args.buttons.map((button) => ({
          reply: {
            id: button.id,
            title: button.title,
          },
          type: "reply",
        })),
      },
      body: {
        text: args.body,
      },
      type: "button",
    },
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalizePhone(args.phone),
    type: "interactive",
  });
}

export async function sendInteractiveListMessage(args: {
  body: string;
  buttonText: string;
  footer?: string;
  headerText?: string;
  phone: string;
  sections: WhatsappListSection[];
}) {
  return await sendWhatsappRequest({
    interactive: {
      ...(args.footer ? { footer: { text: args.footer } } : {}),
      ...(args.headerText ? { header: { text: args.headerText, type: "text" } } : {}),
      action: {
        button: args.buttonText,
        sections: args.sections.map((section) => ({
          rows: section.rows.map((row) => ({
            ...(row.description ? { description: row.description } : {}),
            id: row.id,
            title: row.title,
          })),
          title: section.title,
        })),
      },
      body: {
        text: args.body,
      },
      type: "list",
    },
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalizePhone(args.phone),
    type: "interactive",
  });
}

export async function sendInteractiveCtaUrlMessage(args: {
  body: string;
  displayText: string;
  footer?: string;
  headerText?: string;
  phone: string;
  url: string;
}) {
  return await sendWhatsappRequest({
    interactive: {
      ...(args.footer ? { footer: { text: args.footer } } : {}),
      ...(args.headerText ? { header: { text: args.headerText, type: "text" } } : {}),
      action: {
        name: "cta_url",
        parameters: {
          display_text: args.displayText,
          url: args.url,
        },
      },
      body: {
        text: args.body,
      },
      type: "cta_url",
    },
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalizePhone(args.phone),
    type: "interactive",
  });
}

// ---------------------------------------------------------------------------
// Meta Business API — read-only queries
// ---------------------------------------------------------------------------

export interface MetaTemplateComponentDef {
  example?: unknown;
  text?: string;
  type: string;
}

export interface WhatsappTemplate {
  category: string;
  components: MetaTemplateComponentDef[];
  id: string;
  language: string;
  name: string;
  status: string;
}

interface MetaTemplatesResponse {
  data: Array<{
    category: string;
    components: MetaTemplateComponentDef[];
    id: string;
    language: string;
    name: string;
    status: string;
  }>;
  paging?: { cursors?: { after?: string; before?: string }; next?: string };
}

export async function listMessageTemplates(opts?: {
  limit?: number;
  status?: string;
}): Promise<WhatsappTemplate[]> {
  const { accessToken } = getConfig();
  const wabaId = await getWabaId();

  const params = new URLSearchParams();
  params.set("limit", String(opts?.limit ?? 100));
  if (opts?.status) params.set("status", opts.status);

  const res = await fetch(
    `${GRAPH_API_BASE}/${wabaId}/message_templates?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "unknown error");
    throw new Error(`Meta API error listing templates (${res.status}): ${text}`);
  }

  const body = (await res.json()) as MetaTemplatesResponse;
  return body.data.map((t) => ({
    category: t.category,
    components: t.components,
    id: t.id,
    language: t.language,
    name: t.name,
    status: t.status,
  }));
}

export async function getFirstApprovedTemplate(): Promise<{
  languageCode: string;
  templateName: string;
} | null> {
  try {
    const templates = await listMessageTemplates({ status: "APPROVED" });
    if (templates.length === 0) return null;
    return { languageCode: templates[0].language, templateName: templates[0].name };
  } catch {
    return null;
  }
}

let cachedWabaId: string | null = null;

export async function getWabaId(): Promise<string> {
  if (cachedWabaId) return cachedWabaId;

  const { accessToken, phoneNumberId } = getConfig();
  const res = await fetch(
    `${GRAPH_API_BASE}/${phoneNumberId}?fields=whatsapp_business_account`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "unknown error");
    throw new Error(`Meta API error fetching WABA ID (${res.status}): ${text}`);
  }

  const body = (await res.json()) as {
    whatsapp_business_account?: { id: string };
  };

  if (!body.whatsapp_business_account?.id) {
    throw new Error("No se encontró el WABA ID asociado al Phone Number ID.");
  }

  cachedWabaId = body.whatsapp_business_account.id;
  return cachedWabaId;
}

export interface WhatsappAccountInfo {
  displayPhoneNumber: string;
  messagingLimitTier: string | null;
  qualityRating: string | null;
  verifiedName: string;
  wabaId: string;
}

export async function getAccountInfo(): Promise<WhatsappAccountInfo> {
  const { accessToken, phoneNumberId } = getConfig();

  const res = await fetch(
    `${GRAPH_API_BASE}/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,messaging_limit_tier,whatsapp_business_account`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "unknown error");
    throw new Error(`Meta API error fetching account info (${res.status}): ${text}`);
  }

  const body = (await res.json()) as {
    display_phone_number?: string;
    messaging_limit_tier?: string;
    quality_rating?: string;
    verified_name?: string;
    whatsapp_business_account?: { id: string };
  };

  const wabaId = body.whatsapp_business_account?.id ?? "";
  if (wabaId) cachedWabaId = wabaId;

  return {
    displayPhoneNumber: body.display_phone_number ?? "",
    messagingLimitTier: body.messaging_limit_tier ?? null,
    qualityRating: body.quality_rating ?? null,
    verifiedName: body.verified_name ?? "",
    wabaId,
  };
}

/**
 * Normalize a Chilean phone number to E.164 format.
 * Accepts: +56912345678, 56912345678, 912345678, 09..., etc.
 */
export function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[\s\-().]/g, "");

  if (/^\+\d{10,15}$/.test(cleaned)) {
    return cleaned;
  }

  if (/^56\d{9}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  if (/^9\d{8}$/.test(cleaned)) {
    return `+56${cleaned}`;
  }

  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
}

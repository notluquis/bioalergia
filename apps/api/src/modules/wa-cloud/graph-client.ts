import { db } from "@finanzas/db";
import { logWarn } from "../../lib/logger.ts";

const GRAPH_BASE = "https://graph.facebook.com";

export type WaMediaUploadResult = { id: string };

export async function getAccountForPhoneNumber(phoneNumberId: number) {
  const phone = await db.waPhoneNumber.findUnique({
    where: { id: phoneNumberId },
    include: { account: true },
  });
  if (!phone) throw new Error(`WaPhoneNumber ${phoneNumberId} no existe`);
  if (!phone.account.systemUserToken) {
    throw new Error("WaBusinessAccount sin systemUserToken — configura en Settings");
  }
  return phone;
}

async function graphPost<T>(path: string, body: unknown, token: string, version: string): Promise<T> {
  const res = await fetch(`${GRAPH_BASE}/${version}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    logWarn("[wa-cloud.graph] POST failed", { path, status: res.status, body: text.slice(0, 500) });
    throw new Error(`Graph API ${res.status}: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as T;
}

async function graphGet<T>(path: string, token: string, version: string): Promise<T> {
  const res = await fetch(`${GRAPH_BASE}/${version}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  if (!res.ok) {
    logWarn("[wa-cloud.graph] GET failed", { path, status: res.status, body: text.slice(0, 500) });
    throw new Error(`Graph API ${res.status}: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as T;
}

async function graphDelete<T>(path: string, body: unknown, token: string, version: string): Promise<T> {
  const res = await fetch(`${GRAPH_BASE}/${version}${path}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    logWarn("[wa-cloud.graph] DELETE failed", { path, status: res.status, body: text.slice(0, 500) });
    throw new Error(`Graph API ${res.status}: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as T;
}

export type SendTextInput = {
  phoneNumberId: number;
  toE164: string;
  body: string;
  contextMessageId?: string;
};

export async function sendTextMessage(input: SendTextInput) {
  const phone = await getAccountForPhoneNumber(input.phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = phone.account.systemUserToken!;
  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.toE164.replace(/^\+/, ""),
    type: "text",
    text: { body: input.body, preview_url: false },
  };
  if (input.contextMessageId) {
    payload.context = { message_id: input.contextMessageId };
  }
  return graphPost<{ messages: Array<{ id: string }> }>(
    `/${phone.phoneNumberId}/messages`,
    payload,
    token,
    v,
  );
}

export type TemplateComponentParam =
  | { type: "text"; text: string }
  | { type: "currency"; currency: { fallback_value: string; code: string; amount_1000: number } }
  | { type: "date_time"; date_time: { fallback_value: string } }
  | { type: "image"; image: { link?: string; id?: string } }
  | { type: "document"; document: { link?: string; id?: string; filename?: string } }
  | { type: "video"; video: { link?: string; id?: string } };

export type TemplateComponentInput = {
  type: "header" | "body" | "footer" | "button";
  sub_type?: "quick_reply" | "url" | "copy_code";
  index?: number;
  parameters?: TemplateComponentParam[];
};

export type SendTemplateInput = {
  phoneNumberId: number;
  toE164: string;
  templateName: string;
  language: string;
  components?: TemplateComponentInput[];
};

export async function sendTemplateMessage(input: SendTemplateInput) {
  const phone = await getAccountForPhoneNumber(input.phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = phone.account.systemUserToken!;
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.toE164.replace(/^\+/, ""),
    type: "template",
    template: {
      name: input.templateName,
      language: { code: input.language },
      components: input.components ?? [],
    },
  };
  return graphPost<{ messages: Array<{ id: string }> }>(
    `/${phone.phoneNumberId}/messages`,
    payload,
    token,
    v,
  );
}

export type SendMediaInput = {
  phoneNumberId: number;
  toE164: string;
  type: "image" | "document" | "audio" | "video" | "sticker";
  link?: string;
  mediaId?: string;
  caption?: string;
  filename?: string;
};

export async function sendMediaMessage(input: SendMediaInput) {
  const phone = await getAccountForPhoneNumber(input.phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = phone.account.systemUserToken!;
  const media: Record<string, unknown> = {};
  if (input.link) media.link = input.link;
  if (input.mediaId) media.id = input.mediaId;
  if (input.caption && input.type !== "audio" && input.type !== "sticker")
    media.caption = input.caption;
  if (input.filename && input.type === "document") media.filename = input.filename;

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.toE164.replace(/^\+/, ""),
    type: input.type,
    [input.type]: media,
  };
  return graphPost<{ messages: Array<{ id: string }> }>(
    `/${phone.phoneNumberId}/messages`,
    payload,
    token,
    v,
  );
}

export type SendFlowInput = {
  phoneNumberId: number;
  toE164: string;
  flowId: string;
  flowCta: string;
  bodyText: string;
  headerText?: string;
  footerText?: string;
  flowToken?: string;
  initialScreen?: string;
};

export async function sendFlowMessage(input: SendFlowInput) {
  const phone = await getAccountForPhoneNumber(input.phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = phone.account.systemUserToken!;
  const interactive: Record<string, unknown> = {
    type: "flow",
    body: { text: input.bodyText },
    action: {
      name: "flow",
      parameters: {
        flow_message_version: "3",
        flow_action: "navigate",
        flow_token: input.flowToken ?? `tok_${Date.now()}`,
        flow_id: input.flowId,
        flow_cta: input.flowCta,
        ...(input.initialScreen
          ? { flow_action_payload: { screen: input.initialScreen } }
          : {}),
      },
    },
  };
  if (input.headerText) {
    interactive.header = { type: "text", text: input.headerText };
  }
  if (input.footerText) {
    interactive.footer = { text: input.footerText };
  }
  return graphPost<{ messages: Array<{ id: string }> }>(
    `/${phone.phoneNumberId}/messages`,
    {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: input.toE164.replace(/^\+/, ""),
      type: "interactive",
      interactive,
    },
    token,
    v,
  );
}

export async function sendReaction(
  phoneNumberId: number,
  toE164: string,
  metaMessageId: string,
  // empty string removes the reaction
  emoji: string,
) {
  const phone = await getAccountForPhoneNumber(phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = phone.account.systemUserToken!;
  return graphPost<{ messages: Array<{ id: string }> }>(
    `/${phone.phoneNumberId}/messages`,
    {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toE164.replace(/^\+/, ""),
      type: "reaction",
      reaction: { message_id: metaMessageId, emoji },
    },
    token,
    v,
  );
}

/**
 * Upload media to Meta (multipart). Returns the media id usable with
 * sendMediaMessage. Meta keeps uploaded media for 30 days.
 */
export async function uploadMedia(
  phoneNumberId: number,
  file: Blob,
  mimeType: string,
  filename: string,
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
  showTyping = false,
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

export type BusinessProfileFields = {
  about?: string;
  address?: string;
  description?: string;
  email?: string;
  vertical?:
    | "AUTO"
    | "BEAUTY"
    | "APPAREL"
    | "EDU"
    | "ENTERTAIN"
    | "EVENT_PLAN"
    | "FINANCE"
    | "GROCERY"
    | "GOVT"
    | "HOTEL"
    | "HEALTH"
    | "NONPROFIT"
    | "PROF_SERVICES"
    | "RETAIL"
    | "TRAVEL"
    | "RESTAURANT"
    | "NOT_A_BIZ"
    | "OTHER";
  websites?: string[];
  profile_picture_handle?: string;
};

export async function getBusinessProfile(phoneNumberId: number) {
  const phone = await getAccountForPhoneNumber(phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = phone.account.systemUserToken!;
  type Resp = {
    data: Array<{
      about?: string;
      address?: string;
      description?: string;
      email?: string;
      messaging_product?: string;
      profile_picture_url?: string;
      vertical?: string;
      websites?: string[];
    }>;
  };
  const fields = "about,address,description,email,profile_picture_url,vertical,websites";
  const data = await graphGet<Resp>(
    `/${phone.phoneNumberId}/whatsapp_business_profile?fields=${fields}`,
    token,
    v,
  );
  return data.data[0] ?? null;
}

export async function updateBusinessProfile(phoneNumberId: number, fields: BusinessProfileFields) {
  const phone = await getAccountForPhoneNumber(phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = phone.account.systemUserToken!;
  return graphPost(
    `/${phone.phoneNumberId}/whatsapp_business_profile`,
    { messaging_product: "whatsapp", ...fields },
    token,
    v,
  );
}

export async function getPhoneHealth(phoneNumberId: number) {
  const phone = await getAccountForPhoneNumber(phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = phone.account.systemUserToken!;
  type Resp = {
    id: string;
    display_phone_number?: string;
    verified_name?: string;
    code_verification_status?: string;
    quality_rating?: string;
    name_status?: string;
    messaging_limit_tier?: string;
    platform_type?: string;
    throughput?: { level?: string };
    health_status?: { can_send_message?: string; entities?: unknown[] };
  };
  const fields =
    "display_phone_number,verified_name,code_verification_status,quality_rating,name_status,messaging_limit_tier,platform_type,throughput,health_status";
  return graphGet<Resp>(`/${phone.phoneNumberId}?fields=${fields}`, token, v);
}

export async function blockUsers(phoneNumberId: number, e164List: string[]) {
  const phone = await getAccountForPhoneNumber(phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = phone.account.systemUserToken!;
  return graphPost(
    `/${phone.phoneNumberId}/block_users`,
    {
      messaging_product: "whatsapp",
      block_users: e164List.map((u) => ({ user: u.replace(/^\+/, "") })),
    },
    token,
    v,
  );
}

export async function unblockUsers(phoneNumberId: number, e164List: string[]) {
  const phone = await getAccountForPhoneNumber(phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = phone.account.systemUserToken!;
  return graphDelete(
    `/${phone.phoneNumberId}/block_users`,
    {
      messaging_product: "whatsapp",
      block_users: e164List.map((u) => ({ user: u.replace(/^\+/, "") })),
    },
    token,
    v,
  );
}

export async function listBlockedUsers(phoneNumberId: number) {
  const phone = await getAccountForPhoneNumber(phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = phone.account.systemUserToken!;
  type Resp = { data: Array<{ wa_id?: string; input?: string }> };
  return graphGet<Resp>(`/${phone.phoneNumberId}/block_users`, token, v);
}

export type ConversationAnalyticsParams = {
  accountId: number;
  startUnix: number;
  endUnix: number;
  granularity?: "HALF_HOUR" | "DAILY" | "MONTHLY";
  phoneNumbers?: string[];
};

export async function getConversationAnalytics(params: ConversationAnalyticsParams) {
  const account = await db.waBusinessAccount.findUnique({ where: { id: params.accountId } });
  if (!account?.systemUserToken) throw new Error("Account sin token");
  const granularity = params.granularity ?? "DAILY";
  const qs = new URLSearchParams({
    start: String(params.startUnix),
    end: String(params.endUnix),
    granularity,
  });
  if (params.phoneNumbers && params.phoneNumbers.length > 0) {
    qs.set("phone_numbers", JSON.stringify(params.phoneNumbers));
  }
  const path = `/${account.wabaId}?fields=conversation_analytics.start(${params.startUnix}).end(${params.endUnix}).granularity(${granularity})`;
  type Resp = {
    conversation_analytics?: {
      data: Array<{
        data_points: Array<{
          start: number;
          end: number;
          conversation: number;
          phone_number?: string;
          country?: string;
          conversation_type?: string;
          conversation_direction?: string;
          conversation_category?: string;
          cost?: number;
        }>;
      }>;
    };
  };
  return graphGet<Resp>(path, account.systemUserToken, account.graphApiVersion);
}

export type CreateTemplateInput = {
  accountId: number;
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  components: unknown[];
};

export async function createTemplate(input: CreateTemplateInput) {
  const account = await db.waBusinessAccount.findUnique({ where: { id: input.accountId } });
  if (!account?.systemUserToken) throw new Error("Account sin token");
  const v = account.graphApiVersion;
  const token = account.systemUserToken;
  return graphPost<{ id: string; status: string; category: string }>(
    `/${account.wabaId}/message_templates`,
    {
      name: input.name,
      language: input.language,
      category: input.category,
      components: input.components,
    },
    token,
    v,
  );
}

export async function deleteTemplate(accountId: number, name: string, hsmId?: string) {
  const account = await db.waBusinessAccount.findUnique({ where: { id: accountId } });
  if (!account?.systemUserToken) throw new Error("Account sin token");
  const v = account.graphApiVersion;
  const qs = new URLSearchParams({ name });
  if (hsmId) qs.set("hsm_id", hsmId);
  return graphDelete(`/${account.wabaId}/message_templates?${qs.toString()}`, {}, account.systemUserToken, v);
}

export type SendLocationInput = {
  phoneNumberId: number;
  toE164: string;
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
  contextMessageId?: string;
};

export async function sendLocationMessage(input: SendLocationInput) {
  const phone = await getAccountForPhoneNumber(input.phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = phone.account.systemUserToken!;
  const location: Record<string, unknown> = {
    latitude: input.latitude,
    longitude: input.longitude,
  };
  if (input.name) location.name = input.name;
  if (input.address) location.address = input.address;
  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.toE164.replace(/^\+/, ""),
    type: "location",
    location,
  };
  if (input.contextMessageId) payload.context = { message_id: input.contextMessageId };
  return graphPost<{ messages: Array<{ id: string }> }>(
    `/${phone.phoneNumberId}/messages`,
    payload,
    token,
    v,
  );
}

export type ContactCardInput = {
  name: { formatted_name: string; first_name?: string; last_name?: string };
  phones?: { phone: string; type?: string; wa_id?: string }[];
  emails?: { email: string; type?: string }[];
  org?: { company?: string; title?: string };
  addresses?: { street?: string; city?: string; country?: string; type?: string }[];
};

export type SendContactsInput = {
  phoneNumberId: number;
  toE164: string;
  contacts: ContactCardInput[];
  contextMessageId?: string;
};

export async function sendContactsMessage(input: SendContactsInput) {
  const phone = await getAccountForPhoneNumber(input.phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = phone.account.systemUserToken!;
  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.toE164.replace(/^\+/, ""),
    type: "contacts",
    contacts: input.contacts,
  };
  if (input.contextMessageId) payload.context = { message_id: input.contextMessageId };
  return graphPost<{ messages: Array<{ id: string }> }>(
    `/${phone.phoneNumberId}/messages`,
    payload,
    token,
    v,
  );
}

export type EditTextMessageInput = {
  phoneNumberId: number;
  toE164: string;
  metaMessageId: string;
  body: string;
};

export async function editTextMessage(input: EditTextMessageInput) {
  const phone = await getAccountForPhoneNumber(input.phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = phone.account.systemUserToken!;
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.toE164.replace(/^\+/, ""),
    edit: { message_id: input.metaMessageId },
    type: "text",
    text: { body: input.body, preview_url: false },
  };
  return graphPost<{ messages: Array<{ id: string }> }>(
    `/${phone.phoneNumberId}/messages`,
    payload,
    token,
    v,
  );
}

export async function downloadMediaUrl(mediaId: string, accountId: number) {
  const account = await db.waBusinessAccount.findUnique({ where: { id: accountId } });
  if (!account?.systemUserToken) throw new Error("Account sin token");
  const meta = await graphGet<{ url: string; mime_type: string; sha256: string; file_size: number }>(
    `/${mediaId}`,
    account.systemUserToken,
    account.graphApiVersion,
  );
  return meta;
}

export async function listAccountTemplates(accountId: number) {
  const account = await db.waBusinessAccount.findUnique({ where: { id: accountId } });
  if (!account?.systemUserToken) throw new Error("Account sin token");
  type TemplateApi = {
    id: string;
    name: string;
    language: string;
    status: string;
    category: string;
    components: unknown[];
    quality_score?: { score?: string };
  };
  const data = await graphGet<{ data: TemplateApi[] }>(
    `/${account.wabaId}/message_templates?fields=id,name,language,status,category,components,quality_score&limit=200`,
    account.systemUserToken,
    account.graphApiVersion,
  );
  return data.data;
}

export async function listAccountPhoneNumbers(accountId: number) {
  const account = await db.waBusinessAccount.findUnique({ where: { id: accountId } });
  if (!account?.systemUserToken) throw new Error("Account sin token");
  type PhoneApi = {
    id: string;
    display_phone_number: string;
    verified_name: string;
    quality_rating?: string;
  };
  const data = await graphGet<{ data: PhoneApi[] }>(
    `/${account.wabaId}/phone_numbers`,
    account.systemUserToken,
    account.graphApiVersion,
  );
  return data.data;
}

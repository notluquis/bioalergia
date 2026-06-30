import { getAccountForPhoneNumber, graphPost, requireSystemUserToken } from "./_http.ts";

// Build the Meta recipient field. Normally we address a contact by phone (`to`).
// For username-only WhatsApp users (phone hidden behind a username, Meta 2026)
// we have no phone — address them by their business-scoped user ID via
// `recipient` instead. Meta: if both `to` and `recipient` are present, `to`
// wins; we send whichever identifier we actually have, phone first.
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages/
export function buildRecipient(
  toE164: string | null | undefined,
  recipientBsuid?: string | null
): { to: string } | { recipient: string } {
  const phone = toE164?.trim();
  if (phone) return { to: phone.replace(/^\+/, "") };
  if (recipientBsuid?.trim()) return { recipient: recipientBsuid.trim() };
  throw new Error("Destinatario sin teléfono ni BSUID");
}

export type SendTextInput = {
  phoneNumberId: number;
  toE164: string;
  // BSUID fallback for username-only contacts (no phone). See buildRecipient.
  recipientBsuid?: string | null;
  body: string;
  // Render a link preview card for the first URL in the body (Meta default off).
  previewUrl?: boolean;
  contextMessageId?: string;
  bizOpaqueCallbackData?: string;
};

export async function sendTextMessage(input: SendTextInput) {
  const phone = await getAccountForPhoneNumber(input.phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = requireSystemUserToken(phone);
  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    ...buildRecipient(input.toE164, input.recipientBsuid),
    type: "text",
    text: { body: input.body, preview_url: input.previewUrl ?? false },
  };
  if (input.contextMessageId) {
    payload.context = { message_id: input.contextMessageId };
  }
  if (input.bizOpaqueCallbackData) {
    payload.biz_opaque_callback_data = input.bizOpaqueCallbackData;
  }
  return graphPost<{ messages: Array<{ id: string }> }>(
    `/${phone.phoneNumberId}/messages`,
    payload,
    token,
    v
  );
}

export type TemplateComponentParam = (
  | { type: "text"; text: string }
  | { type: "currency"; currency: { fallback_value: string; code: string; amount_1000: number } }
  | { type: "date_time"; date_time: { fallback_value: string } }
  | { type: "image"; image: { link?: string; id?: string } }
  | { type: "document"; document: { link?: string; id?: string; filename?: string } }
  | { type: "video"; video: { link?: string; id?: string } }
  | {
      type: "location";
      location: { latitude: string; longitude: string; name: string; address: string };
    }
  // Meta 2026: COPY_CODE button parameter — value the patient gets
  // copied to clipboard with one tap. Used for coupon codes, order ids,
  // pre-filled RUTs, etc.
  | { type: "coupon_code"; coupon_code: string }
  // Meta 2026: LIMITED_TIME_OFFER component parameter — countdown
  // timestamp + button URL with embedded expiration. Pair with a URL
  // button component on the same template.
  | {
      type: "limited_time_offer";
      limited_time_offer: { expiration_time_ms: number };
    }
  // URL button suffix (existing in tu base) + payload for copy_code etc.
  | { type: "payload"; payload: string }
) & { parameter_name?: string };

export type TemplateComponentBase = {
  // Adds "limited_time_offer" so LTO templates can pass the countdown
  // expiration. Other types unchanged.
  type: "header" | "body" | "footer" | "button" | "limited_time_offer";
  sub_type?: "quick_reply" | "url" | "copy_code";
  index?: number;
  parameters?: TemplateComponentParam[];
};

// Meta 2026: carousel template — body parent + N cards each with header
// (image), body (variables), buttons (quick_reply/url). Up to 10 cards.
export type TemplateCarouselCard = {
  card_index: number;
  components: Array<{
    type: "header" | "body" | "button";
    sub_type?: "quick_reply" | "url";
    index?: number;
    parameters?: TemplateComponentParam[];
  }>;
};

export type TemplateCarouselComponent = {
  type: "carousel";
  cards: TemplateCarouselCard[];
};

export type TemplateComponentInput = TemplateComponentBase | TemplateCarouselComponent;

export type SendTemplateInput = {
  phoneNumberId: number;
  toE164: string;
  // BSUID fallback for username-only contacts (no phone). See buildRecipient.
  recipientBsuid?: string | null;
  templateName: string;
  language: string;
  components?: TemplateComponentInput[];
  bizOpaqueCallbackData?: string;
};

export async function sendTemplateMessage(input: SendTemplateInput) {
  const phone = await getAccountForPhoneNumber(input.phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = requireSystemUserToken(phone);
  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    ...buildRecipient(input.toE164, input.recipientBsuid),
    type: "template",
    template: {
      name: input.templateName,
      language: { code: input.language },
      components: input.components ?? [],
    },
  };
  if (input.bizOpaqueCallbackData) {
    payload.biz_opaque_callback_data = input.bizOpaqueCallbackData;
  }
  return graphPost<{ messages: Array<{ id: string }> }>(
    `/${phone.phoneNumberId}/messages`,
    payload,
    token,
    v
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
  // Render audio as a voice note (waveform + transcription) rather than a basic
  // audio file. Meta requires the media be ogg/opus. Ignored for non-audio.
  voice?: boolean;
};

export async function sendMediaMessage(input: SendMediaInput) {
  const phone = await getAccountForPhoneNumber(input.phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = requireSystemUserToken(phone);
  const media: Record<string, unknown> = {};
  if (input.link) media.link = input.link;
  if (input.mediaId) media.id = input.mediaId;
  if (input.caption && input.type !== "audio" && input.type !== "sticker")
    media.caption = input.caption;
  if (input.filename && input.type === "document") media.filename = input.filename;
  // Voice note flag (audio only) — makes WA render the waveform/transcription UI.
  if (input.type === "audio" && input.voice) media.voice = true;

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
    v
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
  const token = requireSystemUserToken(phone);
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
        ...(input.initialScreen ? { flow_action_payload: { screen: input.initialScreen } } : {}),
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
    v
  );
}

// Interactive Call-to-Action URL button: a single button mapping to a URL, so
// the operator doesn't paste a raw/obscure link in the body. Only ONE URL
// button is supported by Meta.
export type SendCtaUrlInput = {
  phoneNumberId: number;
  toE164: string;
  bodyText: string;
  buttonText: string;
  url: string;
  headerText?: string;
  footerText?: string;
  contextMessageId?: string;
  bizOpaqueCallbackData?: string;
};

export async function sendCtaUrlMessage(input: SendCtaUrlInput) {
  const phone = await getAccountForPhoneNumber(input.phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = requireSystemUserToken(phone);
  const interactive: Record<string, unknown> = {
    type: "cta_url",
    body: { text: input.bodyText },
    action: {
      name: "cta_url",
      parameters: { display_text: input.buttonText, url: input.url },
    },
  };
  if (input.headerText) interactive.header = { type: "text", text: input.headerText };
  if (input.footerText) interactive.footer = { text: input.footerText };
  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.toE164.replace(/^\+/, ""),
    type: "interactive",
    interactive,
  };
  if (input.contextMessageId) payload.context = { message_id: input.contextMessageId };
  if (input.bizOpaqueCallbackData) payload.biz_opaque_callback_data = input.bizOpaqueCallbackData;
  return graphPost<{ messages: Array<{ id: string }> }>(
    `/${phone.phoneNumberId}/messages`,
    payload,
    token,
    v
  );
}

// Location request: text + a "Send location" button. The patient taps it to
// share their location (delivered back as an inbound location message). Meta
// does NOT allow a header or footer on this interactive type.
export type SendLocationRequestInput = {
  phoneNumberId: number;
  toE164: string;
  bodyText: string;
  contextMessageId?: string;
  bizOpaqueCallbackData?: string;
};

export async function sendLocationRequestMessage(input: SendLocationRequestInput) {
  const phone = await getAccountForPhoneNumber(input.phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = requireSystemUserToken(phone);
  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.toE164.replace(/^\+/, ""),
    type: "interactive",
    interactive: {
      type: "location_request_message",
      body: { text: input.bodyText },
      action: { name: "send_location" },
    },
  };
  if (input.contextMessageId) payload.context = { message_id: input.contextMessageId };
  if (input.bizOpaqueCallbackData) payload.biz_opaque_callback_data = input.bizOpaqueCallbackData;
  return graphPost<{ messages: Array<{ id: string }> }>(
    `/${phone.phoneNumberId}/messages`,
    payload,
    token,
    v
  );
}

export async function sendReaction(
  phoneNumberId: number,
  toE164: string,
  metaMessageId: string,
  // empty string removes the reaction
  emoji: string
) {
  const phone = await getAccountForPhoneNumber(phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = requireSystemUserToken(phone);
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
    v
  );
}

export type SendInteractiveListInput = {
  phoneNumberId: number;
  toE164: string;
  bodyText: string;
  buttonText: string;
  sections: Array<{
    title?: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>;
  headerText?: string;
  footerText?: string;
  contextMessageId?: string;
  bizOpaqueCallbackData?: string;
};

export async function sendInteractiveListMessage(input: SendInteractiveListInput) {
  const phone = await getAccountForPhoneNumber(input.phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = requireSystemUserToken(phone);
  const interactive: Record<string, unknown> = {
    type: "list",
    body: { text: input.bodyText },
    action: {
      button: input.buttonText,
      sections: input.sections,
    },
  };
  if (input.headerText) interactive.header = { type: "text", text: input.headerText };
  if (input.footerText) interactive.footer = { text: input.footerText };
  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.toE164.replace(/^\+/, ""),
    type: "interactive",
    interactive,
  };
  if (input.contextMessageId) payload.context = { message_id: input.contextMessageId };
  if (input.bizOpaqueCallbackData) payload.biz_opaque_callback_data = input.bizOpaqueCallbackData;
  return graphPost<{ messages: Array<{ id: string }> }>(
    `/${phone.phoneNumberId}/messages`,
    payload,
    token,
    v
  );
}

export type SendAddressMessageInput = {
  phoneNumberId: number;
  toE164: string;
  bodyText: string;
  country: string;
  saveAddressLabel?: string;
  contextMessageId?: string;
  bizOpaqueCallbackData?: string;
};

export async function sendAddressMessage(input: SendAddressMessageInput) {
  const phone = await getAccountForPhoneNumber(input.phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = requireSystemUserToken(phone);
  const interactive = {
    type: "address_message",
    body: { text: input.bodyText },
    action: {
      name: "address_message",
      parameters: {
        country: input.country,
        ...(input.saveAddressLabel ? { save_address: { label: input.saveAddressLabel } } : {}),
      },
    },
  };
  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.toE164.replace(/^\+/, ""),
    type: "interactive",
    interactive,
  };
  if (input.contextMessageId) payload.context = { message_id: input.contextMessageId };
  if (input.bizOpaqueCallbackData) payload.biz_opaque_callback_data = input.bizOpaqueCallbackData;
  return graphPost<{ messages: Array<{ id: string }> }>(
    `/${phone.phoneNumberId}/messages`,
    payload,
    token,
    v
  );
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
  const token = requireSystemUserToken(phone);
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
    v
  );
}

export type ContactCardInput = {
  name: { formatted_name: string; first_name?: string; last_name?: string };
  phones?: { phone: string; type?: string; wa_id?: string }[];
  emails?: { email: string; type?: string }[];
  org?: { company?: string; title?: string };
  addresses?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    country_code?: string;
    type?: string;
  }[];
  urls?: { url: string; type?: string }[];
  // ISO date YYYY-MM-DD.
  birthday?: string;
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
  const token = requireSystemUserToken(phone);
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
    v
  );
}

// Multi-Product Message (Meta 2026 Commerce). Renders a carousel of
// catalog products in WhatsApp. Requires the WABA to be linked to a
// Meta Commerce catalog with the listed retailer ids active.
export type SendMultiProductInput = {
  phoneNumberId: number;
  toE164: string;
  catalogId: string;
  bodyText: string;
  headerText: string;
  footerText?: string;
  sections: Array<{
    title: string;
    product_items: Array<{ product_retailer_id: string }>;
  }>;
  contextMessageId?: string;
  bizOpaqueCallbackData?: string;
};

export async function sendMultiProductMessage(input: SendMultiProductInput) {
  const phone = await getAccountForPhoneNumber(input.phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = requireSystemUserToken(phone);
  const interactive = {
    type: "product_list",
    header: { type: "text", text: input.headerText },
    body: { text: input.bodyText },
    ...(input.footerText ? { footer: { text: input.footerText } } : {}),
    action: {
      catalog_id: input.catalogId,
      sections: input.sections,
    },
  };
  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.toE164.replace(/^\+/, ""),
    type: "interactive",
    interactive,
  };
  if (input.contextMessageId) payload.context = { message_id: input.contextMessageId };
  if (input.bizOpaqueCallbackData) payload.biz_opaque_callback_data = input.bizOpaqueCallbackData;
  return graphPost<{ messages: Array<{ id: string }> }>(
    `/${phone.phoneNumberId}/messages`,
    payload,
    token,
    v
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
  const token = requireSystemUserToken(phone);
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
    v
  );
}

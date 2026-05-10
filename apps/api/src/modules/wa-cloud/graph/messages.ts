import { getAccountForPhoneNumber, graphPost } from "./_http.ts";

export type SendTextInput = {
  phoneNumberId: number;
  toE164: string;
  body: string;
  contextMessageId?: string;
  bizOpaqueCallbackData?: string;
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
  if (input.bizOpaqueCallbackData) {
    payload.biz_opaque_callback_data = input.bizOpaqueCallbackData;
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

export type TemplateComponentBase = {
  type: "header" | "body" | "footer" | "button";
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
  templateName: string;
  language: string;
  components?: TemplateComponentInput[];
  bizOpaqueCallbackData?: string;
};

export async function sendTemplateMessage(input: SendTemplateInput) {
  const phone = await getAccountForPhoneNumber(input.phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = phone.account.systemUserToken!;
  const payload: Record<string, unknown> = {
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
  if (input.bizOpaqueCallbackData) {
    payload.biz_opaque_callback_data = input.bizOpaqueCallbackData;
  }
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
  const token = phone.account.systemUserToken!;
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
  if (input.bizOpaqueCallbackData)
    payload.biz_opaque_callback_data = input.bizOpaqueCallbackData;
  return graphPost<{ messages: Array<{ id: string }> }>(
    `/${phone.phoneNumberId}/messages`,
    payload,
    token,
    v,
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
  const token = phone.account.systemUserToken!;
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
  if (input.bizOpaqueCallbackData)
    payload.biz_opaque_callback_data = input.bizOpaqueCallbackData;
  return graphPost<{ messages: Array<{ id: string }> }>(
    `/${phone.phoneNumberId}/messages`,
    payload,
    token,
    v,
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

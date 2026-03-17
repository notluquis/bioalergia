/**
 * Meta WhatsApp Business API client
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/
 */

const GRAPH_API_BASE = "https://graph.facebook.com/v22.0";

export interface WhatsappTemplateComponent {
  type: "header" | "body" | "button";
  parameters?: Array<{ type: "text" | "currency" | "date_time"; text?: string }>;
  sub_type?: string;
  index?: number;
}

export interface WhatsappSendResult {
  messageId: string;
  status: "sent" | "error";
  error?: string;
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

export async function sendTemplateMessage(
  to: string,
  templateName: string,
  languageCode: string,
  components?: WhatsappTemplateComponent[],
): Promise<WhatsappSendResult> {
  const { accessToken, phoneNumberId } = getConfig();

  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to: normalizePhone(to),
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components && components.length > 0 ? { components } : {}),
    },
  };

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
    messages?: Array<{ id: string }>;
  };

  const messageId = data.messages?.[0]?.id ?? "";
  return { messageId, status: "sent" };
}

/**
 * Normalize a Chilean phone number to E.164 format.
 * Accepts: +56912345678, 56912345678, 912345678, 09..., etc.
 */
export function normalizePhone(raw: string): string {
  // Remove all spaces and dashes
  const cleaned = raw.replace(/[\s\-().]/g, "");

  // Already E.164
  if (/^\+\d{10,15}$/.test(cleaned)) {
    return cleaned;
  }

  // Starts with 56 (Chile country code without +)
  if (/^56\d{9}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  // Chilean mobile: 9 digits starting with 9
  if (/^9\d{8}$/.test(cleaned)) {
    return `+56${cleaned}`;
  }

  // Just return with + prefix if nothing matched (let API handle validation)
  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
}

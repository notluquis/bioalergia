import { whatsappCustomMessageInputSchema } from "@finanzas/orpc-contracts/whatsapp";
import { z } from "zod";
import { toWhatsappApiError, whatsappORPCClient } from "./orpc";

export type WhatsappCustomMessageInput = z.infer<typeof whatsappCustomMessageInputSchema>;

export async function fetchWhatsappOverview() {
  try {
    return await whatsappORPCClient.getOverview({});
  } catch (error) {
    throw toWhatsappApiError(error);
  }
}

export async function fetchWhatsappNotifications(params: {
  limit?: number;
  offset?: number;
  status?: "PENDING" | "SENT" | "FAILED" | "DELIVERED" | "READ" | "PLAYED";
}) {
  try {
    return await whatsappORPCClient.listNotifications(params);
  } catch (error) {
    throw toWhatsappApiError(error);
  }
}

export async function fetchWhatsappContacts(params: {
  limit?: number;
  offset?: number;
  search?: string;
}) {
  try {
    return await whatsappORPCClient.listContacts(params);
  } catch (error) {
    throw toWhatsappApiError(error);
  }
}

export async function fetchWhatsappStats() {
  try {
    return await whatsappORPCClient.getStats({});
  } catch (error) {
    throw toWhatsappApiError(error);
  }
}

export async function sendWhatsappTest(phone: string) {
  try {
    return await whatsappORPCClient.testSend({ phone });
  } catch (error) {
    throw toWhatsappApiError(error);
  }
}

export async function setWhatsappContactConsent(args: {
  phone: string;
  source?: string;
  status: "OPTED_IN" | "OPTED_OUT";
}) {
  try {
    return await whatsappORPCClient.setContactConsent(args);
  } catch (error) {
    throw toWhatsappApiError(error);
  }
}

export async function sendWhatsappCustomMessage(payload: WhatsappCustomMessageInput) {
  try {
    return await whatsappORPCClient.sendCustomMessage(payload);
  } catch (error) {
    throw toWhatsappApiError(error);
  }
}

export async function fetchWhatsappTemplates() {
  try {
    return await whatsappORPCClient.listTemplates({});
  } catch (error) {
    throw toWhatsappApiError(error);
  }
}

export async function fetchWhatsappAccountInfo() {
  try {
    return await whatsappORPCClient.getAccountInfo({});
  } catch (error) {
    throw toWhatsappApiError(error);
  }
}

export async function triggerWhatsappPoll() {
  try {
    return await whatsappORPCClient.triggerPoll({});
  } catch (error) {
    throw toWhatsappApiError(error);
  }
}

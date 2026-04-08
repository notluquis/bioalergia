import {
  assignWhatsappBusinessChatLabelInputSchema,
  assignWhatsappBusinessMessageLabelInputSchema,
  saveWhatsappBusinessLabelInputSchema,
  saveWhatsappBusinessQuickReplyInputSchema,
  updateWhatsappBusinessProfileInputSchema,
  whatsappCustomMessageInputSchema,
} from "@finanzas/orpc-contracts/whatsapp";
import { z } from "zod";
import { toWhatsappApiError, whatsappORPCClient } from "./orpc";

export type WhatsappCustomMessageInput = z.infer<typeof whatsappCustomMessageInputSchema>;
export type WhatsappBusinessProfileInput = z.infer<typeof updateWhatsappBusinessProfileInputSchema>;
export type WhatsappBusinessQuickReplyInput = z.infer<
  typeof saveWhatsappBusinessQuickReplyInputSchema
>;
export type WhatsappBusinessLabelInput = z.infer<typeof saveWhatsappBusinessLabelInputSchema>;
export type WhatsappBusinessChatLabelInput = z.infer<
  typeof assignWhatsappBusinessChatLabelInputSchema
>;
export type WhatsappBusinessMessageLabelInput = z.infer<
  typeof assignWhatsappBusinessMessageLabelInputSchema
>;

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

export async function fetchWhatsappMessageHistory(params: {
  direction?: "inbound" | "outbound";
  jid?: string;
  limit?: number;
  offset?: number;
  phone?: string;
  status?: "DELIVERED" | "FAILED" | "PENDING" | "PLAYED" | "READ" | "RECEIVED" | "SENT";
  type?: string;
}) {
  try {
    return await whatsappORPCClient.listMessageHistory(params);
  } catch (error) {
    throw toWhatsappApiError(error);
  }
}

export async function fetchWhatsappConversationThread(params: {
  jid?: string;
  limit?: number;
  phone?: string;
}) {
  try {
    return await whatsappORPCClient.getConversationThread(params);
  } catch (error) {
    throw toWhatsappApiError(error);
  }
}

export async function fetchWhatsappChats(params: { limit?: number; offset?: number }) {
  try {
    return await whatsappORPCClient.listChats(params);
  } catch (error) {
    throw toWhatsappApiError(error);
  }
}

export async function fetchWhatsappBusinessProfile() {
  try {
    return await whatsappORPCClient.getBusinessProfile({});
  } catch (error) {
    throw toWhatsappApiError(error);
  }
}

export async function updateWhatsappBusinessProfile(input: WhatsappBusinessProfileInput) {
  try {
    return await whatsappORPCClient.updateBusinessProfile(input);
  } catch (error) {
    throw toWhatsappApiError(error);
  }
}

export async function updateWhatsappBusinessCoverPhoto(link: string) {
  try {
    return await whatsappORPCClient.updateBusinessCoverPhoto({ link });
  } catch (error) {
    throw toWhatsappApiError(error);
  }
}

export async function removeWhatsappBusinessCoverPhoto(coverPhotoId: string) {
  try {
    return await whatsappORPCClient.removeBusinessCoverPhoto({ coverPhotoId });
  } catch (error) {
    throw toWhatsappApiError(error);
  }
}

export async function fetchWhatsappBusinessQuickReplies(params?: { includeDeleted?: boolean }) {
  try {
    return await whatsappORPCClient.listBusinessQuickReplies(params ?? {});
  } catch (error) {
    throw toWhatsappApiError(error);
  }
}

export async function saveWhatsappBusinessQuickReply(input: WhatsappBusinessQuickReplyInput) {
  try {
    return await whatsappORPCClient.saveBusinessQuickReply(input);
  } catch (error) {
    throw toWhatsappApiError(error);
  }
}

export async function deleteWhatsappBusinessQuickReply(timestamp: string) {
  try {
    return await whatsappORPCClient.deleteBusinessQuickReply({ timestamp });
  } catch (error) {
    throw toWhatsappApiError(error);
  }
}

export async function fetchWhatsappBusinessLabels(params?: { includeDeleted?: boolean }) {
  try {
    return await whatsappORPCClient.listBusinessLabels(params ?? {});
  } catch (error) {
    throw toWhatsappApiError(error);
  }
}

export async function saveWhatsappBusinessLabel(input: WhatsappBusinessLabelInput) {
  try {
    return await whatsappORPCClient.saveBusinessLabel(input);
  } catch (error) {
    throw toWhatsappApiError(error);
  }
}

export async function fetchWhatsappBusinessChatLabels(params?: {
  chatJid?: string;
  limit?: number;
}) {
  try {
    return await whatsappORPCClient.listBusinessChatLabels(params ?? {});
  } catch (error) {
    throw toWhatsappApiError(error);
  }
}

export async function assignWhatsappBusinessChatLabel(input: WhatsappBusinessChatLabelInput) {
  try {
    return await whatsappORPCClient.assignBusinessChatLabel(input);
  } catch (error) {
    throw toWhatsappApiError(error);
  }
}

export async function removeWhatsappBusinessChatLabel(input: WhatsappBusinessChatLabelInput) {
  try {
    return await whatsappORPCClient.removeBusinessChatLabel(input);
  } catch (error) {
    throw toWhatsappApiError(error);
  }
}

export async function fetchWhatsappBusinessMessageLabels(params?: {
  chatJid?: string;
  limit?: number;
  messageId?: string;
}) {
  try {
    return await whatsappORPCClient.listBusinessMessageLabels(params ?? {});
  } catch (error) {
    throw toWhatsappApiError(error);
  }
}

export async function assignWhatsappBusinessMessageLabel(input: WhatsappBusinessMessageLabelInput) {
  try {
    return await whatsappORPCClient.assignBusinessMessageLabel(input);
  } catch (error) {
    throw toWhatsappApiError(error);
  }
}

export async function removeWhatsappBusinessMessageLabel(input: WhatsappBusinessMessageLabelInput) {
  try {
    return await whatsappORPCClient.removeBusinessMessageLabel(input);
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

export async function fetchWhatsappConnectionStatus() {
  try {
    return await whatsappORPCClient.getConnectionStatus({});
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

export async function toggleWhatsappConnection() {
  try {
    return await whatsappORPCClient.toggleConnection({});
  } catch (error) {
    throw toWhatsappApiError(error);
  }
}

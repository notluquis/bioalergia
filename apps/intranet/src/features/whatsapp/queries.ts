import { queryOptions } from "@tanstack/react-query";
import {
  fetchWhatsappBusinessChatLabels,
  fetchWhatsappBusinessLabels,
  fetchWhatsappBusinessMessageLabels,
  fetchWhatsappBusinessProfile,
  fetchWhatsappChatMeta,
  fetchWhatsappChatSidebar,
  fetchWhatsappChatThread,
  fetchWhatsappBusinessQuickReplies,
  fetchWhatsappChats,
  fetchWhatsappConnectionStatus,
  fetchWhatsappConversationThread,
  fetchWhatsappContacts,
  fetchWhatsappMessageReceipts,
  fetchWhatsappMessageReactions,
  fetchWhatsappMessageHistory,
  fetchWhatsappNotifications,
  fetchWhatsappOverview,
  fetchWhatsappPresenceStates,
  fetchWhatsappStats,
} from "./api";

export const whatsappKeys = {
  all: ["whatsapp"] as const,

  notifications: (params: {
    limit?: number;
    offset?: number;
    status?: "PENDING" | "SENT" | "FAILED" | "DELIVERED" | "READ" | "PLAYED";
  }) =>
    queryOptions({
      queryFn: () => fetchWhatsappNotifications(params),
      queryKey: ["whatsapp", "notifications", params],
    }),

  contacts: (params: { limit?: number; offset?: number; search?: string }) =>
    queryOptions({
      queryFn: () => fetchWhatsappContacts(params),
      queryKey: ["whatsapp", "contacts", params],
    }),

  messageHistory: (params: {
    direction?: "inbound" | "outbound";
    jid?: string;
    limit?: number;
    offset?: number;
    phone?: string;
    status?: "DELIVERED" | "FAILED" | "PENDING" | "PLAYED" | "READ" | "RECEIVED" | "SENT";
    type?: string;
  }) =>
    queryOptions({
      queryFn: () => fetchWhatsappMessageHistory(params),
      queryKey: ["whatsapp", "message-history", params],
    }),

  conversationThread: (params: { jid?: string; limit?: number; phone?: string }) =>
    queryOptions({
      queryFn: () => fetchWhatsappConversationThread(params),
      queryKey: ["whatsapp", "conversation-thread", params],
    }),

  chats: (params: { limit?: number; offset?: number }) =>
    queryOptions({
      queryFn: () => fetchWhatsappChats(params),
      queryKey: ["whatsapp", "chats", params],
    }),

  chatSidebar: (params?: {
    filter?: "all" | "archived" | "blocked" | "groups" | "unread";
    limit?: number;
    search?: string;
  }) =>
    queryOptions({
      queryFn: () => fetchWhatsappChatSidebar(params),
      queryKey: ["whatsapp", "chat-sidebar", params ?? {}],
    }),

  chatThread: (params: { before?: Date; jid?: string; limit?: number; phone?: string }) =>
    queryOptions({
      queryFn: () => fetchWhatsappChatThread(params),
      queryKey: ["whatsapp", "chat-thread", params],
    }),

  chatMeta: (params: { jid: string }) =>
    queryOptions({
      queryFn: () => fetchWhatsappChatMeta(params),
      queryKey: ["whatsapp", "chat-meta", params],
    }),

  messageReactions: (params: { jid: string; messageIds?: string[] }) =>
    queryOptions({
      queryFn: () => fetchWhatsappMessageReactions(params),
      queryKey: ["whatsapp", "chat-reactions", params],
    }),

  messageReceipts: (params: { jid: string; messageIds?: string[] }) =>
    queryOptions({
      queryFn: () => fetchWhatsappMessageReceipts(params),
      queryKey: ["whatsapp", "chat-receipts", params],
    }),

  presenceStates: (params?: { jid?: string }) =>
    queryOptions({
      queryFn: () => fetchWhatsappPresenceStates(params),
      queryKey: ["whatsapp", "chat-presence", params ?? {}],
    }),

  businessProfile: () =>
    queryOptions({
      queryFn: () => fetchWhatsappBusinessProfile(),
      queryKey: ["whatsapp", "business-profile"],
    }),

  businessQuickReplies: (params?: { includeDeleted?: boolean }) =>
    queryOptions({
      queryFn: () => fetchWhatsappBusinessQuickReplies(params),
      queryKey: ["whatsapp", "business-quick-replies", params ?? {}],
    }),

  businessLabels: (params?: { includeDeleted?: boolean }) =>
    queryOptions({
      queryFn: () => fetchWhatsappBusinessLabels(params),
      queryKey: ["whatsapp", "business-labels", params ?? {}],
    }),

  businessChatLabels: (params?: { chatJid?: string; limit?: number }) =>
    queryOptions({
      queryFn: () => fetchWhatsappBusinessChatLabels(params),
      queryKey: ["whatsapp", "business-chat-labels", params ?? {}],
    }),

  businessMessageLabels: (params?: { chatJid?: string; limit?: number; messageId?: string }) =>
    queryOptions({
      queryFn: () => fetchWhatsappBusinessMessageLabels(params),
      queryKey: ["whatsapp", "business-message-labels", params ?? {}],
    }),

  stats: () =>
    queryOptions({
      queryFn: () => fetchWhatsappStats(),
      queryKey: ["whatsapp", "stats"],
    }),

  overview: () =>
    queryOptions({
      queryFn: () => fetchWhatsappOverview(),
      queryKey: ["whatsapp", "overview"],
    }),

  connectionStatus: () =>
    queryOptions({
      queryFn: () => fetchWhatsappConnectionStatus(),
      queryKey: ["whatsapp", "connection-status"],
      refetchInterval: 3_000,
    }),
};

import { oc } from "@orpc/contract";
import { z } from "zod";

export const whatsappNotificationStatusSchema = z.enum([
  "PENDING",
  "SENT",
  "FAILED",
  "DELIVERED",
  "READ",
  "PLAYED",
]);

export const whatsappOptInStatusSchema = z.enum(["UNKNOWN", "OPTED_IN", "OPTED_OUT"]);

export const whatsappNotificationSchema = z.object({
  appointmentDate: z.coerce.date().nullable().optional(),
  appointmentDoctor: z.string().nullable().optional(),
  appointmentService: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
  deliveredAt: z.coerce.date().nullable().optional(),
  emailMessageId: z.string(),
  errorMessage: z.string().nullable().optional(),
  id: z.string(),
  messagePacingStatus: z.string().nullable().optional(),
  patientEmail: z.string().nullable().optional(),
  patientName: z.string(),
  patientPhone: z.string(),
  playedAt: z.coerce.date().nullable().optional(),
  readAt: z.coerce.date().nullable().optional(),
  recipientWaId: z.string().nullable().optional(),
  sentAt: z.coerce.date().nullable().optional(),
  status: whatsappNotificationStatusSchema,
  updatedAt: z.coerce.date(),
  waMessageId: z.string().nullable().optional(),
});

export const listWhatsappNotificationsInputSchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
  status: whatsappNotificationStatusSchema.optional(),
});

export const listWhatsappNotificationsResponseSchema = z.object({
  notifications: z.array(whatsappNotificationSchema),
  total: z.number(),
});

export const whatsappStatsSchema = z.object({
  delivered: z.number(),
  failed: z.number(),
  pending: z.number(),
  played: z.number(),
  read: z.number(),
  sent: z.number(),
  total: z.number(),
});

export const whatsappContactStateSchema = z.object({
  conversationExpiresAt: z.coerce.date().nullable().optional(),
  conversationId: z.string().nullable().optional(),
  conversationOriginType: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
  lastInboundAt: z.coerce.date().nullable().optional(),
  lastInboundCallAt: z.coerce.date().nullable().optional(),
  lastInboundCallId: z.string().nullable().optional(),
  lastInboundMessageId: z.string().nullable().optional(),
  lastInboundText: z.string().nullable().optional(),
  optInSource: z.string().nullable().optional(),
  optInStatus: whatsappOptInStatusSchema,
  optedInAt: z.coerce.date().nullable().optional(),
  optedOutAt: z.coerce.date().nullable().optional(),
  phone: z.string(),
  updatedAt: z.coerce.date(),
  waId: z.string().nullable().optional(),
  windowExpiresAt: z.coerce.date().nullable().optional(),
});

export const listWhatsappContactStatesInputSchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
  search: z.string().trim().min(1).optional(),
});

export const listWhatsappContactStatesResponseSchema = z.object({
  contacts: z.array(whatsappContactStateSchema),
  total: z.number(),
});

export const whatsappConnectionStateSchema = z.enum(["open", "connecting", "close"]);

export const whatsappOverviewSchema = z.object({
  autoOptInOnInbound: z.boolean(),
  connected: z.boolean(),
  connectionState: whatsappConnectionStateSchema,
  automaticFlowReady: z.boolean(),
  automaticNotificationsEnabled: z.boolean(),
  isReady: z.boolean(),
  optInRequired: z.boolean(),
  optedInContacts: z.number().int().min(0),
  optedOutContacts: z.number().int().min(0),
  sessionReplaced: z.boolean(),
  unknownConsentContacts: z.number().int().min(0),
});

export const whatsappConnectionStatusSchema = z.object({
  browser: z.string().nullable().optional(),
  connectedAt: z.coerce.date().nullable().optional(),
  connectionState: whatsappConnectionStateSchema,
  enabled: z.boolean(),
  isReady: z.boolean(),
  isReconnectLooping: z.boolean().optional(),
  lastDisconnectReason: z.number().nullable(),
  lastReconnectDelayMs: z.number().nullable().optional(),
  qrDataUrl: z.string().nullable(),
  receivedPendingNotifications: z.boolean(),
  reconnectAttempts: z.number().int().min(0).optional(),
  sessionReplaced: z.boolean(),
  version: z.string().nullable().optional(),
});

export const whatsappTestSendInputSchema = z.object({
  phone: z.string().min(5),
});

export const whatsappSetContactConsentInputSchema = z.object({
  phone: z.string().min(5),
  source: z.string().trim().min(1).optional(),
  status: whatsappOptInStatusSchema.exclude(["UNKNOWN"]),
});

export const whatsappMessageStatusSchema = z.enum([
  "PENDING",
  "SENT",
  "DELIVERED",
  "READ",
  "PLAYED",
  "FAILED",
  "RECEIVED",
]);

export const whatsappMessageDirectionSchema = z.enum(["inbound", "outbound"]);

export const whatsappMessageSchema = z.object({
  createdAt: z.coerce.date(),
  deliveredAt: z.coerce.date().nullable().optional(),
  direction: whatsappMessageDirectionSchema,
  fromMe: z.boolean(),
  messageId: z.string(),
  messageTimestamp: z.coerce.date().nullable().optional(),
  messageType: z.string(),
  participantJid: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  playedAt: z.coerce.date().nullable().optional(),
  readAt: z.coerce.date().nullable().optional(),
  remoteJid: z.string(),
  sentAt: z.coerce.date().nullable().optional(),
  status: whatsappMessageStatusSchema,
  textPreview: z.string().nullable().optional(),
  updatedAt: z.coerce.date(),
  waId: z.string().nullable().optional(),
});

export const listWhatsappMessageHistoryInputSchema = z.object({
  direction: whatsappMessageDirectionSchema.optional(),
  jid: z.string().trim().min(1).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
  phone: z.string().trim().min(5).optional(),
  status: whatsappMessageStatusSchema.optional(),
  type: z.string().trim().min(1).optional(),
});

export const listWhatsappMessageHistoryResponseSchema = z.object({
  records: z.array(whatsappMessageSchema),
  total: z.number(),
});

export const whatsappConversationThreadInputSchema = z
  .object({
    jid: z.string().trim().min(1).optional(),
    limit: z.number().int().min(1).max(500).optional(),
    phone: z.string().trim().min(5).optional(),
  })
  .refine((value) => Boolean(value.jid || value.phone), {
    message: "Debes enviar phone o jid",
    path: ["phone"],
  });

export const whatsappChatSchema = z.object({
  archived: z.boolean().nullable().optional(),
  conversationTimestamp: z.coerce.date().nullable().optional(),
  ephemeralExpiration: z.number().int().nullable().optional(),
  isBlocked: z.boolean().nullable().optional(),
  isGroup: z.boolean().nullable().optional(),
  jid: z.string(),
  lastMessageId: z.string().nullable().optional(),
  lastMessagePreview: z.string().nullable().optional(),
  muteEndTime: z.coerce.date().nullable().optional(),
  name: z.string().nullable().optional(),
  notSpam: z.boolean().nullable().optional(),
  pinned: z.boolean().nullable().optional(),
  profilePictureUrl: z.string().nullable().optional(),
  unreadCount: z.number().nullable().optional(),
  updatedAt: z.coerce.date(),
});

export const listWhatsappChatsInputSchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
});

export const listWhatsappChatsResponseSchema = z.object({
  records: z.array(whatsappChatSchema),
  total: z.number(),
});

export const whatsappPresenceStateSchema = z.object({
  chatJid: z.string(),
  lastKnownPresence: z.string(),
  lastSeen: z.coerce.date().nullable().optional(),
  participantJid: z.string(),
  updatedAt: z.coerce.date().nullable().optional(),
});

export const whatsappMessageReactionSchema = z.object({
  actorJid: z.string(),
  emoji: z.string(),
  messageId: z.string(),
  removed: z.boolean(),
  updatedAt: z.coerce.date(),
});

export const whatsappMessageReceiptSchema = z.object({
  deliveredDevices: z.array(z.string()),
  messageId: z.string(),
  playedAt: z.coerce.date().nullable().optional(),
  readAt: z.coerce.date().nullable().optional(),
  receiptAt: z.coerce.date().nullable().optional(),
  receiptType: z.string(),
  recipientJid: z.string(),
  updatedAt: z.coerce.date(),
});

export const whatsappChatSidebarFilterSchema = z.enum([
  "all",
  "unread",
  "archived",
  "blocked",
  "groups",
]);

export const whatsappChatSidebarItemSchema = z.object({
  avatarUrl: z.string().nullable().optional(),
  isArchived: z.boolean(),
  isBlocked: z.boolean(),
  isGroup: z.boolean(),
  isMuted: z.boolean(),
  jid: z.string(),
  lastMessageAt: z.coerce.date().nullable().optional(),
  lastMessagePreview: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  presence: z.string().nullable().optional(),
  typing: z.boolean(),
  unreadCount: z.number().int(),
});

export const listWhatsappChatSidebarInputSchema = z.object({
  filter: whatsappChatSidebarFilterSchema.optional(),
  limit: z.number().int().min(1).max(200).optional(),
  search: z.string().trim().min(1).optional(),
});

export const listWhatsappChatSidebarResponseSchema = z.object({
  records: z.array(whatsappChatSidebarItemSchema),
});

export const whatsappChatThreadMessageSchema = z.object({
  createdAt: z.coerce.date().nullable().optional(),
  deletedForEveryone: z.boolean(),
  deletedForMe: z.boolean(),
  direction: whatsappMessageDirectionSchema,
  fromMe: z.boolean(),
  hasMedia: z.boolean(),
  mediaMissing: z.boolean(),
  messageId: z.string(),
  messageType: z.string(),
  messageTimestamp: z.coerce.date().nullable().optional(),
  participantJid: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  quotedMessageId: z.string().nullable().optional(),
  quotedPreview: z.string().nullable().optional(),
  reactions: z.array(whatsappMessageReactionSchema),
  receipts: z.array(whatsappMessageReceiptSchema),
  remoteJid: z.string(),
  starred: z.boolean(),
  status: z.string(),
  textPreview: z.string().nullable().optional(),
  updatedAt: z.coerce.date().nullable().optional(),
  waId: z.string().nullable().optional(),
});

export const getWhatsappChatThreadInputSchema = z
  .object({
    before: z.coerce.date().optional(),
    jid: z.string().trim().min(1).optional(),
    limit: z.number().int().min(1).max(500).optional(),
    phone: z.string().trim().min(5).optional(),
  })
  .refine((value) => Boolean(value.jid || value.phone), {
    message: "Debes enviar phone o jid",
    path: ["phone"],
  });

export const loadWhatsappOlderMessagesInputSchema = z.object({
  count: z.number().int().min(1).max(200).optional(),
  jid: z.string().trim().min(1),
  oldestMessageId: z.string().trim().min(1),
  oldestTimestamp: z.coerce.date(),
});

export const whatsappChatMetaSchema = z.object({
  avatarUrl: z.string().nullable().optional(),
  disappearingDuration: z.number().int().nullable().optional(),
  groupMeta: z
    .object({
      desc: z.string().nullable().optional(),
      owner: z.string().nullable().optional(),
      participants: z.array(
        z.object({
          admin: z.string().nullable().optional(),
          isSuperAdmin: z.boolean().nullable().optional(),
          participantJid: z.string(),
        }),
      ),
      size: z.number().int().nullable().optional(),
      subject: z.string(),
    })
    .nullable(),
  isBlocked: z.boolean(),
  jid: z.string(),
  name: z.string().nullable().optional(),
  statusText: z.string().nullable().optional(),
});

export const getWhatsappChatMetaInputSchema = z.object({
  jid: z.string().trim().min(1),
});

export const listWhatsappMessageReactionsInputSchema = z.object({
  jid: z.string().trim().min(1),
  messageIds: z.array(z.string().trim().min(1)).optional(),
});

export const listWhatsappMessageReceiptsInputSchema = z.object({
  jid: z.string().trim().min(1),
  messageIds: z.array(z.string().trim().min(1)).optional(),
});

export const listWhatsappPresenceStatesInputSchema = z.object({
  jid: z.string().trim().min(1).optional(),
});

export const whatsappArchiveChatInputSchema = z.object({
  archive: z.boolean(),
  jid: z.string().trim().min(1),
});

export const whatsappMuteChatInputSchema = z.object({
  jid: z.string().trim().min(1),
  until: z.coerce.date().nullable().optional(),
});

export const whatsappMarkChatReadInputSchema = z.object({
  jid: z.string().trim().min(1),
  markRead: z.boolean(),
});

export const whatsappSetChatDisappearingModeInputSchema = z.object({
  duration: z.number().int().min(0),
  jid: z.string().trim().min(1),
});

export const whatsappStarMessagesInputSchema = z.object({
  jid: z.string().trim().min(1),
  messages: z
    .array(
      z.object({
        fromMe: z.boolean().optional(),
        id: z.string().trim().min(1),
      }),
    )
    .min(1),
  star: z.boolean(),
});

export const whatsappBlockChatInputSchema = z.object({
  action: z.enum(["block", "unblock"]),
  jid: z.string().trim().min(1),
});

const whatsappBusinessDaySchema = z.enum(["sun", "mon", "tue", "wed", "thu", "fri", "sat"]);

export const whatsappBusinessHoursConfigSchema = z.discriminatedUnion("mode", [
  z.object({
    closeTime: z.number().int().min(0).max(1440).optional(),
    dayOfWeek: z.string(),
    mode: z.literal("specific_hours"),
    openTime: z.number().int().min(0).max(1440).optional(),
  }),
  z.object({
    dayOfWeek: z.string(),
    mode: z.enum(["open_24h", "appointment_only"]),
  }),
]);

export const whatsappBusinessProfileSchema = z.object({
  address: z.string().optional(),
  businessHours: z
    .object({
      config: z.array(whatsappBusinessHoursConfigSchema),
      timezone: z.string().optional(),
    })
    .nullable(),
  category: z.string().optional(),
  description: z.string(),
  email: z.string().optional(),
  website: z.array(z.string()),
  wid: z.string().optional(),
});

export const whatsappBusinessProfileStateSchema = z.object({
  profile: whatsappBusinessProfileSchema.nullable(),
  savedCoverPhotoId: z.string().nullable(),
});

export const updateWhatsappBusinessProfileInputSchema = z.object({
  address: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional(),
  hours: z
    .object({
      days: z.array(
        z.discriminatedUnion("mode", [
          z.object({
            closeTimeInMinutes: z.string().trim().min(1),
            day: whatsappBusinessDaySchema,
            mode: z.literal("specific_hours"),
            openTimeInMinutes: z.string().trim().min(1),
          }),
          z.object({
            day: whatsappBusinessDaySchema,
            mode: z.enum(["open_24h", "appointment_only"]),
          }),
        ]),
      ),
      timezone: z.string().trim().min(1),
    })
    .optional(),
  websites: z.array(z.string().trim().min(1)).optional(),
});

export const updateWhatsappBusinessCoverPhotoInputSchema = z.object({
  link: z.url(),
});

export const removeWhatsappBusinessCoverPhotoInputSchema = z.object({
  coverPhotoId: z.string().trim().min(1),
});

export const whatsappBusinessCoverPhotoResultSchema = z.object({
  coverPhotoId: z.string(),
});

export const whatsappBusinessQuickReplySchema = z.object({
  count: z.number().int().min(0),
  deleted: z.boolean(),
  keywords: z.array(z.string()),
  message: z.string(),
  shortcut: z.string(),
  timestamp: z.string(),
  updatedAt: z.coerce.date(),
});

export const listWhatsappBusinessQuickRepliesInputSchema = z.object({
  includeDeleted: z.boolean().optional(),
});

export const listWhatsappBusinessQuickRepliesResponseSchema = z.object({
  records: z.array(whatsappBusinessQuickReplySchema),
});

export const saveWhatsappBusinessQuickReplyInputSchema = z.object({
  keywords: z.array(z.string().trim().min(1)).optional(),
  message: z.string().trim().min(1),
  shortcut: z.string().trim().min(1),
  timestamp: z.string().trim().min(1).optional(),
});

export const deleteWhatsappBusinessQuickReplyInputSchema = z.object({
  timestamp: z.string().trim().min(1),
});

export const whatsappBusinessLabelSchema = z.object({
  color: z.number().int().min(0).max(19).nullable(),
  deleted: z.boolean(),
  id: z.string(),
  name: z.string().nullable(),
  predefinedId: z.string().nullable(),
  updatedAt: z.coerce.date(),
});

export const listWhatsappBusinessLabelsInputSchema = z.object({
  includeDeleted: z.boolean().optional(),
});

export const listWhatsappBusinessLabelsResponseSchema = z.object({
  records: z.array(whatsappBusinessLabelSchema),
});

export const saveWhatsappBusinessLabelInputSchema = z.object({
  color: z.number().int().min(0).max(19).nullable().optional(),
  deleted: z.boolean().optional(),
  id: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).optional(),
  predefinedId: z.string().trim().min(1).optional(),
});

export const whatsappBusinessChatLabelSchema = z.object({
  chatJid: z.string(),
  labelId: z.string(),
  labelName: z.string().nullable(),
  updatedAt: z.coerce.date(),
});

export const whatsappBusinessMessageLabelSchema = z.object({
  chatJid: z.string(),
  labelId: z.string(),
  labelName: z.string().nullable(),
  messageId: z.string(),
  updatedAt: z.coerce.date(),
});

export const listWhatsappBusinessChatLabelsInputSchema = z.object({
  chatJid: z.string().trim().min(1).optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

export const listWhatsappBusinessMessageLabelsInputSchema = z.object({
  chatJid: z.string().trim().min(1).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  messageId: z.string().trim().min(1).optional(),
});

export const listWhatsappBusinessChatLabelsResponseSchema = z.object({
  records: z.array(whatsappBusinessChatLabelSchema),
});

export const listWhatsappBusinessMessageLabelsResponseSchema = z.object({
  records: z.array(whatsappBusinessMessageLabelSchema),
});

export const assignWhatsappBusinessChatLabelInputSchema = z.object({
  chatJid: z.string().trim().min(1),
  labelId: z.string().trim().min(1),
});

export const assignWhatsappBusinessMessageLabelInputSchema = z.object({
  chatJid: z.string().trim().min(1),
  labelId: z.string().trim().min(1),
  messageId: z.string().trim().min(1),
});

const whatsappMediaBaseSchema = z
  .object({
    caption: z.string().min(1).max(1024).optional(),
    filename: z.string().min(1).optional(),
    link: z.url().optional(),
    phone: z.string().min(5),
    replyToMessageId: z.string().min(1).optional(),
  })
  .refine((value) => Boolean(value.link), {
    message: "Debes enviar una URL del medio",
    path: ["link"],
  });

export const whatsappCustomMessageInputSchema = z.discriminatedUnion("kind", [
  z.object({
    body: z.string().min(1),
    kind: z.literal("contextual_text"),
    phone: z.string().min(5),
    previewUrl: z.boolean().optional(),
    quotedMessageId: z.string().min(1).optional(),
  }),
  z.object({
    emoji: z.string().min(1).max(8),
    kind: z.literal("reaction"),
    messageId: z.string().min(1),
    phone: z.string().min(5),
  }),
  z.object({
    kind: z.literal("mark_read"),
    messageId: z.string().min(1),
    phone: z.string().min(5),
  }),
  whatsappMediaBaseSchema.extend({
    kind: z.literal("image"),
  }),
  whatsappMediaBaseSchema.extend({
    kind: z.literal("audio"),
  }),
  whatsappMediaBaseSchema.extend({
    kind: z.literal("document"),
  }),
  whatsappMediaBaseSchema.extend({
    kind: z.literal("video"),
  }),
  whatsappMediaBaseSchema.extend({
    kind: z.literal("sticker"),
  }),
  z.object({
    kind: z.literal("typing"),
    phone: z.string().min(5),
  }),
  z.object({
    kind: z.literal("forward"),
    messageId: z.string().min(1),
    phone: z.string().min(5),
  }),
  z.object({
    kind: z.literal("delete"),
    messageId: z.string().min(1),
    phone: z.string().min(5),
  }),
  z.object({
    body: z.string().min(1),
    kind: z.literal("edit"),
    messageId: z.string().min(1),
    phone: z.string().min(5),
  }),
  z.object({
    address: z.string().min(1).optional(),
    degreesLatitude: z.number().min(-90).max(90),
    degreesLongitude: z.number().min(-180).max(180),
    kind: z.literal("location"),
    name: z.string().min(1).optional(),
    phone: z.string().min(5),
  }),
  z.object({
    contacts: z
      .array(
        z.object({
          displayName: z.string().min(1),
          firstName: z.string().min(1).optional(),
          organization: z.string().min(1).optional(),
          phone: z.string().min(5),
        }),
      )
      .min(1),
    kind: z.literal("contacts"),
    phone: z.string().min(5),
  }),
  z.object({
    expiration: z.union([
      z.boolean(),
      z.literal(86400),
      z.literal(604800),
      z.literal(2592000),
    ]),
    kind: z.literal("disappearing_messages"),
    phone: z.string().min(5),
  }),
]);

export const whatsappStatusResponseSchema = z.object({
  message: z.string(),
  messageId: z.string().optional(),
  status: z.enum(["ok", "error"]),
});

export const whatsappContract = {
  listNotifications: oc
    .route({
      method: "GET",
      path: "/notifications",
      summary: "List WhatsApp notifications",
      tags: ["WhatsApp"],
    })
    .input(listWhatsappNotificationsInputSchema)
    .output(listWhatsappNotificationsResponseSchema),

  getStats: oc
    .route({
      method: "GET",
      path: "/stats",
      summary: "Get WhatsApp notification stats",
      tags: ["WhatsApp"],
    })
    .output(whatsappStatsSchema),

  getOverview: oc
    .route({
      method: "GET",
      path: "/overview",
      summary: "Get WhatsApp integration overview",
      tags: ["WhatsApp"],
    })
    .output(whatsappOverviewSchema),

  listContacts: oc
    .route({
      method: "GET",
      path: "/contacts",
      summary: "List WhatsApp contact states and consent records",
      tags: ["WhatsApp"],
    })
    .input(listWhatsappContactStatesInputSchema)
    .output(listWhatsappContactStatesResponseSchema),

  setContactConsent: oc
    .route({
      method: "POST",
      path: "/contacts/consent",
      summary: "Set WhatsApp contact consent",
      tags: ["WhatsApp"],
    })
    .input(whatsappSetContactConsentInputSchema)
    .output(whatsappContactStateSchema),

  testSend: oc
    .route({
      method: "POST",
      path: "/test-send",
      summary: "Send a test WhatsApp message",
      tags: ["WhatsApp"],
    })
    .input(whatsappTestSendInputSchema)
    .output(whatsappStatusResponseSchema),

  sendCustomMessage: oc
    .route({
      method: "POST",
      path: "/send-custom",
      summary: "Send advanced WhatsApp message types",
      tags: ["WhatsApp"],
    })
    .input(whatsappCustomMessageInputSchema)
    .output(whatsappStatusResponseSchema),

  listMessageHistory: oc
    .route({
      method: "GET",
      path: "/messages",
      summary: "List persisted WhatsApp message history",
      tags: ["WhatsApp"],
    })
    .input(listWhatsappMessageHistoryInputSchema)
    .output(listWhatsappMessageHistoryResponseSchema),

  getConversationThread: oc
    .route({
      method: "GET",
      path: "/messages/thread",
      summary: "Get a WhatsApp conversation thread",
      tags: ["WhatsApp"],
    })
    .input(whatsappConversationThreadInputSchema)
    .output(z.array(whatsappMessageSchema)),

  listChats: oc
    .route({
      method: "GET",
      path: "/chats",
      summary: "List WhatsApp chats from history sync",
      tags: ["WhatsApp"],
    })
    .input(listWhatsappChatsInputSchema)
    .output(listWhatsappChatsResponseSchema),

  listChatSidebar: oc
    .route({
      method: "GET",
      path: "/chat/sidebar",
      summary: "List WhatsApp chats for the chat sidebar",
      tags: ["WhatsApp"],
    })
    .input(listWhatsappChatSidebarInputSchema)
    .output(listWhatsappChatSidebarResponseSchema),

  getChatThread: oc
    .route({
      method: "GET",
      path: "/chat/thread",
      summary: "Get WhatsApp chat thread with reactions and receipts",
      tags: ["WhatsApp"],
    })
    .input(getWhatsappChatThreadInputSchema)
    .output(z.array(whatsappChatThreadMessageSchema)),

  loadOlderMessages: oc
    .route({
      method: "POST",
      path: "/chat/thread/load-older",
      summary: "Load older WhatsApp messages into the thread",
      tags: ["WhatsApp"],
    })
    .input(loadWhatsappOlderMessagesInputSchema)
    .output(z.array(whatsappChatThreadMessageSchema)),

  getChatMeta: oc
    .route({
      method: "GET",
      path: "/chat/meta",
      summary: "Get enriched WhatsApp chat metadata",
      tags: ["WhatsApp"],
    })
    .input(getWhatsappChatMetaInputSchema)
    .output(whatsappChatMetaSchema),

  listMessageReactions: oc
    .route({
      method: "GET",
      path: "/chat/reactions",
      summary: "List persisted WhatsApp reactions",
      tags: ["WhatsApp"],
    })
    .input(listWhatsappMessageReactionsInputSchema)
    .output(z.array(whatsappMessageReactionSchema)),

  listMessageReceipts: oc
    .route({
      method: "GET",
      path: "/chat/receipts",
      summary: "List persisted WhatsApp receipts",
      tags: ["WhatsApp"],
    })
    .input(listWhatsappMessageReceiptsInputSchema)
    .output(z.array(whatsappMessageReceiptSchema)),

  listPresenceStates: oc
    .route({
      method: "GET",
      path: "/chat/presence",
      summary: "List persisted WhatsApp presence snapshots",
      tags: ["WhatsApp"],
    })
    .input(listWhatsappPresenceStatesInputSchema)
    .output(z.array(whatsappPresenceStateSchema)),

  archiveChat: oc
    .route({
      method: "POST",
      path: "/chat/archive",
      summary: "Archive or unarchive a WhatsApp chat",
      tags: ["WhatsApp"],
    })
    .input(whatsappArchiveChatInputSchema)
    .output(whatsappStatusResponseSchema),

  muteChat: oc
    .route({
      method: "POST",
      path: "/chat/mute",
      summary: "Mute or unmute a WhatsApp chat",
      tags: ["WhatsApp"],
    })
    .input(whatsappMuteChatInputSchema)
    .output(whatsappStatusResponseSchema),

  markChatReadState: oc
    .route({
      method: "POST",
      path: "/chat/read-state",
      summary: "Mark a WhatsApp chat as read or unread",
      tags: ["WhatsApp"],
    })
    .input(whatsappMarkChatReadInputSchema)
    .output(whatsappStatusResponseSchema),

  setChatDisappearingMode: oc
    .route({
      method: "POST",
      path: "/chat/disappearing-mode",
      summary: "Set a WhatsApp chat disappearing mode",
      tags: ["WhatsApp"],
    })
    .input(whatsappSetChatDisappearingModeInputSchema)
    .output(whatsappStatusResponseSchema),

  starMessages: oc
    .route({
      method: "POST",
      path: "/chat/star",
      summary: "Star or unstar WhatsApp messages",
      tags: ["WhatsApp"],
    })
    .input(whatsappStarMessagesInputSchema)
    .output(whatsappStatusResponseSchema),

  blockChat: oc
    .route({
      method: "POST",
      path: "/chat/block",
      summary: "Block or unblock a WhatsApp chat",
      tags: ["WhatsApp"],
    })
    .input(whatsappBlockChatInputSchema)
    .output(whatsappStatusResponseSchema),

  getBusinessProfile: oc
    .route({
      method: "GET",
      path: "/business/profile",
      summary: "Get WhatsApp business profile state",
      tags: ["WhatsApp"],
    })
    .output(whatsappBusinessProfileStateSchema),

  updateBusinessProfile: oc
    .route({
      method: "POST",
      path: "/business/profile",
      summary: "Update WhatsApp business profile",
      tags: ["WhatsApp"],
    })
    .input(updateWhatsappBusinessProfileInputSchema)
    .output(whatsappBusinessProfileSchema.nullable()),

  updateBusinessCoverPhoto: oc
    .route({
      method: "POST",
      path: "/business/cover-photo",
      summary: "Update WhatsApp business cover photo",
      tags: ["WhatsApp"],
    })
    .input(updateWhatsappBusinessCoverPhotoInputSchema)
    .output(whatsappBusinessCoverPhotoResultSchema),

  removeBusinessCoverPhoto: oc
    .route({
      method: "POST",
      path: "/business/cover-photo/remove",
      summary: "Remove WhatsApp business cover photo",
      tags: ["WhatsApp"],
    })
    .input(removeWhatsappBusinessCoverPhotoInputSchema)
    .output(whatsappStatusResponseSchema),

  listBusinessQuickReplies: oc
    .route({
      method: "GET",
      path: "/business/quick-replies",
      summary: "List WhatsApp business quick replies",
      tags: ["WhatsApp"],
    })
    .input(listWhatsappBusinessQuickRepliesInputSchema)
    .output(listWhatsappBusinessQuickRepliesResponseSchema),

  saveBusinessQuickReply: oc
    .route({
      method: "POST",
      path: "/business/quick-replies",
      summary: "Create or update a WhatsApp business quick reply",
      tags: ["WhatsApp"],
    })
    .input(saveWhatsappBusinessQuickReplyInputSchema)
    .output(whatsappBusinessQuickReplySchema),

  deleteBusinessQuickReply: oc
    .route({
      method: "POST",
      path: "/business/quick-replies/delete",
      summary: "Delete a WhatsApp business quick reply",
      tags: ["WhatsApp"],
    })
    .input(deleteWhatsappBusinessQuickReplyInputSchema)
    .output(whatsappStatusResponseSchema),

  listBusinessLabels: oc
    .route({
      method: "GET",
      path: "/business/labels",
      summary: "List WhatsApp business labels",
      tags: ["WhatsApp"],
    })
    .input(listWhatsappBusinessLabelsInputSchema)
    .output(listWhatsappBusinessLabelsResponseSchema),

  saveBusinessLabel: oc
    .route({
      method: "POST",
      path: "/business/labels",
      summary: "Create or update a WhatsApp business label",
      tags: ["WhatsApp"],
    })
    .input(saveWhatsappBusinessLabelInputSchema)
    .output(whatsappBusinessLabelSchema),

  listBusinessChatLabels: oc
    .route({
      method: "GET",
      path: "/business/labels/chat",
      summary: "List chat label associations",
      tags: ["WhatsApp"],
    })
    .input(listWhatsappBusinessChatLabelsInputSchema)
    .output(listWhatsappBusinessChatLabelsResponseSchema),

  assignBusinessChatLabel: oc
    .route({
      method: "POST",
      path: "/business/labels/chat",
      summary: "Assign a business label to a chat",
      tags: ["WhatsApp"],
    })
    .input(assignWhatsappBusinessChatLabelInputSchema)
    .output(whatsappStatusResponseSchema),

  removeBusinessChatLabel: oc
    .route({
      method: "POST",
      path: "/business/labels/chat/remove",
      summary: "Remove a business label from a chat",
      tags: ["WhatsApp"],
    })
    .input(assignWhatsappBusinessChatLabelInputSchema)
    .output(whatsappStatusResponseSchema),

  listBusinessMessageLabels: oc
    .route({
      method: "GET",
      path: "/business/labels/message",
      summary: "List message label associations",
      tags: ["WhatsApp"],
    })
    .input(listWhatsappBusinessMessageLabelsInputSchema)
    .output(listWhatsappBusinessMessageLabelsResponseSchema),

  assignBusinessMessageLabel: oc
    .route({
      method: "POST",
      path: "/business/labels/message",
      summary: "Assign a business label to a message",
      tags: ["WhatsApp"],
    })
    .input(assignWhatsappBusinessMessageLabelInputSchema)
    .output(whatsappStatusResponseSchema),

  removeBusinessMessageLabel: oc
    .route({
      method: "POST",
      path: "/business/labels/message/remove",
      summary: "Remove a business label from a message",
      tags: ["WhatsApp"],
    })
    .input(assignWhatsappBusinessMessageLabelInputSchema)
    .output(whatsappStatusResponseSchema),

  getConnectionStatus: oc
    .route({
      method: "GET",
      path: "/connection-status",
      summary: "Get Baileys WhatsApp connection status and QR code",
      tags: ["WhatsApp"],
    })
    .output(whatsappConnectionStatusSchema),

  toggleConnection: oc
    .route({
      method: "POST",
      path: "/toggle-connection",
      summary: "Enable or disable Baileys WhatsApp connection",
      tags: ["WhatsApp"],
    })
    .output(whatsappStatusResponseSchema),

  triggerPoll: oc
    .route({
      method: "POST",
      path: "/trigger-poll",
      summary: "Manually trigger the legacy Doctoralia IMAP poll",
      tags: ["WhatsApp"],
    })
    .output(whatsappStatusResponseSchema),
};

export type WhatsappContract = typeof whatsappContract;

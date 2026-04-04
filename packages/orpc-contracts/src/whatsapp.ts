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

export const whatsappSendModeSchema = z.enum(["template", "text"]);

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

export const whatsappOverviewSchema = z.object({
  accessTokenConfigured: z.boolean(),
  activeCustomerServiceWindows: z.number().int().min(0),
  appSecretConfigured: z.boolean(),
  autoOptInOnInbound: z.boolean(),
  automaticFlowReady: z.boolean(),
  automaticNotificationsEnabled: z.boolean(),
  freeformMessageConfigured: z.boolean(),
  graphApiVersion: z.string(),
  hybridFlowReady: z.boolean(),
  imapHostConfigured: z.boolean(),
  imapMailbox: z.string(),
  imapPassConfigured: z.boolean(),
  imapReady: z.boolean(),
  imapUserConfigured: z.boolean(),
  optInRequired: z.boolean(),
  optedInContacts: z.number().int().min(0),
  optedOutContacts: z.number().int().min(0),
  outboundReady: z.boolean(),
  phoneNumberIdConfigured: z.boolean(),
  pollCron: z.string(),
  senderFilter: z.string(),
  supportsCalls: z.boolean(),
  supportsContextualReplies: z.boolean(),
  supportsInteractive: z.boolean(),
  supportsMarkAsRead: z.boolean(),
  supportsMedia: z.boolean(),
  supportsReactions: z.boolean(),
  supportsTypingIndicator: z.boolean(),
  templateLanguage: z.string().nullable(),
  templateName: z.string().nullable(),
  unknownConsentContacts: z.number().int().min(0),
  webhookReady: z.boolean(),
  webhookVerifyTokenConfigured: z.boolean(),
});

export const whatsappTestSendInputSchema = z.object({
  phone: z.string().min(5),
});

export const whatsappSetContactConsentInputSchema = z.object({
  phone: z.string().min(5),
  source: z.string().trim().min(1).optional(),
  status: whatsappOptInStatusSchema.exclude(["UNKNOWN"]),
});

const whatsappReplyButtonSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(20),
});

const whatsappListSectionSchema = z.object({
  rows: z.array(
    z.object({
      description: z.string().min(1).max(72).optional(),
      id: z.string().min(1),
      title: z.string().min(1).max(24),
    }),
  ),
  title: z.string().min(1).max(24),
});

const whatsappMediaBaseSchema = z
  .object({
    caption: z.string().min(1).max(1024).optional(),
    filename: z.string().min(1).optional(),
    link: z.url().optional(),
    mediaId: z.string().min(1).optional(),
    phone: z.string().min(5),
    replyToMessageId: z.string().min(1).optional(),
  })
  .refine((value) => Boolean(value.link || value.mediaId), {
    message: "Debes enviar mediaId o link",
    path: ["mediaId"],
  });

export const whatsappCustomMessageInputSchema = z.discriminatedUnion("kind", [
  z.object({
    body: z.string().min(1),
    kind: z.literal("contextual_text"),
    phone: z.string().min(5),
    previewUrl: z.boolean().optional(),
    quotedMessageId: z.string().min(1),
  }),
  z.object({
    body: z.string().min(1),
    footer: z.string().min(1).max(60).optional(),
    kind: z.literal("cta_url"),
    phone: z.string().min(5),
    displayText: z.string().min(1).max(20),
    headerText: z.string().min(1).max(60).optional(),
    url: z.url(),
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
  }),
  z.object({
    body: z.string().min(1),
    buttonText: z.string().min(1).max(20),
    footer: z.string().min(1).max(60).optional(),
    headerText: z.string().min(1).max(60).optional(),
    kind: z.literal("list"),
    phone: z.string().min(5),
    sections: z.array(whatsappListSectionSchema).min(1),
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
    body: z.string().min(1),
    buttons: z.array(whatsappReplyButtonSchema).min(1).max(3),
    footer: z.string().min(1).max(60).optional(),
    headerText: z.string().min(1).max(60).optional(),
    kind: z.literal("reply_buttons"),
    phone: z.string().min(5),
  }),
  z.object({
    kind: z.literal("typing"),
    messageId: z.string().min(1),
  }),
]);

export const whatsappStatusResponseSchema = z.object({
  contacts: z
    .array(
      z.object({
        input: z.string().nullable().optional(),
        waId: z.string().nullable().optional(),
      }),
    )
    .optional(),
  message: z.string(),
  messageId: z.string().optional(),
  messageStatus: z.string().nullable().optional(),
  mode: whatsappSendModeSchema.optional(),
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

  triggerPoll: oc
    .route({
      method: "POST",
      path: "/trigger-poll",
      summary: "Manually trigger IMAP poll for Doctoralia emails",
      tags: ["WhatsApp"],
    })
    .output(whatsappStatusResponseSchema),
};

export type WhatsappContract = typeof whatsappContract;

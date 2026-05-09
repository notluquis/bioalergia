import { oc } from "@orpc/contract";
import { z } from "zod";

// ── Enums ────────────────────────────────────────────────────────────────────

export const waMessageDirectionSchema = z.enum(["INBOUND", "OUTBOUND"]);
export const waMessageStatusSchema = z.enum([
  "PENDING",
  "SENT",
  "DELIVERED",
  "READ",
  "FAILED",
  "DELETED",
]);
export const waMessageTypeSchema = z.enum([
  "TEXT",
  "IMAGE",
  "VIDEO",
  "AUDIO",
  "DOCUMENT",
  "STICKER",
  "LOCATION",
  "CONTACTS",
  "INTERACTIVE",
  "BUTTON",
  "TEMPLATE",
  "REACTION",
  "SYSTEM",
  "UNSUPPORTED",
]);
export const waConversationStatusSchema = z.enum(["OPEN", "PENDING", "CLOSED", "ARCHIVED"]);
export type WaConversationStatus = z.infer<typeof waConversationStatusSchema>;
export const waTemplateStatusSchema = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "DISABLED",
  "PAUSED",
]);
export const waTemplateCategorySchema = z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]);

// ── Entities ─────────────────────────────────────────────────────────────────

export const waBusinessAccountSchema = z.object({
  id: z.number().int(),
  wabaId: z.string(),
  metaBusinessId: z.string().nullable(),
  appId: z.string().nullable(),
  graphApiVersion: z.string(),
  displayName: z.string().nullable(),
  active: z.boolean(),
  hasToken: z.boolean(),
  hasAppSecret: z.boolean(),
  hasVerifyToken: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type WaBusinessAccount = z.infer<typeof waBusinessAccountSchema>;

export const waPhoneNumberSchema = z.object({
  id: z.number().int(),
  accountId: z.number().int(),
  phoneNumberId: z.string(),
  displayPhoneNumber: z.string(),
  label: z.string().nullable(),
  qualityRating: z.string().nullable(),
  active: z.boolean(),
});

export const waContactSchema = z.object({
  id: z.number().int(),
  phoneE164: z.string(),
  name: z.string().nullable(),
  pushName: z.string().nullable(),
  optInStatus: z.string(),
  notas: z.string().nullable(),
  etiquetas: z.array(z.string()),
  patientRut: z.string().nullable(),
});

export const waConversationSchema = z.object({
  id: z.number().int(),
  contactId: z.number().int(),
  status: waConversationStatusSchema,
  assignedToUserId: z.number().int().nullable(),
  unreadCount: z.number().int(),
  lastInboundAt: z.coerce.date().nullable(),
  lastMessageAt: z.coerce.date().nullable(),
  lastMessagePreview: z.string().nullable(),
  notas: z.string().nullable(),
  etiquetas: z.array(z.string()),
});

export const waMessageSchema = z.object({
  id: z.number().int(),
  conversationId: z.number().int(),
  contactId: z.number().int(),
  phoneNumberId: z.number().int(),
  metaMessageId: z.string().nullable(),
  direction: waMessageDirectionSchema,
  type: waMessageTypeSchema,
  status: waMessageStatusSchema,
  body: z.string().nullable(),
  mediaUrl: z.string().nullable(),
  mediaMimeType: z.string().nullable(),
  mediaCaption: z.string().nullable(),
  templateName: z.string().nullable(),
  templateLanguage: z.string().nullable(),
  errorCode: z.string().nullable(),
  errorTitle: z.string().nullable(),
  errorDetails: z.string().nullable(),
  contextMetaMessageId: z.string().nullable(),
  timestamp: z.coerce.date(),
  deliveredAt: z.coerce.date().nullable(),
  readAt: z.coerce.date().nullable(),
  // Raw Meta payload — needed to render location lat/lng, contacts vCard,
  // forwarded flag, interactive replies, etc. Free-form JSON.
  payload: z.unknown().nullable().optional(),
});

export const waTemplateSchema = z.object({
  id: z.number().int(),
  accountId: z.number().int(),
  name: z.string(),
  language: z.string(),
  category: waTemplateCategorySchema,
  status: waTemplateStatusSchema,
  components: z.array(z.unknown()),
  qualityScore: z.string().nullable(),
});

// ── Inputs ──────────────────────────────────────────────────────────────────

export const upsertAccountInputSchema = z.object({
  id: z.number().int().positive().optional(),
  wabaId: z.string().min(1),
  metaBusinessId: z.string().optional(),
  appId: z.string().optional(),
  appSecret: z.string().optional(),
  systemUserToken: z.string().optional(),
  webhookVerifyToken: z.string().optional(),
  graphApiVersion: z.string().optional(),
  displayName: z.string().optional(),
  active: z.boolean().optional(),
});

export const accountIdInput = z.object({ id: z.number().int().positive() });
export const conversationIdInput = z.object({ id: z.number().int().positive() });

export const upsertPhoneNumberInputSchema = z.object({
  id: z.number().int().positive().optional(),
  accountId: z.number().int().positive(),
  phoneNumberId: z.string().min(1),
  displayPhoneNumber: z.string().min(1),
  label: z.string().optional(),
  active: z.boolean().optional(),
});

export const phoneIdInput = z.object({ id: z.number().int().positive() });

export const listConversationsInputSchema = z.object({
  status: waConversationStatusSchema.optional(),
  assignedToUserId: z.number().int().nullable().optional(),
  phoneNumberId: z.number().int().optional(),
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(50),
});

export const sendTextInputSchema = z.object({
  conversationId: z.number().int().positive(),
  phoneNumberId: z.number().int().positive(),
  body: z.string().min(1).max(4096),
  contextMetaMessageId: z.string().optional(),
});

export const sendTemplateInputSchema = z.object({
  conversationId: z.number().int().positive(),
  phoneNumberId: z.number().int().positive(),
  templateName: z.string().min(1),
  language: z.string().min(2),
  bodyParams: z.array(z.string()).optional(),
  headerParams: z.array(z.string()).optional(),
});

export const updateConversationInputSchema = z.object({
  id: z.number().int().positive(),
  status: waConversationStatusSchema.optional(),
  assignedToUserId: z.number().int().nullable().optional(),
  notas: z.string().nullable().optional(),
  etiquetas: z.array(z.string()).optional(),
});

export const markReadInputSchema = z.object({
  conversationId: z.number().int().positive(),
});

export const sendReactionInputSchema = z.object({
  conversationId: z.number().int().positive(),
  phoneNumberId: z.number().int().positive(),
  // metaMessageId of the original message being reacted to
  metaMessageId: z.string().min(1),
  // empty string removes the reaction
  emoji: z.string().max(8),
});

export const sendFlowInputSchema = z.object({
  conversationId: z.number().int().positive(),
  phoneNumberId: z.number().int().positive(),
  flowId: z.string().min(1),
  flowCta: z.string().min(1).max(20).default("Iniciar"),
  bodyText: z.string().min(1).max(1024),
  headerText: z.string().max(60).optional(),
  footerText: z.string().max(60).optional(),
  flowToken: z.string().min(1).optional(),
  initialScreen: z.string().optional(),
});

export const sendMediaInputSchema = z.object({
  conversationId: z.number().int().positive(),
  phoneNumberId: z.number().int().positive(),
  type: z.enum(["image", "document", "audio", "video", "sticker"]),
  // either mediaId (after upload) or external link
  mediaId: z.string().min(1).optional(),
  link: z.string().url().optional(),
  caption: z.string().max(1024).optional(),
  filename: z.string().max(120).optional(),
  contextMetaMessageId: z.string().optional(),
});

export const updateWaContactInputSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().nullable().optional(),
  notas: z.string().nullable().optional(),
  etiquetas: z.array(z.string()).optional(),
  patientRut: z.string().nullable().optional(),
});

// ── Outputs ─────────────────────────────────────────────────────────────────

export const accountWithPhonesSchema = waBusinessAccountSchema.extend({
  phoneNumbers: z.array(waPhoneNumberSchema),
});

export const listAccountsResponseSchema = z.object({
  accounts: z.array(accountWithPhonesSchema),
});

export const accountResponseSchema = z.object({
  account: accountWithPhonesSchema,
});

export const conversationListItemSchema = waConversationSchema.extend({
  contact: waContactSchema,
  channelPhoneNumberIds: z.array(z.number().int()),
});

export const listConversationsResponseSchema = z.object({
  items: z.array(conversationListItemSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});

export const conversationDetailResponseSchema = z.object({
  conversation: waConversationSchema,
  contact: waContactSchema,
  messages: z.array(waMessageSchema),
  channels: z.array(z.object({ phoneNumberId: z.number().int(), label: z.string().nullable() })),
  windowOpen: z.boolean(),
  windowExpiresAt: z.coerce.date().nullable(),
});

export const sendMessageResponseSchema = z.object({
  message: waMessageSchema,
});

export const waOkResponseSchema = z.object({ status: z.literal("ok") });

export const validateAccountResponseSchema = z.object({
  ok: z.boolean(),
  phoneNumbersFound: z.number().int(),
  templatesFound: z.number().int(),
  error: z.string().nullable(),
});

export const syncTemplatesResponseSchema = z.object({
  total: z.number().int(),
  templates: z.array(waTemplateSchema),
});

export const listTemplatesResponseSchema = z.object({
  templates: z.array(waTemplateSchema),
});

export const waWebhookLogSchema = z.object({
  id: z.number().int(),
  receivedAt: z.coerce.date(),
  signatureValid: z.boolean(),
  processed: z.boolean(),
  eventCount: z.number().int(),
  errorMessage: z.string().nullable(),
  fields: z.array(z.string()),
  preview: z.string(),
});

export const listWebhookLogsInputSchema = z.object({
  limit: z.number().int().min(1).max(200).default(50),
  onlyInvalid: z.boolean().optional(),
});

export const listWebhookLogsResponseSchema = z.object({
  logs: z.array(waWebhookLogSchema),
});

// ── Outbound location / contacts / edit ──────────────────────────────────────

export const sendLocationInputSchema = z.object({
  conversationId: z.number().int().positive(),
  phoneNumberId: z.number().int().positive(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  name: z.string().max(120).optional(),
  address: z.string().max(256).optional(),
  contextMetaMessageId: z.string().optional(),
});

export const contactCardSchema = z.object({
  name: z.object({
    formatted_name: z.string().min(1).max(256),
    first_name: z.string().max(128).optional(),
    last_name: z.string().max(128).optional(),
  }),
  phones: z
    .array(
      z.object({
        phone: z.string().min(1).max(40),
        type: z.string().max(40).optional(),
        wa_id: z.string().max(40).optional(),
      }),
    )
    .max(10)
    .optional(),
  emails: z
    .array(
      z.object({
        email: z.string().email().max(128),
        type: z.string().max(40).optional(),
      }),
    )
    .max(10)
    .optional(),
  org: z
    .object({
      company: z.string().max(128).optional(),
      title: z.string().max(128).optional(),
    })
    .optional(),
});

export const sendContactsInputSchema = z.object({
  conversationId: z.number().int().positive(),
  phoneNumberId: z.number().int().positive(),
  contacts: z.array(contactCardSchema).min(1).max(10),
  contextMetaMessageId: z.string().optional(),
});

export const editTextInputSchema = z.object({
  conversationId: z.number().int().positive(),
  phoneNumberId: z.number().int().positive(),
  messageId: z.number().int().positive(),
  body: z.string().min(1).max(4096),
});

// ── Block / Profile / Health / Analytics ─────────────────────────────────────

export const waPhoneIdInput = z.object({ phoneNumberId: z.number().int().positive() });

export const businessProfileFieldsSchema = z.object({
  about: z.string().max(139).optional(),
  address: z.string().max(256).optional(),
  description: z.string().max(512).optional(),
  email: z.string().email().max(128).optional(),
  vertical: z
    .enum([
      "AUTO",
      "BEAUTY",
      "APPAREL",
      "EDU",
      "ENTERTAIN",
      "EVENT_PLAN",
      "FINANCE",
      "GROCERY",
      "GOVT",
      "HOTEL",
      "HEALTH",
      "NONPROFIT",
      "PROF_SERVICES",
      "RETAIL",
      "TRAVEL",
      "RESTAURANT",
      "NOT_A_BIZ",
      "OTHER",
    ])
    .optional(),
  websites: z.array(z.string().url()).max(2).optional(),
});

export const businessProfileResponseSchema = z.object({
  about: z.string().nullish(),
  address: z.string().nullish(),
  description: z.string().nullish(),
  email: z.string().nullish(),
  profile_picture_url: z.string().nullish(),
  vertical: z.string().nullish(),
  websites: z.array(z.string()).nullish(),
});

export const updateBusinessProfileInputSchema = waPhoneIdInput.extend({
  fields: businessProfileFieldsSchema,
});

export const phoneHealthResponseSchema = z.object({
  id: z.string(),
  display_phone_number: z.string().nullish(),
  verified_name: z.string().nullish(),
  code_verification_status: z.string().nullish(),
  quality_rating: z.string().nullish(),
  name_status: z.string().nullish(),
  messaging_limit_tier: z.string().nullish(),
  platform_type: z.string().nullish(),
  throughput: z.object({ level: z.string().nullish() }).nullish(),
  health_status: z
    .object({
      can_send_message: z.string().nullish(),
      entities: z.array(z.unknown()).nullish(),
    })
    .nullish(),
});

export const blockContactInputSchema = z.object({
  conversationId: z.number().int().positive(),
  phoneNumberId: z.number().int().positive(),
});

export const listBlockedResponseSchema = z.object({
  blocked: z.array(z.object({ wa_id: z.string().nullish(), input: z.string().nullish() })),
});

export const conversationAnalyticsInputSchema = z.object({
  accountId: z.number().int().positive(),
  startUnix: z.number().int(),
  endUnix: z.number().int(),
  granularity: z.enum(["HALF_HOUR", "DAILY", "MONTHLY"]).default("DAILY"),
  phoneNumbers: z.array(z.string()).optional(),
});

export const conversationAnalyticsResponseSchema = z.object({
  dataPoints: z.array(
    z.object({
      start: z.number(),
      end: z.number(),
      conversation: z.number(),
      cost: z.number().nullish(),
      phone_number: z.string().nullish(),
      conversation_type: z.string().nullish(),
      conversation_direction: z.string().nullish(),
      conversation_category: z.string().nullish(),
    }),
  ),
});

// ── Contract ────────────────────────────────────────────────────────────────

export const waCloudContract = {
  // Accounts
  listAccounts: oc
    .route({ method: "GET", path: "/accounts", tags: ["WA Cloud"] })
    .input(z.object({}).optional())
    .output(listAccountsResponseSchema),
  upsertAccount: oc
    .route({ method: "POST", path: "/accounts/upsert", tags: ["WA Cloud"] })
    .input(upsertAccountInputSchema)
    .output(accountResponseSchema),
  deleteAccount: oc
    .route({ method: "POST", path: "/accounts/delete", tags: ["WA Cloud"] })
    .input(accountIdInput)
    .output(waOkResponseSchema),
  validateAccount: oc
    .route({ method: "POST", path: "/accounts/validate", tags: ["WA Cloud"] })
    .input(accountIdInput)
    .output(validateAccountResponseSchema),
  syncPhoneNumbers: oc
    .route({ method: "POST", path: "/accounts/sync-phones", tags: ["WA Cloud"] })
    .input(accountIdInput)
    .output(accountResponseSchema),
  syncTemplates: oc
    .route({ method: "POST", path: "/accounts/sync-templates", tags: ["WA Cloud"] })
    .input(accountIdInput)
    .output(syncTemplatesResponseSchema),

  // Phone numbers
  upsertPhoneNumber: oc
    .route({ method: "POST", path: "/phones/upsert", tags: ["WA Cloud"] })
    .input(upsertPhoneNumberInputSchema)
    .output(accountResponseSchema),

  // Conversations
  listConversations: oc
    .route({ method: "POST", path: "/conversations/list", tags: ["WA Cloud"] })
    .input(listConversationsInputSchema)
    .output(listConversationsResponseSchema),
  getConversation: oc
    .route({ method: "POST", path: "/conversations/get", tags: ["WA Cloud"] })
    .input(conversationIdInput)
    .output(conversationDetailResponseSchema),
  updateConversation: oc
    .route({ method: "POST", path: "/conversations/update", tags: ["WA Cloud"] })
    .input(updateConversationInputSchema)
    .output(waOkResponseSchema),
  markRead: oc
    .route({ method: "POST", path: "/conversations/mark-read", tags: ["WA Cloud"] })
    .input(markReadInputSchema)
    .output(waOkResponseSchema),

  // Contacts
  updateContact: oc
    .route({ method: "POST", path: "/contacts/update", tags: ["WA Cloud"] })
    .input(updateWaContactInputSchema)
    .output(waOkResponseSchema),

  // Outbound
  sendText: oc
    .route({ method: "POST", path: "/messages/send-text", tags: ["WA Cloud"] })
    .input(sendTextInputSchema)
    .output(sendMessageResponseSchema),
  sendTemplate: oc
    .route({ method: "POST", path: "/messages/send-template", tags: ["WA Cloud"] })
    .input(sendTemplateInputSchema)
    .output(sendMessageResponseSchema),
  sendReaction: oc
    .route({ method: "POST", path: "/messages/send-reaction", tags: ["WA Cloud"] })
    .input(sendReactionInputSchema)
    .output(sendMessageResponseSchema),
  sendMedia: oc
    .route({ method: "POST", path: "/messages/send-media", tags: ["WA Cloud"] })
    .input(sendMediaInputSchema)
    .output(sendMessageResponseSchema),
  sendFlow: oc
    .route({ method: "POST", path: "/messages/send-flow", tags: ["WA Cloud"] })
    .input(sendFlowInputSchema)
    .output(sendMessageResponseSchema),
  sendLocation: oc
    .route({ method: "POST", path: "/messages/send-location", tags: ["WA Cloud"] })
    .input(sendLocationInputSchema)
    .output(sendMessageResponseSchema),
  sendContacts: oc
    .route({ method: "POST", path: "/messages/send-contacts", tags: ["WA Cloud"] })
    .input(sendContactsInputSchema)
    .output(sendMessageResponseSchema),
  editText: oc
    .route({ method: "POST", path: "/messages/edit-text", tags: ["WA Cloud"] })
    .input(editTextInputSchema)
    .output(sendMessageResponseSchema),

  // Templates
  listTemplates: oc
    .route({ method: "GET", path: "/templates", tags: ["WA Cloud"] })
    .input(z.object({ accountId: z.number().int().optional() }).optional())
    .output(listTemplatesResponseSchema),

  listWebhookLogs: oc
    .route({ method: "POST", path: "/webhook-logs", tags: ["WA Cloud"] })
    .input(listWebhookLogsInputSchema)
    .output(listWebhookLogsResponseSchema),

  // Business profile
  getBusinessProfile: oc
    .route({ method: "POST", path: "/profile/get", tags: ["WA Cloud"] })
    .input(waPhoneIdInput)
    .output(businessProfileResponseSchema.nullable()),
  updateBusinessProfile: oc
    .route({ method: "POST", path: "/profile/update", tags: ["WA Cloud"] })
    .input(updateBusinessProfileInputSchema)
    .output(waOkResponseSchema),

  // Phone health
  getPhoneHealth: oc
    .route({ method: "POST", path: "/phones/health", tags: ["WA Cloud"] })
    .input(waPhoneIdInput)
    .output(phoneHealthResponseSchema),

  // Block / unblock
  blockContact: oc
    .route({ method: "POST", path: "/contacts/block", tags: ["WA Cloud"] })
    .input(blockContactInputSchema)
    .output(waOkResponseSchema),
  unblockContact: oc
    .route({ method: "POST", path: "/contacts/unblock", tags: ["WA Cloud"] })
    .input(blockContactInputSchema)
    .output(waOkResponseSchema),
  listBlocked: oc
    .route({ method: "POST", path: "/contacts/blocked", tags: ["WA Cloud"] })
    .input(waPhoneIdInput)
    .output(listBlockedResponseSchema),

  // Typing indicator
  setTyping: oc
    .route({ method: "POST", path: "/conversations/typing", tags: ["WA Cloud"] })
    .input(z.object({ conversationId: z.number().int().positive() }))
    .output(waOkResponseSchema),

  // Analytics
  getConversationAnalytics: oc
    .route({ method: "POST", path: "/analytics/conversations", tags: ["WA Cloud"] })
    .input(conversationAnalyticsInputSchema)
    .output(conversationAnalyticsResponseSchema),

};

export type WaCloudContract = typeof waCloudContract;

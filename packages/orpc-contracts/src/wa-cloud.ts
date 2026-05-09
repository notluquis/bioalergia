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

  // Templates
  listTemplates: oc
    .route({ method: "GET", path: "/templates", tags: ["WA Cloud"] })
    .input(z.object({ accountId: z.number().int().optional() }).optional())
    .output(listTemplatesResponseSchema),

  listWebhookLogs: oc
    .route({ method: "POST", path: "/webhook-logs", tags: ["WA Cloud"] })
    .input(listWebhookLogsInputSchema)
    .output(listWebhookLogsResponseSchema),
};

export type WaCloudContract = typeof waCloudContract;

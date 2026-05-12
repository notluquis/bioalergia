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
  blockedAt: z.coerce.date().nullable(),
  marketingOptIn: z.boolean().nullable(),
  bsuid: z.string().nullable(),
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

// Per-card carousel inputs: each card supplies its image media id (uploaded
// previously to Meta) + body variables + button payloads. Cards are 0-indexed
// and Meta requires they match the order of cards configured in the template.
export const carouselCardInputSchema = z.object({
  cardIndex: z.number().int().min(0).max(9),
  imageMediaId: z.string().optional(),
  bodyParams: z.array(z.string()).optional(),
  // For QUICK_REPLY buttons in cards: array of payloads in order
  quickReplyPayloads: z.array(z.string()).optional(),
  // For URL button cards: tail to append to the template URL (Meta spec)
  urlButtonSuffix: z.string().optional(),
});

export const sendTemplateInputSchema = z.object({
  conversationId: z.number().int().positive(),
  phoneNumberId: z.number().int().positive(),
  templateName: z.string().min(1),
  language: z.string().min(2),
  bodyParams: z.array(z.string()).optional(),
  headerParams: z.array(z.string()).optional(),
  // Optional: when sending a CAROUSEL template, pass per-card payloads
  cards: z.array(carouselCardInputSchema).max(10).optional(),
  // Meta 2026: LIMITED_TIME_OFFER expiration (ms epoch). Pair with the
  // template's countdown component + URL button.
  ltoExpirationMs: z.number().int().positive().optional(),
  // Meta 2026: COPY_CODE button — value the patient gets copied with one
  // tap. Index matches the buttons[] order in the template definition.
  copyCodeButton: z
    .object({
      index: z.number().int().min(0).max(9),
      value: z.string().min(1).max(15),
    })
    .optional(),
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

// ── Broadcasts / campaigns ───────────────────────────────────────────────────

export const waBroadcastStatusSchema = z.enum([
  "DRAFT",
  "QUEUED",
  "SENDING",
  "DONE",
  "CANCELLED",
  "FAILED",
]);

export const waBroadcastRecipientStatusSchema = z.enum(["PENDING", "SENT", "FAILED", "SKIPPED"]);

export const broadcastRecipientInputSchema = z.object({
  phoneE164: z.string().min(8).max(20),
  variables: z.array(z.string()).max(10).default([]),
});

export const createBroadcastInputSchema = z.object({
  accountId: z.number().int().positive(),
  phoneNumberId: z.number().int().positive(),
  name: z.string().min(1).max(120),
  templateName: z.string().min(1).max(512),
  templateLanguage: z.string().min(2).max(10),
  scheduledAt: z.coerce.date().optional(),
  rateLimitPerSecond: z.number().int().min(1).max(80).default(5),
  recipients: z.array(broadcastRecipientInputSchema).min(1).max(5000),
});

export const broadcastSummarySchema = z.object({
  id: z.number().int(),
  accountId: z.number().int(),
  phoneNumberId: z.number().int(),
  name: z.string(),
  templateName: z.string(),
  templateLanguage: z.string(),
  status: waBroadcastStatusSchema,
  scheduledAt: z.coerce.date().nullable(),
  startedAt: z.coerce.date().nullable(),
  finishedAt: z.coerce.date().nullable(),
  totalRecipients: z.number().int(),
  sentCount: z.number().int(),
  failedCount: z.number().int(),
  rateLimitPerSecond: z.number().int(),
  errorMessage: z.string().nullable(),
  createdAt: z.coerce.date(),
});

export const broadcastDetailRecipientSchema = z.object({
  id: z.number().int(),
  phoneE164: z.string(),
  variables: z.array(z.string()),
  status: waBroadcastRecipientStatusSchema,
  sentMessageId: z.number().int().nullable(),
  metaMessageId: z.string().nullable(),
  errorMessage: z.string().nullable(),
  attempts: z.number().int(),
  sentAt: z.coerce.date().nullable(),
});

export const broadcastDetailResponseSchema = z.object({
  broadcast: broadcastSummarySchema,
  recipients: z.array(broadcastDetailRecipientSchema),
});

export const listBroadcastsResponseSchema = z.object({
  broadcasts: z.array(broadcastSummarySchema),
});

export const broadcastIdInputSchema = z.object({ id: z.number().int().positive() });

// ── Scheduled messages ───────────────────────────────────────────────────────

export const waScheduledStatusSchema = z.enum(["PENDING", "SENT", "FAILED", "CANCELLED"]);

export const scheduleMessageInputSchema = z
  .object({
    conversationId: z.number().int().positive(),
    phoneNumberId: z.number().int().positive(),
    scheduledAt: z.coerce.date(),
    type: z.enum(["TEXT", "TEMPLATE"]),
    body: z.string().max(4096).optional(),
    templateName: z.string().optional(),
    templateLanguage: z.string().optional(),
    templateVars: z.array(z.string()).optional(),
    contextMetaMessageId: z.string().optional(),
  })
  .refine(
    (v) => (v.type === "TEXT" ? Boolean(v.body) : Boolean(v.templateName && v.templateLanguage)),
    {
      message: "TEXT requires body; TEMPLATE requires templateName+templateLanguage",
    }
  );

export const scheduledMessageSchema = z.object({
  id: z.number().int(),
  conversationId: z.number().int(),
  phoneNumberId: z.number().int(),
  scheduledAt: z.coerce.date(),
  status: waScheduledStatusSchema,
  type: waMessageTypeSchema,
  body: z.string().nullable(),
  templateName: z.string().nullable(),
  templateLanguage: z.string().nullable(),
  templateVars: z.array(z.string()),
  errorMessage: z.string().nullable(),
  sentMessageId: z.number().int().nullable(),
  createdAt: z.coerce.date(),
});

export const listScheduledInputSchema = z.object({
  conversationId: z.number().int().positive(),
});

export const listScheduledResponseSchema = z.object({
  scheduled: z.array(scheduledMessageSchema),
});

export const cancelScheduledInputSchema = z.object({
  id: z.number().int().positive(),
});

// ── Templates create / delete ────────────────────────────────────────────────

export const createTemplateInputSchema = z.object({
  accountId: z.number().int().positive(),
  name: z
    .string()
    .min(1)
    .max(512)
    .regex(/^[a-z0-9_]+$/, "Solo minúsculas, números y guion bajo"),
  language: z.string().min(2).max(10),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]),
  components: z.array(z.unknown()).min(1),
});

export const createTemplateResponseSchema = z.object({
  id: z.string(),
  status: z.string(),
  category: z.string(),
});

export const deleteTemplateInputSchema = z.object({
  accountId: z.number().int().positive(),
  name: z.string().min(1),
  hsmId: z.string().optional(),
});

// ── Search + media gallery ───────────────────────────────────────────────────

export const searchMessagesInputSchema = z.object({
  q: z.string().min(2).max(200),
  conversationId: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

export const searchMessagesResponseSchema = z.object({
  results: z.array(
    z.object({
      messageId: z.number().int(),
      conversationId: z.number().int(),
      contactName: z.string().nullable(),
      phoneE164: z.string(),
      direction: waMessageDirectionSchema,
      type: waMessageTypeSchema,
      body: z.string().nullable(),
      timestamp: z.coerce.date(),
    })
  ),
});

export const listConversationMediaInputSchema = z.object({
  conversationId: z.number().int().positive(),
  limit: z.number().int().min(1).max(200).default(100),
});

export const listConversationMediaResponseSchema = z.object({
  media: z.array(
    z.object({
      messageId: z.number().int(),
      type: waMessageTypeSchema,
      body: z.string().nullable(),
      timestamp: z.coerce.date(),
      out: z.boolean(),
    })
  ),
});

// ── Snippets / quick replies ────────────────────────────────────────────────

export const waSnippetKindSchema = z.enum([
  "TEXT",
  "MEDIA_DOCUMENT",
  "MEDIA_IMAGE",
  "MEDIA_VIDEO",
  "MEDIA_AUDIO",
  "MEDIA_STICKER",
  "CTA_URL",
  "REPLY_BUTTONS",
]);

export const replyButtonSchema = z.object({
  id: z.string().min(1).max(256),
  title: z.string().min(1).max(20),
});

export const snippetSchema = z.object({
  id: z.number().int(),
  accountId: z.number().int().nullable(),
  kind: waSnippetKindSchema,
  category: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  shortcut: z.string().nullable(),
  bodyText: z.string().nullable(),
  ctaUrl: z.string().nullable(),
  ctaButtonText: z.string().nullable(),
  ctaHeader: z.string().nullable(),
  ctaFooter: z.string().nullable(),
  replyButtons: z.array(replyButtonSchema).nullable(),
  replyHeader: z.string().nullable(),
  replyFooter: z.string().nullable(),
  mediaHandle: z.string().nullable(),
  mediaHandleExpiresAt: z.coerce.date().nullable(),
  mediaUrl: z.string().nullable(),
  mediaMimeType: z.string().nullable(),
  mediaFilename: z.string().nullable(),
  mediaSize: z.number().int().nullable(),
  variables: z.array(z.string()),
  archived: z.boolean(),
  hitCount: z.number().int(),
  lastUsedAt: z.coerce.date().nullable(),
});

export const upsertSnippetInputSchema = z.object({
  id: z.number().int().positive().optional(),
  accountId: z.number().int().positive().optional(),
  kind: waSnippetKindSchema,
  category: z.string().max(64).optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(256).optional(),
  shortcut: z.string().max(32).optional(),
  bodyText: z.string().max(4096).optional(),
  ctaUrl: z.string().url().optional(),
  ctaButtonText: z.string().max(20).optional(),
  ctaHeader: z.string().max(60).optional(),
  ctaFooter: z.string().max(60).optional(),
  replyButtons: z.array(replyButtonSchema).max(3).optional(),
  replyHeader: z.string().max(60).optional(),
  replyFooter: z.string().max(60).optional(),
  mediaHandle: z.string().optional(),
  mediaUrl: z.string().url().optional(),
  mediaMimeType: z.string().max(120).optional(),
  mediaFilename: z.string().max(256).optional(),
  mediaSize: z.number().int().optional(),
  variables: z.array(z.string()).optional(),
});

export const listSnippetsResponseSchema = z.object({
  snippets: z.array(snippetSchema),
});

export const listSnippetsInputSchema = z.object({
  kind: waSnippetKindSchema.optional(),
  category: z.string().optional(),
  q: z.string().optional(),
});

export const sendSnippetInputSchema = z.object({
  conversationId: z.number().int().positive(),
  phoneNumberId: z.number().int().positive(),
  snippetId: z.number().int().positive(),
  // Variable substitution {{1}}, {{2}}, …
  variableValues: z.array(z.string()).optional(),
});

// ── Saved entities (curated catalog) ─────────────────────────────────────────

export const savedLocationSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  address: z.string().nullable(),
  isDefault: z.boolean(),
  archived: z.boolean(),
});
export const upsertSavedLocationInputSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().min(1).max(120),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().max(256).optional(),
  isDefault: z.boolean().default(false),
});

export const interactiveListSectionSchema = z.object({
  title: z.string().max(24).optional(),
  rows: z
    .array(
      z.object({
        id: z.string().min(1).max(200),
        title: z.string().min(1).max(24),
        description: z.string().max(72).optional(),
      })
    )
    .min(1)
    .max(10),
});

export const savedInteractiveListSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  description: z.string().nullable(),
  headerText: z.string().nullable(),
  bodyText: z.string(),
  footerText: z.string().nullable(),
  buttonText: z.string(),
  sections: z.array(interactiveListSectionSchema),
  archived: z.boolean(),
  hitCount: z.number().int(),
  lastUsedAt: z.coerce.date().nullable(),
});
export const upsertSavedInteractiveListInputSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(256).optional(),
  headerText: z.string().max(60).optional(),
  bodyText: z.string().min(1).max(1024),
  footerText: z.string().max(60).optional(),
  buttonText: z.string().min(1).max(20),
  sections: z.array(interactiveListSectionSchema).min(1).max(10),
});

export const savedFlowSchema = z.object({
  id: z.number().int(),
  accountId: z.number().int().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  flowId: z.string(),
  flowToken: z.string().nullable(),
  initialScreen: z.string().nullable(),
  defaultBody: z.string(),
  defaultHeader: z.string().nullable(),
  defaultFooter: z.string().nullable(),
  defaultCta: z.string(),
  metaStatus: z.string().nullable(),
  metaCategories: z.array(z.string()),
  metaHealth: z.string().nullable(),
  metaSyncedAt: z.coerce.date().nullable(),
  archived: z.boolean(),
  hitCount: z.number().int(),
});
export const upsertSavedFlowInputSchema = z.object({
  id: z.number().int().positive().optional(),
  accountId: z.number().int().positive().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(256).optional(),
  flowId: z.string().min(1).max(64),
  flowToken: z.string().max(256).optional(),
  initialScreen: z.string().max(64).optional(),
  defaultBody: z.string().min(1).max(1024),
  defaultHeader: z.string().max(60).optional(),
  defaultFooter: z.string().max(60).optional(),
  defaultCta: z.string().min(1).max(20).default("Iniciar"),
});

export const syncFlowsInputSchema = z.object({
  accountId: z.number().int().positive(),
});

export const syncFlowsResponseSchema = z.object({
  fetched: z.number().int(),
  upserted: z.number().int(),
  flows: z.array(savedFlowSchema),
});

// Send commands using a saved entity
export const sendSavedLocationInputSchema = z.object({
  conversationId: z.number().int().positive(),
  phoneNumberId: z.number().int().positive(),
  savedLocationId: z.number().int().positive(),
  contextMetaMessageId: z.string().optional(),
});
export const sendSavedListInputSchema = z.object({
  conversationId: z.number().int().positive(),
  phoneNumberId: z.number().int().positive(),
  savedListId: z.number().int().positive(),
  contextMetaMessageId: z.string().optional(),
});
export const sendSavedFlowInputSchema = z.object({
  conversationId: z.number().int().positive(),
  phoneNumberId: z.number().int().positive(),
  savedFlowId: z.number().int().positive(),
  // optional override fields
  bodyText: z.string().max(1024).optional(),
  flowCta: z.string().max(20).optional(),
  contextMetaMessageId: z.string().optional(),
});

// Global scheduled list (cross-conversation)
export const listAllScheduledInputSchema = z.object({
  status: waScheduledStatusSchema.optional(),
  limit: z.number().int().min(1).max(500).default(200),
});

export const allScheduledItemSchema = scheduledMessageSchema.extend({
  contactName: z.string().nullable(),
  phoneE164: z.string(),
});

export const listAllScheduledResponseSchema = z.object({
  scheduled: z.array(allScheduledItemSchema),
});

// ── Account events / alerts ─────────────────────────────────────────────────

export const waAccountEventKindSchema = z.enum([
  "ACCOUNT_ALERT",
  "ACCOUNT_REVIEW",
  "ACCOUNT_SETTINGS",
  "ACCOUNT_UPDATE",
  "BUSINESS_CAPABILITY",
  "BUSINESS_STATUS",
  "SECURITY",
  "PARTNER_SOLUTIONS",
  "PAYMENT_CONFIG",
  "USER_PREFERENCES",
  "PHONE_QUALITY",
  "PHONE_NAME",
  "TEMPLATE_STATUS",
  "TEMPLATE_QUALITY",
  "TEMPLATE_CATEGORY",
  "AUTOMATIC",
  "TRACKING",
  "OTHER",
]);

export const accountEventSchema = z.object({
  id: z.number().int(),
  accountId: z.number().int().nullable(),
  phoneNumberId: z.number().int().nullable(),
  kind: waAccountEventKindSchema,
  field: z.string(),
  severity: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  acknowledged: z.boolean(),
  acknowledgedAt: z.coerce.date().nullable(),
  receivedAt: z.coerce.date(),
});

export const listAccountEventsInputSchema = z.object({
  acknowledged: z.boolean().optional(),
  severity: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(100),
});

export const listAccountEventsResponseSchema = z.object({
  events: z.array(accountEventSchema),
  unacknowledgedCount: z.number().int(),
});

export const acknowledgeAccountEventInputSchema = z.object({
  id: z.number().int().positive(),
});

// ── Interactive list + address + phone admin + analytics ─────────────────────

export const sendInteractiveListInputSchema = z.object({
  conversationId: z.number().int().positive(),
  phoneNumberId: z.number().int().positive(),
  bodyText: z.string().min(1).max(1024),
  buttonText: z.string().min(1).max(20),
  sections: z
    .array(
      z.object({
        title: z.string().max(24).optional(),
        rows: z
          .array(
            z.object({
              id: z.string().min(1).max(200),
              title: z.string().min(1).max(24),
              description: z.string().max(72).optional(),
            })
          )
          .min(1)
          .max(10),
      })
    )
    .min(1)
    .max(10),
  headerText: z.string().max(60).optional(),
  footerText: z.string().max(60).optional(),
  contextMetaMessageId: z.string().optional(),
  bizOpaqueCallbackData: z.string().max(512).optional(),
});

export const sendAddressInputSchema = z.object({
  conversationId: z.number().int().positive(),
  phoneNumberId: z.number().int().positive(),
  bodyText: z.string().min(1).max(1024),
  country: z.string().length(2).default("CL"),
  saveAddressLabel: z.string().max(60).optional(),
  contextMetaMessageId: z.string().optional(),
  bizOpaqueCallbackData: z.string().max(512).optional(),
});

export const registerPhoneInputSchema = z.object({
  phoneNumberId: z.number().int().positive(),
  pin: z.string().regex(/^\d{6}$/, "PIN debe ser 6 dígitos"),
});

export const setTwoStepPinInputSchema = z.object({
  phoneNumberId: z.number().int().positive(),
  pin: z.string().regex(/^\d{6}$/, "PIN debe ser 6 dígitos"),
});

export const conversationAnalyticsExtendedInputSchema = z.object({
  accountId: z.number().int().positive(),
  startUnix: z.number().int(),
  endUnix: z.number().int(),
  granularity: z.enum(["HALF_HOUR", "DAILY", "MONTHLY"]).default("DAILY"),
  phoneNumbers: z.array(z.string()).optional(),
  includePricing: z.boolean().default(true),
});

export const conversationAnalyticsExtendedResponseSchema = z.object({
  conversation: z.array(
    z.object({
      start: z.number(),
      end: z.number(),
      conversation: z.number(),
      cost: z.number().nullish(),
      phone_number: z.string().nullish(),
      country: z.string().nullish(),
      conversation_type: z.string().nullish(),
      conversation_direction: z.string().nullish(),
      conversation_category: z.string().nullish(),
    })
  ),
  pricing: z.array(
    z.object({
      start: z.number(),
      end: z.number(),
      volume: z.number(),
      cost: z.number().nullish(),
      pricing_category: z.string().nullish(),
      country: z.string().nullish(),
      phone_number: z.string().nullish(),
      pricing_type: z.string().nullish(),
      tier: z.string().nullish(),
    })
  ),
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
      })
    )
    .max(10)
    .optional(),
  emails: z
    .array(
      z.object({
        email: z.string().email().max(128),
        type: z.string().max(40).optional(),
      })
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

// Meta Commerce: catalog config + product browser + single-product send.
// Multi-product (MPM) lives below in sendMultiProductInputSchema.
export const setCommerceCatalogInputSchema = z.object({
  accountId: z.number().int().positive(),
  catalogId: z.string().nullable(), // pass null to unlink
});

export const commerceProductSchema = z.object({
  id: z.string(),
  retailer_id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  price: z.string().nullish(),
  currency: z.string().nullish(),
  image_url: z.string().nullish(),
  availability: z.string().nullish(),
});

export const listCommerceProductsInputSchema = z.object({
  accountId: z.number().int().positive(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(100),
});

export const listCommerceProductsResponseSchema = z.object({
  catalogId: z.string().nullable(),
  products: z.array(commerceProductSchema),
});

export const sendSingleProductInputSchema = z.object({
  conversationId: z.number().int().positive(),
  phoneNumberId: z.number().int().positive(),
  productRetailerId: z.string().min(1),
  bodyText: z.string().max(1024).optional(),
  footerText: z.string().max(60).optional(),
  contextMetaMessageId: z.string().optional(),
});

// Phone number migration between WABAs (Meta 2026). The new WABA must
// have already added the number; the old WABA must have deregistered.
// requestPhoneCode triggers an OTP via SMS or VOICE; verifyPhoneCode
// completes the migration.
export const requestPhoneCodeInputSchema = z.object({
  phoneNumberId: z.number().int().positive(),
  codeMethod: z.enum(["SMS", "VOICE"]),
  language: z.string().min(2).max(8).default("es"),
});

export const verifyPhoneCodeInputSchema = z.object({
  phoneNumberId: z.number().int().positive(),
  code: z.string().regex(/^\d{6}$/, "Código de 6 dígitos"),
});

// Multi-Product Message (Meta Commerce 2026). Renders catalog products
// in WhatsApp. Catalog id is read from WaBusinessAccount.commerceCatalogId
// (set in Settings); operator just picks products.
export const sendMultiProductInputSchema = z.object({
  conversationId: z.number().int().positive(),
  phoneNumberId: z.number().int().positive(),
  bodyText: z.string().min(1).max(1024),
  headerText: z.string().min(1).max(60),
  footerText: z.string().max(60).optional(),
  sections: z
    .array(
      z.object({
        title: z.string().min(1).max(24),
        product_items: z
          .array(z.object({ product_retailer_id: z.string().min(1) }))
          .min(1)
          .max(30),
      })
    )
    .min(1)
    .max(10),
  contextMetaMessageId: z.string().optional(),
});

// Embedded Signup (Solution Partner / OBO). Frontend opens Meta JS SDK
// FB.login with config_id for whatsapp_embedded_signup; on success the
// callback returns phone_number_id + waba_id + access_token. This input
// hands those to the API which creates the WaBusinessAccount + the
// WaPhoneNumber row, all secrets encrypted at rest by upsertAccount.
export const embeddedSignupInputSchema = z.object({
  wabaId: z.string().min(1),
  metaBusinessId: z.string().optional(),
  appId: z.string().optional(),
  systemUserToken: z.string().min(1),
  phoneNumberId: z.string().min(1),
  displayPhoneNumber: z.string().min(1),
  displayName: z.string().optional(),
});

// Template library (Meta 2026): pre-curated templates that can be cloned
// without going through approval review. listTemplateLibrary fetches the
// catalog; cloneTemplateFromLibrary copies a chosen entry into the WABA.
export const libraryTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  language: z.string(),
  category: z.string(),
  topic: z.string().nullish(),
  industry: z.array(z.string()).nullish(),
  use_case: z.string().nullish(),
  body: z.string().nullish(),
  header: z.string().nullish(),
  footer: z.string().nullish(),
  buttons: z
    .array(z.object({ type: z.string(), text: z.string(), url: z.string().nullish() }))
    .nullish(),
  parameter_format: z.string().nullish(),
});

export const listTemplateLibraryInputSchema = z.object({
  accountId: z.number().int().positive(),
  category: z.string().optional(),
  topic: z.string().optional(),
  industry: z.string().optional(),
  language: z.string().optional(),
  search: z.string().optional(),
});

export const listTemplateLibraryResponseSchema = z.object({
  templates: z.array(libraryTemplateSchema),
});

export const cloneTemplateFromLibraryInputSchema = z.object({
  accountId: z.number().int().positive(),
  libraryTemplateName: z.string().min(1),
  newName: z.string().min(1).max(512).optional(),
  language: z.string().min(2),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]),
});

export const cloneTemplateFromLibraryResponseSchema = z.object({
  id: z.string(),
  status: z.string(),
  category: z.string(),
});

// Conversational automation (Meta 2026): ice breakers + commands +
// welcome-message toggle. Configured per phone, rendered natively in the
// patient's WhatsApp client.
export const conversationalCommandSchema = z.object({
  command_name: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[a-z0-9_]+$/, "Solo letras minúsculas, números y guión bajo"),
  command_description: z.string().min(1).max(80),
});

export const conversationalAutomationSchema = z.object({
  enable_welcome_message: z.boolean().default(false),
  prompts: z.array(z.string().min(1).max(80)).max(4).default([]),
  commands: z.array(conversationalCommandSchema).max(30).default([]),
});

export const updateConversationalAutomationInputSchema = waPhoneIdInput.extend({
  config: conversationalAutomationSchema,
});

// Lightweight quality summary for the conversation header badge. Reads
// from local snapshot (WaPhoneNumber.qualityRating) + counts unacknowledged
// critical events. Cheap, no Meta call required.
export const phoneQualitySummaryInputSchema = z.object({
  phoneNumberId: z.number().int().positive(),
});

export const phoneQualitySummaryResponseSchema = z.object({
  phoneNumberId: z.number().int(),
  qualityRating: z.enum(["GREEN", "YELLOW", "RED"]).nullable(),
  criticalUnacknowledged: z.number().int(),
  warningUnacknowledged: z.number().int(),
  lastEventAt: z.coerce.date().nullable(),
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
    })
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
  sendInteractiveList: oc
    .route({ method: "POST", path: "/messages/send-list", tags: ["WA Cloud"] })
    .input(sendInteractiveListInputSchema)
    .output(sendMessageResponseSchema),
  sendAddress: oc
    .route({ method: "POST", path: "/messages/send-address", tags: ["WA Cloud"] })
    .input(sendAddressInputSchema)
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

  createTemplate: oc
    .route({ method: "POST", path: "/templates/create", tags: ["WA Cloud"] })
    .input(createTemplateInputSchema)
    .output(createTemplateResponseSchema),
  deleteTemplate: oc
    .route({ method: "POST", path: "/templates/delete", tags: ["WA Cloud"] })
    .input(deleteTemplateInputSchema)
    .output(waOkResponseSchema),

  createBroadcast: oc
    .route({ method: "POST", path: "/broadcasts/create", tags: ["WA Cloud"] })
    .input(createBroadcastInputSchema)
    .output(broadcastSummarySchema),
  listBroadcasts: oc
    .route({ method: "GET", path: "/broadcasts", tags: ["WA Cloud"] })
    .input(z.object({}).optional())
    .output(listBroadcastsResponseSchema),
  getBroadcast: oc
    .route({ method: "POST", path: "/broadcasts/get", tags: ["WA Cloud"] })
    .input(broadcastIdInputSchema)
    .output(broadcastDetailResponseSchema),
  startBroadcast: oc
    .route({ method: "POST", path: "/broadcasts/start", tags: ["WA Cloud"] })
    .input(broadcastIdInputSchema)
    .output(broadcastSummarySchema),
  cancelBroadcast: oc
    .route({ method: "POST", path: "/broadcasts/cancel", tags: ["WA Cloud"] })
    .input(broadcastIdInputSchema)
    .output(waOkResponseSchema),

  scheduleMessage: oc
    .route({ method: "POST", path: "/scheduled/create", tags: ["WA Cloud"] })
    .input(scheduleMessageInputSchema)
    .output(scheduledMessageSchema),
  listScheduled: oc
    .route({ method: "POST", path: "/scheduled/list", tags: ["WA Cloud"] })
    .input(listScheduledInputSchema)
    .output(listScheduledResponseSchema),
  cancelScheduled: oc
    .route({ method: "POST", path: "/scheduled/cancel", tags: ["WA Cloud"] })
    .input(cancelScheduledInputSchema)
    .output(waOkResponseSchema),

  searchMessages: oc
    .route({ method: "POST", path: "/messages/search", tags: ["WA Cloud"] })
    .input(searchMessagesInputSchema)
    .output(searchMessagesResponseSchema),

  listConversationMedia: oc
    .route({ method: "POST", path: "/messages/media-list", tags: ["WA Cloud"] })
    .input(listConversationMediaInputSchema)
    .output(listConversationMediaResponseSchema),

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

  // Snippets / quick replies
  listSnippets: oc
    .route({ method: "POST", path: "/snippets/list", tags: ["WA Cloud"] })
    .input(listSnippetsInputSchema)
    .output(listSnippetsResponseSchema),
  upsertSnippet: oc
    .route({ method: "POST", path: "/snippets/upsert", tags: ["WA Cloud"] })
    .input(upsertSnippetInputSchema)
    .output(snippetSchema),
  archiveSnippet: oc
    .route({ method: "POST", path: "/snippets/archive", tags: ["WA Cloud"] })
    .input(z.object({ id: z.number().int().positive() }))
    .output(waOkResponseSchema),
  sendSnippet: oc
    .route({ method: "POST", path: "/snippets/send", tags: ["WA Cloud"] })
    .input(sendSnippetInputSchema)
    .output(sendMessageResponseSchema),

  // Saved entities catalog
  listSavedLocations: oc
    .route({ method: "GET", path: "/saved/locations", tags: ["WA Cloud"] })
    .input(z.object({}).optional())
    .output(z.object({ locations: z.array(savedLocationSchema) })),
  upsertSavedLocation: oc
    .route({ method: "POST", path: "/saved/locations/upsert", tags: ["WA Cloud"] })
    .input(upsertSavedLocationInputSchema)
    .output(savedLocationSchema),
  archiveSavedLocation: oc
    .route({ method: "POST", path: "/saved/locations/archive", tags: ["WA Cloud"] })
    .input(z.object({ id: z.number().int().positive() }))
    .output(waOkResponseSchema),

  listSavedInteractiveLists: oc
    .route({ method: "GET", path: "/saved/lists", tags: ["WA Cloud"] })
    .input(z.object({}).optional())
    .output(z.object({ lists: z.array(savedInteractiveListSchema) })),
  upsertSavedInteractiveList: oc
    .route({ method: "POST", path: "/saved/lists/upsert", tags: ["WA Cloud"] })
    .input(upsertSavedInteractiveListInputSchema)
    .output(savedInteractiveListSchema),
  archiveSavedInteractiveList: oc
    .route({ method: "POST", path: "/saved/lists/archive", tags: ["WA Cloud"] })
    .input(z.object({ id: z.number().int().positive() }))
    .output(waOkResponseSchema),

  listSavedFlows: oc
    .route({ method: "GET", path: "/saved/flows", tags: ["WA Cloud"] })
    .input(z.object({}).optional())
    .output(z.object({ flows: z.array(savedFlowSchema) })),
  upsertSavedFlow: oc
    .route({ method: "POST", path: "/saved/flows/upsert", tags: ["WA Cloud"] })
    .input(upsertSavedFlowInputSchema)
    .output(savedFlowSchema),
  syncFlows: oc
    .route({ method: "POST", path: "/saved/flows/sync", tags: ["WA Cloud"] })
    .input(syncFlowsInputSchema)
    .output(syncFlowsResponseSchema),
  archiveSavedFlow: oc
    .route({ method: "POST", path: "/saved/flows/archive", tags: ["WA Cloud"] })
    .input(z.object({ id: z.number().int().positive() }))
    .output(waOkResponseSchema),

  // Send using saved entity (chiquillas no editan, solo eligen)
  sendSavedLocation: oc
    .route({ method: "POST", path: "/messages/send-saved-location", tags: ["WA Cloud"] })
    .input(sendSavedLocationInputSchema)
    .output(sendMessageResponseSchema),
  sendSavedList: oc
    .route({ method: "POST", path: "/messages/send-saved-list", tags: ["WA Cloud"] })
    .input(sendSavedListInputSchema)
    .output(sendMessageResponseSchema),
  sendSavedFlow: oc
    .route({ method: "POST", path: "/messages/send-saved-flow", tags: ["WA Cloud"] })
    .input(sendSavedFlowInputSchema)
    .output(sendMessageResponseSchema),

  // Global scheduled list
  listAllScheduled: oc
    .route({ method: "POST", path: "/scheduled/list-all", tags: ["WA Cloud"] })
    .input(listAllScheduledInputSchema)
    .output(listAllScheduledResponseSchema),

  // Account events / alerts
  listAccountEvents: oc
    .route({ method: "POST", path: "/account-events/list", tags: ["WA Cloud"] })
    .input(listAccountEventsInputSchema)
    .output(listAccountEventsResponseSchema),
  acknowledgeAccountEvent: oc
    .route({ method: "POST", path: "/account-events/ack", tags: ["WA Cloud"] })
    .input(acknowledgeAccountEventInputSchema)
    .output(waOkResponseSchema),

  // Phone admin
  registerPhone: oc
    .route({ method: "POST", path: "/phones/register", tags: ["WA Cloud"] })
    .input(registerPhoneInputSchema)
    .output(waOkResponseSchema),
  setTwoStepPin: oc
    .route({ method: "POST", path: "/phones/two-step-pin", tags: ["WA Cloud"] })
    .input(setTwoStepPinInputSchema)
    .output(waOkResponseSchema),

  // Extended analytics with pricing
  getConversationAnalyticsExtended: oc
    .route({ method: "POST", path: "/analytics/conversations/extended", tags: ["WA Cloud"] })
    .input(conversationAnalyticsExtendedInputSchema)
    .output(conversationAnalyticsExtendedResponseSchema),

  // Phone health
  getPhoneHealth: oc
    .route({ method: "POST", path: "/phones/health", tags: ["WA Cloud"] })
    .input(waPhoneIdInput)
    .output(phoneHealthResponseSchema),

  // Meta Commerce: catalog config + products + single-product send
  setCommerceCatalog: oc
    .route({
      method: "POST",
      path: "/accounts/commerce-catalog",
      tags: ["WA Cloud"],
    })
    .input(setCommerceCatalogInputSchema)
    .output(waOkResponseSchema),

  listCommerceProducts: oc
    .route({
      method: "POST",
      path: "/commerce/products/list",
      tags: ["WA Cloud"],
    })
    .input(listCommerceProductsInputSchema)
    .output(listCommerceProductsResponseSchema),

  sendSingleProduct: oc
    .route({
      method: "POST",
      path: "/messages/send-single-product",
      tags: ["WA Cloud"],
    })
    .input(sendSingleProductInputSchema)
    .output(sendMessageResponseSchema),

  // Phone number migration (request OTP + verify)
  requestPhoneCode: oc
    .route({
      method: "POST",
      path: "/phones/request-code",
      tags: ["WA Cloud"],
    })
    .input(requestPhoneCodeInputSchema)
    .output(waOkResponseSchema),

  verifyPhoneCode: oc
    .route({
      method: "POST",
      path: "/phones/verify-code",
      tags: ["WA Cloud"],
    })
    .input(verifyPhoneCodeInputSchema)
    .output(waOkResponseSchema),

  // Multi-Product Message (Meta Commerce)
  sendMultiProduct: oc
    .route({
      method: "POST",
      path: "/messages/send-multi-product",
      tags: ["WA Cloud"],
    })
    .input(sendMultiProductInputSchema)
    .output(sendMessageResponseSchema),

  // Embedded Signup callback handler (Solution Partner onboarding)
  embeddedSignupComplete: oc
    .route({
      method: "POST",
      path: "/embedded-signup",
      tags: ["WA Cloud"],
    })
    .input(embeddedSignupInputSchema)
    .output(accountResponseSchema),

  // Template library: list + clone
  listTemplateLibrary: oc
    .route({
      method: "POST",
      path: "/templates/library/list",
      tags: ["WA Cloud"],
    })
    .input(listTemplateLibraryInputSchema)
    .output(listTemplateLibraryResponseSchema),

  cloneTemplateFromLibrary: oc
    .route({
      method: "POST",
      path: "/templates/library/clone",
      tags: ["WA Cloud"],
    })
    .input(cloneTemplateFromLibraryInputSchema)
    .output(cloneTemplateFromLibraryResponseSchema),

  // Conversational automation (ice breakers + commands + welcome flag)
  getConversationalAutomation: oc
    .route({
      method: "POST",
      path: "/phones/conversational-automation",
      tags: ["WA Cloud"],
    })
    .input(waPhoneIdInput)
    .output(conversationalAutomationSchema),

  updateConversationalAutomation: oc
    .route({
      method: "POST",
      path: "/phones/conversational-automation/update",
      tags: ["WA Cloud"],
    })
    .input(updateConversationalAutomationInputSchema)
    .output(waOkResponseSchema),

  // Quality summary (local snapshot, used by header badge)
  getPhoneQualitySummary: oc
    .route({ method: "POST", path: "/phones/quality-summary", tags: ["WA Cloud"] })
    .input(phoneQualitySummaryInputSchema)
    .output(phoneQualitySummaryResponseSchema),

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

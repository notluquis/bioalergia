import {
  accountIdInput,
  blockContactInputSchema,
  businessProfileResponseSchema,
  acknowledgeAccountEventInputSchema,
  listSnippetsInputSchema,
  listSnippetsResponseSchema,
  sendSnippetInputSchema,
  snippetSchema,
  upsertSnippetInputSchema,
  conversationAnalyticsExtendedInputSchema,
  conversationAnalyticsExtendedResponseSchema,
  listAccountEventsInputSchema,
  listAccountEventsResponseSchema,
  listAllScheduledInputSchema,
  listAllScheduledResponseSchema,
  savedFlowSchema,
  savedInteractiveListSchema,
  savedLocationSchema,
  syncFlowsInputSchema,
  syncFlowsResponseSchema,
  listSavedStickersInputSchema,
  listSavedStickersResponseSchema,
  savedStickerSchema,
  saveStickerInputSchema,
  sendSavedStickerInputSchema,
  unsaveStickerInputSchema,
  sendSavedFlowInputSchema,
  sendSavedListInputSchema,
  sendSavedLocationInputSchema,
  upsertSavedFlowInputSchema,
  upsertSavedInteractiveListInputSchema,
  upsertSavedLocationInputSchema,
  conversationAnalyticsInputSchema,
  conversationAnalyticsResponseSchema,
  abonoAutomationSettingsSchema,
  updateAbonoAutomationSettingsInputSchema,
  registerPhoneInputSchema,
  sendAddressInputSchema,
  sendInteractiveListInputSchema,
  setTwoStepPinInputSchema,
  conversationIdInput,
  conversationDetailResponseSchema,
  accountResponseSchema,
  broadcastDetailResponseSchema,
  broadcastIdInputSchema,
  broadcastSummarySchema,
  cancelScheduledInputSchema,
  createBroadcastInputSchema,
  createTemplateInputSchema,
  listBroadcastsResponseSchema,
  createTemplateResponseSchema,
  deleteTemplateInputSchema,
  editTextInputSchema,
  forwardMessageInputSchema,
  listScheduledInputSchema,
  listScheduledResponseSchema,
  scheduleMessageInputSchema,
  scheduledMessageSchema,
  listAccountsResponseSchema,
  listBlockedResponseSchema,
  listConversationMediaInputSchema,
  listConversationMediaResponseSchema,
  listConversationsInputSchema,
  listConversationsResponseSchema,
  listTemplatesResponseSchema,
  listWebhookLogsInputSchema,
  listWebhookLogsResponseSchema,
  searchMessagesInputSchema,
  searchMessagesResponseSchema,
  markReadInputSchema,
  setMuteInputSchema,
  listCommerceProductsInputSchema,
  listCommerceProductsResponseSchema,
  sendSingleProductInputSchema,
  setCommerceCatalogInputSchema,
  conversationalAutomationSchema,
  embeddedSignupInputSchema,
  requestPhoneCodeInputSchema,
  sendMultiProductInputSchema,
  verifyPhoneCodeInputSchema,
  phoneHealthResponseSchema,
  phoneQualitySummaryInputSchema,
  phoneQualitySummaryResponseSchema,
  updateConversationalAutomationInputSchema,
  waPhoneIdInput,
  sendContactsInputSchema,
  sendCtaUrlInputSchema,
  sendFlowInputSchema,
  sendLocationInputSchema,
  sendLocationRequestInputSchema,
  sendMediaInputSchema,
  sendMessageResponseSchema,
  sendReactionInputSchema,
  sendTemplateInputSchema,
  sendTextInputSchema,
  syncTemplatesResponseSchema,
  updateBusinessProfileInputSchema,
  updateConversationInputSchema,
  updateWaContactInputSchema,
  upsertAccountInputSchema,
  upsertPhoneNumberInputSchema,
  validateAccountResponseSchema,
  waOkResponseSchema,
} from "@finanzas/orpc-contracts/wa-cloud";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, ValidationError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { getSetting, updateSettings } from "../lib/settings.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  ABONO_PAYMENT_SETTINGS,
  ABONO_STAFF_NOTIFY_SETTINGS,
  ABONO_WHATSAPP_SETTINGS,
  WA_FLOW_SETTINGS,
} from "../lib/doctoralia/abono-whatsapp-settings.ts";
import {
  getBusinessProfile,
  getConversationAnalytics,
  getConversationalAutomation,
  requestPhoneVerificationCode,
  updateConversationalAutomation,
  verifyPhoneCode,
  addMigratingPhoneNumber,
  deregisterPhoneNumber,
  registerPhoneNumber,
  setTwoStepPin,
  updateBusinessProfile,
} from "../modules/wa-cloud/graph-client.ts";
import { waBroadcastJobKey } from "../modules/wa-cloud/broadcast-runner.ts";
import { enqueueJob } from "../queue/runner.ts";
import { waScheduledJobKey } from "../queue/tasks/wa-scheduled-send.ts";
import { waPersistMediaJobKey } from "../queue/tasks/wa-persist-media.ts";
import {
  cancelBroadcast as cancelBroadcastService,
  createBroadcast as createBroadcastService,
  getBroadcastDetail as getBroadcastDetailService,
  listBroadcasts as listBroadcastsService,
  startBroadcast as startBroadcastService,
} from "../services/wa-broadcasts.ts";
import {
  cancelScheduledMessage as cancelScheduledMessageService,
  createScheduledMessage as createScheduledMessageService,
  listAllScheduled as listAllScheduledService,
  listScheduledForConversation as listScheduledForConversationService,
} from "../services/wa-scheduled.ts";
import {
  createTemplate as createTemplateService,
  deleteTemplate as deleteTemplateService,
  listTemplates as listTemplatesService,
  syncTemplates as syncTemplatesService,
} from "../services/wa-templates.ts";
import {
  getConversation as getConversationService,
  listConversations as listConversationsService,
  markConversationRead as markConversationReadService,
  setConversationMute as setConversationMuteService,
  setConversationTyping as setConversationTypingService,
  updateConversation as updateConversationService,
} from "../services/wa-conversations.ts";
import { resolveUserDisplayName } from "../services/users.ts";
import {
  editText as editTextService,
  forwardMessage as forwardMessageService,
  listConversationMedia as listConversationMediaService,
  searchMessages as searchMessagesService,
  sendAddress as sendAddressService,
  sendContacts as sendContactsService,
  sendCtaUrl as sendCtaUrlService,
  sendFlow as sendFlowService,
  sendLocationRequest as sendLocationRequestService,
  sendInteractiveList as sendInteractiveListService,
  sendLocation as sendLocationService,
  sendMedia as sendMediaService,
  sendReaction as sendReactionService,
  sendTemplate as sendTemplateService,
  sendText as sendTextService,
} from "../services/wa-messages.ts";
import {
  blockContact as blockContactService,
  listBlocked as listBlockedService,
  unblockContact as unblockContactService,
  updateContact as updateContactService,
} from "../services/wa-contacts.ts";
import {
  deleteAccount as deleteAccountService,
  embeddedSignupComplete as embeddedSignupCompleteService,
  listAccounts as listAccountsService,
  listCommerceProductsForAccount as listCommerceProductsService,
  sendMultiProduct as sendMultiProductService,
  sendSingleProduct as sendSingleProductService,
  setCommerceCatalog as setCommerceCatalogService,
  syncPhoneNumbers as syncPhoneNumbersService,
  upsertAccount as upsertAccountService,
  upsertPhoneNumber as upsertPhoneNumberService,
  validateAccount as validateAccountService,
} from "../services/wa-accounts.ts";
import {
  archiveSnippet as archiveSnippetService,
  listSnippets as listSnippetsService,
  sendSnippet as sendSnippetService,
  upsertSnippet as upsertSnippetService,
} from "../services/wa-snippets.ts";
import {
  archiveSavedFlow as archiveSavedFlowService,
  archiveSavedInteractiveList as archiveSavedInteractiveListService,
  archiveSavedLocation as archiveSavedLocationService,
  listSavedFlows as listSavedFlowsService,
  listSavedInteractiveLists as listSavedInteractiveListsService,
  listSavedLocations as listSavedLocationsService,
  sendSavedFlow as sendSavedFlowService,
  sendSavedList as sendSavedListService,
  sendSavedLocation as sendSavedLocationService,
  syncFlows as syncFlowsService,
  upsertSavedFlow as upsertSavedFlowService,
  upsertSavedInteractiveList as upsertSavedInteractiveListService,
  upsertSavedLocation as upsertSavedLocationService,
} from "../services/wa-saved.ts";
import {
  listSavedStickers as listSavedStickersService,
  saveStickerFromMessage as saveStickerFromMessageService,
  sendSavedSticker as sendSavedStickerService,
  unsaveSticker as unsaveStickerService,
} from "../services/wa-stickers.ts";
import {
  acknowledgeAccountEvent as acknowledgeAccountEventService,
  getPhoneHealth as getPhoneHealthService,
  getPhoneQualitySummary as getPhoneQualitySummaryService,
  listAccountEvents as listAccountEventsService,
  listWebhookLogs as listWebhookLogsService,
} from "../services/wa-analytics.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type WaCloudORPCContext = { hono: HonoContext };
// Base error logger as a procedure middleware (golden oRPC pattern): runs
// before .input/.output so it catches validation errors, and the middleware
// `path` identifies WHICH procedure failed — unlike a handler interceptor.
const base = os.$context<WaCloudORPCContext>().use(
  onError((error, { path }) => {
    const details: Record<string, unknown> = {
      module: "api",
      operation: "orpc.wa-cloud",
      procedure: path.join("."),
    };
    if (error instanceof ORPCError) {
      details.code = error.code;
      details.status = error.status;
      if (error.cause instanceof ValidationError) {
        details.issues = JSON.stringify(error.cause.issues);
      } else if (error.cause instanceof Error) {
        details.cause = error.cause.message;
      }
    }
    logError(error, details);
  })
);

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);
  if (!user) throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  return next({ context: { ...context, user } });
});

function gate(action: "read" | "create" | "update" | "delete", subject: string) {
  return authed.use(async ({ context, next }) => {
    const ok = await hasPermission(context.user, action, subject);
    if (!ok) throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
    return next();
  });
}

function positiveIntOrNull(value: string | null): number | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return null;

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

const SUBJECT = "WaBusinessAccount";
const readWa = gate("read", SUBJECT);
const writeWa = gate("update", SUBJECT);
const createWa = gate("create", SUBJECT);
const deleteWa = gate("delete", SUBJECT);

const waRouterBase = {
  listAccounts: readWa
    .route({ method: "GET", path: "/accounts", tags: ["WA Cloud"] })
    .input(z.object({}).optional())
    .output(listAccountsResponseSchema)
    .handler(async () => {
      return listAccountsService();
    }),

  upsertAccount: createWa
    .route({ method: "POST", path: "/accounts/upsert", tags: ["WA Cloud"] })
    .input(upsertAccountInputSchema)
    .output(accountResponseSchema)
    .handler(async ({ input }) => {
      return upsertAccountService(input);
    }),

  deleteAccount: deleteWa
    .route({ method: "POST", path: "/accounts/delete", tags: ["WA Cloud"] })
    .input(accountIdInput)
    .output(waOkResponseSchema)
    .handler(async ({ input }) => {
      await deleteAccountService(input.id);
      return { status: "ok" as const };
    }),

  validateAccount: writeWa
    .route({ method: "POST", path: "/accounts/validate", tags: ["WA Cloud"] })
    .input(accountIdInput)
    .output(validateAccountResponseSchema)
    .handler(async ({ input }) => {
      return validateAccountService(input.id);
    }),

  syncPhoneNumbers: writeWa
    .route({ method: "POST", path: "/accounts/sync-phones", tags: ["WA Cloud"] })
    .input(accountIdInput)
    .output(accountResponseSchema)
    .handler(async ({ input }) => {
      return syncPhoneNumbersService(input.id);
    }),

  syncTemplates: writeWa
    .route({ method: "POST", path: "/accounts/sync-templates", tags: ["WA Cloud"] })
    .input(accountIdInput)
    .output(syncTemplatesResponseSchema)
    .handler(async ({ input }) => {
      return syncTemplatesService(input.id);
    }),

  getAbonoAutomationSettings: readWa
    .route({ method: "GET", path: "/settings/abono-automation", tags: ["WA Cloud"] })
    .input(z.object({}).optional())
    .output(abonoAutomationSettingsSchema)
    .handler(async () => {
      const [
        requestEnabled,
        confirmationEnabled,
        phoneNumberId,
        requestTemplateName,
        requestTemplateLanguage,
        confirmationTemplatePrefix,
        confirmationTemplateLanguage,
        fonasaFullAmountClp,
        particularFullAmountClp,
        expirationDays,
        publicBaseUrl,
        statementDescriptor,
        intakeFlowId,
        intakeBodyText,
        staffNotifyEnabled,
        staffNotifyPhones,
        fichaTemplateName,
      ] = await Promise.all([
        getSetting(ABONO_WHATSAPP_SETTINGS.requestEnabled),
        getSetting(ABONO_WHATSAPP_SETTINGS.confirmationEnabled),
        getSetting(ABONO_WHATSAPP_SETTINGS.phoneNumberId),
        getSetting(ABONO_WHATSAPP_SETTINGS.requestTemplateName),
        getSetting(ABONO_WHATSAPP_SETTINGS.requestTemplateLanguage),
        getSetting(ABONO_WHATSAPP_SETTINGS.confirmationTemplatePrefix),
        getSetting(ABONO_WHATSAPP_SETTINGS.confirmationTemplateLanguage),
        getSetting(ABONO_PAYMENT_SETTINGS.fonasaFullAmountClp),
        getSetting(ABONO_PAYMENT_SETTINGS.particularFullAmountClp),
        getSetting(ABONO_PAYMENT_SETTINGS.expirationDays),
        getSetting(ABONO_PAYMENT_SETTINGS.publicBaseUrl),
        getSetting(ABONO_PAYMENT_SETTINGS.statementDescriptor),
        getSetting(WA_FLOW_SETTINGS.intakeFlowId),
        getSetting(WA_FLOW_SETTINGS.intakeBodyText),
        getSetting(ABONO_STAFF_NOTIFY_SETTINGS.enabled),
        getSetting(ABONO_STAFF_NOTIFY_SETTINGS.phones),
        getSetting(ABONO_STAFF_NOTIFY_SETTINGS.fichaTemplateName),
      ]);

      return {
        requestEnabled: requestEnabled === "true",
        confirmationEnabled: confirmationEnabled === "true",
        phoneNumberId: positiveIntOrNull(phoneNumberId),
        requestTemplateName: requestTemplateName ?? "",
        requestTemplateLanguage: requestTemplateLanguage ?? "",
        confirmationTemplatePrefix: confirmationTemplatePrefix ?? "",
        confirmationTemplateLanguage: confirmationTemplateLanguage ?? "",
        fonasaFullAmountClp: positiveIntOrNull(fonasaFullAmountClp),
        particularFullAmountClp: positiveIntOrNull(particularFullAmountClp),
        expirationDays: positiveIntOrNull(expirationDays),
        publicBaseUrl: publicBaseUrl ?? "",
        statementDescriptor: statementDescriptor ?? "",
        intakeFlowId: intakeFlowId ?? "",
        intakeBodyText: intakeBodyText ?? "",
        staffNotifyEnabled: staffNotifyEnabled === "true",
        staffNotifyPhones: staffNotifyPhones ?? "",
        fichaTemplateName: fichaTemplateName ?? "",
      };
    }),

  updateAbonoAutomationSettings: writeWa
    .route({ method: "POST", path: "/settings/abono-automation", tags: ["WA Cloud"] })
    .input(updateAbonoAutomationSettingsInputSchema)
    .output(waOkResponseSchema)
    .handler(async ({ input }) => {
      await updateSettings({
        [ABONO_WHATSAPP_SETTINGS.requestEnabled]: String(input.requestEnabled),
        [ABONO_WHATSAPP_SETTINGS.confirmationEnabled]: String(input.confirmationEnabled),
        [ABONO_WHATSAPP_SETTINGS.phoneNumberId]: input.phoneNumberId
          ? String(input.phoneNumberId)
          : "",
        [ABONO_WHATSAPP_SETTINGS.requestTemplateName]: input.requestTemplateName.trim(),
        [ABONO_WHATSAPP_SETTINGS.requestTemplateLanguage]: input.requestTemplateLanguage.trim(),
        [ABONO_WHATSAPP_SETTINGS.confirmationTemplatePrefix]:
          input.confirmationTemplatePrefix.trim(),
        [ABONO_WHATSAPP_SETTINGS.confirmationTemplateLanguage]:
          input.confirmationTemplateLanguage.trim(),
        [ABONO_PAYMENT_SETTINGS.fonasaFullAmountClp]: input.fonasaFullAmountClp
          ? String(input.fonasaFullAmountClp)
          : "",
        [ABONO_PAYMENT_SETTINGS.particularFullAmountClp]: input.particularFullAmountClp
          ? String(input.particularFullAmountClp)
          : "",
        [ABONO_PAYMENT_SETTINGS.expirationDays]: input.expirationDays
          ? String(input.expirationDays)
          : "",
        [ABONO_PAYMENT_SETTINGS.publicBaseUrl]: input.publicBaseUrl.trim(),
        [ABONO_PAYMENT_SETTINGS.statementDescriptor]: input.statementDescriptor.trim(),
        [WA_FLOW_SETTINGS.intakeFlowId]: input.intakeFlowId.trim(),
        [WA_FLOW_SETTINGS.intakeBodyText]: input.intakeBodyText.trim(),
        [ABONO_STAFF_NOTIFY_SETTINGS.enabled]: String(input.staffNotifyEnabled),
        [ABONO_STAFF_NOTIFY_SETTINGS.phones]: input.staffNotifyPhones.trim(),
        [ABONO_STAFF_NOTIFY_SETTINGS.fichaTemplateName]: input.fichaTemplateName.trim(),
      });
      return { status: "ok" as const };
    }),

  upsertPhoneNumber: writeWa
    .route({ method: "POST", path: "/phones/upsert", tags: ["WA Cloud"] })
    .input(upsertPhoneNumberInputSchema)
    .output(accountResponseSchema)
    .handler(async ({ input }) => {
      return upsertPhoneNumberService(input);
    }),

  listConversations: readWa
    .route({ method: "POST", path: "/conversations/list", tags: ["WA Cloud"] })
    .input(listConversationsInputSchema)
    .output(listConversationsResponseSchema)
    .handler(async ({ input }) => {
      return listConversationsService(input);
    }),

  getConversation: readWa
    .route({ method: "POST", path: "/conversations/get", tags: ["WA Cloud"] })
    .input(conversationIdInput)
    .output(conversationDetailResponseSchema)
    .handler(async ({ input }) => {
      return getConversationService(input.id);
    }),

  updateConversation: writeWa
    .route({ method: "POST", path: "/conversations/update", tags: ["WA Cloud"] })
    .input(updateConversationInputSchema)
    .output(waOkResponseSchema)
    .handler(async ({ input }) => {
      await updateConversationService(input);
      return { status: "ok" as const };
    }),

  markRead: writeWa
    .route({ method: "POST", path: "/conversations/mark-read", tags: ["WA Cloud"] })
    .input(markReadInputSchema)
    .output(waOkResponseSchema)
    .handler(async ({ input }) => {
      await markConversationReadService(input);
      return { status: "ok" as const };
    }),

  setMute: writeWa
    .route({ method: "POST", path: "/conversations/set-mute", tags: ["WA Cloud"] })
    .input(setMuteInputSchema)
    .output(waOkResponseSchema)
    .handler(async ({ input }) => {
      await setConversationMuteService(input);
      return { status: "ok" as const };
    }),

  updateContact: writeWa
    .route({ method: "POST", path: "/contacts/update", tags: ["WA Cloud"] })
    .input(updateWaContactInputSchema)
    .output(waOkResponseSchema)
    .handler(async ({ input }) => {
      await updateContactService(input);
      return { status: "ok" as const };
    }),

  sendText: writeWa
    .route({ method: "POST", path: "/messages/send-text", tags: ["WA Cloud"] })
    .input(sendTextInputSchema)
    .output(sendMessageResponseSchema)
    .handler(async ({ context, input }) => {
      return sendTextService(input, context.user.id);
    }),

  sendTemplate: writeWa
    .route({ method: "POST", path: "/messages/send-template", tags: ["WA Cloud"] })
    .input(sendTemplateInputSchema)
    .output(sendMessageResponseSchema)
    .handler(async ({ context, input }) => {
      return sendTemplateService(input, context.user.id);
    }),

  sendReaction: writeWa
    .route({ method: "POST", path: "/messages/send-reaction", tags: ["WA Cloud"] })
    .input(sendReactionInputSchema)
    .output(sendMessageResponseSchema)
    .handler(async ({ context, input }) => {
      return sendReactionService(input, context.user.id);
    }),

  sendMedia: writeWa
    .route({ method: "POST", path: "/messages/send-media", tags: ["WA Cloud"] })
    .input(sendMediaInputSchema)
    .output(sendMessageResponseSchema)
    .handler(async ({ context, input }) => {
      const res = await sendMediaService(input, context.user.id);
      // Persist a durable R2 copy (Meta media id expires). Only by-mediaId sends
      // have a re-fetchable Meta media; link sends are skipped.
      if (input.mediaId && res.message?.id) {
        await enqueueJob(
          "wa_persist_media",
          { messageId: res.message.id },
          { jobKey: waPersistMediaJobKey(res.message.id) }
        );
      }
      return res;
    }),

  sendFlow: writeWa
    .route({ method: "POST", path: "/messages/send-flow", tags: ["WA Cloud"] })
    .input(sendFlowInputSchema)
    .output(sendMessageResponseSchema)
    .handler(async ({ context, input }) => {
      return sendFlowService(input, context.user.id);
    }),

  sendInteractiveList: writeWa
    .route({ method: "POST", path: "/messages/send-list", tags: ["WA Cloud"] })
    .input(sendInteractiveListInputSchema)
    .output(sendMessageResponseSchema)
    .handler(async ({ context, input }) => {
      return sendInteractiveListService(input, context.user.id);
    }),

  sendAddress: writeWa
    .route({ method: "POST", path: "/messages/send-address", tags: ["WA Cloud"] })
    .input(sendAddressInputSchema)
    .output(sendMessageResponseSchema)
    .handler(async ({ context, input }) => {
      return sendAddressService(input, context.user.id);
    }),

  sendLocation: writeWa
    .route({ method: "POST", path: "/messages/send-location", tags: ["WA Cloud"] })
    .input(sendLocationInputSchema)
    .output(sendMessageResponseSchema)
    .handler(async ({ context, input }) => {
      return sendLocationService(input, context.user.id);
    }),
  sendCtaUrl: writeWa
    .route({ method: "POST", path: "/messages/send-cta-url", tags: ["WA Cloud"] })
    .input(sendCtaUrlInputSchema)
    .output(sendMessageResponseSchema)
    .handler(async ({ context, input }) => {
      return sendCtaUrlService(input, context.user.id);
    }),
  sendLocationRequest: writeWa
    .route({ method: "POST", path: "/messages/send-location-request", tags: ["WA Cloud"] })
    .input(sendLocationRequestInputSchema)
    .output(sendMessageResponseSchema)
    .handler(async ({ context, input }) => {
      return sendLocationRequestService(input, context.user.id);
    }),

  sendContacts: writeWa
    .route({ method: "POST", path: "/messages/send-contacts", tags: ["WA Cloud"] })
    .input(sendContactsInputSchema)
    .output(sendMessageResponseSchema)
    .handler(async ({ context, input }) => {
      return sendContactsService(input, context.user.id);
    }),

  editText: writeWa
    .route({ method: "POST", path: "/messages/edit-text", tags: ["WA Cloud"] })
    .input(editTextInputSchema)
    .output(sendMessageResponseSchema)
    .handler(async ({ input }) => {
      return editTextService(input);
    }),

  forwardMessage: writeWa
    .route({ method: "POST", path: "/messages/forward", tags: ["WA Cloud"] })
    .input(forwardMessageInputSchema)
    .output(sendMessageResponseSchema)
    .handler(async ({ context, input }) => {
      return forwardMessageService(input, context.user.id);
    }),

  createTemplate: createWa
    .route({ method: "POST", path: "/templates/create", tags: ["WA Cloud"] })
    .input(createTemplateInputSchema)
    .output(createTemplateResponseSchema)
    .handler(async ({ input }) => {
      return createTemplateService(input);
    }),

  deleteTemplate: deleteWa
    .route({ method: "POST", path: "/templates/delete", tags: ["WA Cloud"] })
    .input(deleteTemplateInputSchema)
    .output(waOkResponseSchema)
    .handler(async ({ input }) => {
      await deleteTemplateService(input.accountId, input.name, input.hsmId);
      return { status: "ok" as const };
    }),

  createBroadcast: createWa
    .route({ method: "POST", path: "/broadcasts/create", tags: ["WA Cloud"] })
    .input(createBroadcastInputSchema)
    .output(broadcastSummarySchema)
    .handler(async ({ context, input }) => {
      const bc = await createBroadcastService(input, context.user.id);
      // Scheduled broadcast → kick off the drain chain at its send time. Drafts
      // wait for startBroadcast. jobKey+replace = one chain per broadcast.
      // No-ops when the queue runner is disabled (manual start stays the fallback).
      if (bc.status === "QUEUED") {
        await enqueueJob(
          "send_wa_broadcast_tick",
          { broadcastId: bc.id },
          {
            runAt: bc.scheduledAt ?? new Date(),
            jobKey: waBroadcastJobKey(bc.id),
            jobKeyMode: "replace",
            // Serialize all ticks for this broadcast: jobKey only dedups
            // PENDING jobs, not a running one, so without a per-broadcast queue
            // a re-enqueued/restarted tick could run concurrently and re-read
            // the same PENDING recipients → double-send.
            queueName: waBroadcastJobKey(bc.id),
          }
        );
      }
      return bc;
    }),

  listBroadcasts: readWa
    .route({ method: "GET", path: "/broadcasts", tags: ["WA Cloud"] })
    .input(z.object({}).optional())
    .output(listBroadcastsResponseSchema)
    .handler(async () => {
      return listBroadcastsService();
    }),

  getBroadcast: readWa
    .route({ method: "POST", path: "/broadcasts/get", tags: ["WA Cloud"] })
    .input(broadcastIdInputSchema)
    .output(broadcastDetailResponseSchema)
    .handler(async ({ input }) => {
      return getBroadcastDetailService(input.id);
    }),

  startBroadcast: writeWa
    .route({ method: "POST", path: "/broadcasts/start", tags: ["WA Cloud"] })
    .input(broadcastIdInputSchema)
    .output(broadcastSummarySchema)
    .handler(async ({ input }) => {
      const updated = await startBroadcastService(input.id);
      // Start (or restart) the drain chain. runAt = scheduledAt (now if immediate).
      await enqueueJob(
        "send_wa_broadcast_tick",
        { broadcastId: updated.id },
        {
          runAt: updated.scheduledAt ?? new Date(),
          jobKey: waBroadcastJobKey(updated.id),
          jobKeyMode: "replace",
          queueName: waBroadcastJobKey(updated.id), // serialize ticks (see createBroadcast)
        }
      );
      return updated;
    }),

  cancelBroadcast: deleteWa
    .route({ method: "POST", path: "/broadcasts/cancel", tags: ["WA Cloud"] })
    .input(broadcastIdInputSchema)
    .output(waOkResponseSchema)
    .handler(async ({ input }) => {
      await cancelBroadcastService(input.id);
      return { status: "ok" as const };
    }),

  scheduleMessage: writeWa
    .route({ method: "POST", path: "/scheduled/create", tags: ["WA Cloud"] })
    .input(scheduleMessageInputSchema)
    .output(scheduledMessageSchema)
    .handler(async ({ context, input }) => {
      const created = await createScheduledMessageService(input, context.user.id);
      // Fire the one-shot send at its due time. jobKey+replace keeps a single
      // job per scheduled message. No-op when the queue runner is disabled.
      await enqueueJob(
        "send_wa_scheduled",
        { scheduledMessageId: created.id },
        {
          runAt: input.scheduledAt,
          jobKey: waScheduledJobKey(created.id),
          jobKeyMode: "replace",
          // Serialize so a retry can't run alongside the original and double-send.
          queueName: waScheduledJobKey(created.id),
        }
      );
      return created;
    }),

  listScheduled: readWa
    .route({ method: "POST", path: "/scheduled/list", tags: ["WA Cloud"] })
    .input(listScheduledInputSchema)
    .output(listScheduledResponseSchema)
    .handler(async ({ input }) => {
      return listScheduledForConversationService(input.conversationId);
    }),

  cancelScheduled: deleteWa
    .route({ method: "POST", path: "/scheduled/cancel", tags: ["WA Cloud"] })
    .input(cancelScheduledInputSchema)
    .output(waOkResponseSchema)
    .handler(async ({ input }) => {
      await cancelScheduledMessageService(input.id);
      return { status: "ok" as const };
    }),

  searchMessages: readWa
    .route({ method: "POST", path: "/messages/search", tags: ["WA Cloud"] })
    .input(searchMessagesInputSchema)
    .output(searchMessagesResponseSchema)
    .handler(async ({ input }) => {
      return searchMessagesService(input);
    }),

  listConversationMedia: readWa
    .route({ method: "POST", path: "/messages/media-list", tags: ["WA Cloud"] })
    .input(listConversationMediaInputSchema)
    .output(listConversationMediaResponseSchema)
    .handler(async ({ input }) => {
      return listConversationMediaService(input);
    }),

  listTemplates: readWa
    .route({ method: "GET", path: "/templates", tags: ["WA Cloud"] })
    .input(z.object({ accountId: z.number().int().optional() }).optional())
    .output(listTemplatesResponseSchema)
    .handler(async ({ input }) => {
      return listTemplatesService(input?.accountId);
    }),

  listWebhookLogs: readWa
    .route({ method: "POST", path: "/webhook-logs", tags: ["WA Cloud"] })
    .input(listWebhookLogsInputSchema)
    .output(listWebhookLogsResponseSchema)
    .handler(async ({ input }) => {
      return listWebhookLogsService(input);
    }),

  // ── Business profile ───────────────────────────────────────────────────────
  getBusinessProfile: readWa
    .route({ method: "POST", path: "/profile/get", tags: ["WA Cloud"] })
    .input(waPhoneIdInput)
    .output(businessProfileResponseSchema.nullable())
    .handler(async ({ input }) => {
      const p = await getBusinessProfile(input.phoneNumberId);
      if (!p) return null;
      return {
        about: p.about ?? null,
        address: p.address ?? null,
        description: p.description ?? null,
        email: p.email ?? null,
        profile_picture_url: p.profile_picture_url ?? null,
        vertical: p.vertical ?? null,
        websites: p.websites ?? null,
      };
    }),
  updateBusinessProfile: writeWa
    .route({ method: "POST", path: "/profile/update", tags: ["WA Cloud"] })
    .input(updateBusinessProfileInputSchema)
    .output(waOkResponseSchema)
    .handler(async ({ input }) => {
      await updateBusinessProfile(input.phoneNumberId, input.fields);
      return { status: "ok" as const };
    }),

  // ── Snippets / quick replies ──────────────────────────────────────────────
  listSnippets: readWa
    .route({ method: "POST", path: "/snippets/list", tags: ["WA Cloud"] })
    .input(listSnippetsInputSchema)
    .output(listSnippetsResponseSchema)
    .handler(async ({ input }) => {
      return listSnippetsService(input);
    }),

  upsertSnippet: createWa
    .route({ method: "POST", path: "/snippets/upsert", tags: ["WA Cloud"] })
    .input(upsertSnippetInputSchema)
    .output(snippetSchema)
    .handler(async ({ context, input }) => {
      return upsertSnippetService(input, context.user.id);
    }),

  archiveSnippet: deleteWa
    .route({ method: "POST", path: "/snippets/archive", tags: ["WA Cloud"] })
    .input(z.object({ id: z.number().int().positive() }))
    .output(waOkResponseSchema)
    .handler(async ({ input }) => {
      await archiveSnippetService(input.id);
      return { status: "ok" as const };
    }),

  sendSnippet: writeWa
    .route({ method: "POST", path: "/snippets/send", tags: ["WA Cloud"] })
    .input(sendSnippetInputSchema)
    .output(sendMessageResponseSchema)
    .handler(async ({ context, input }) => {
      return sendSnippetService(input, context.user.id);
    }),

  // ── Saved entities catalog ────────────────────────────────────────────────
  listSavedLocations: readWa
    .route({ method: "GET", path: "/saved/locations", tags: ["WA Cloud"] })
    .input(z.object({}).optional())
    .output(z.object({ locations: z.array(savedLocationSchema) }))
    .handler(async () => {
      return listSavedLocationsService();
    }),
  upsertSavedLocation: createWa
    .route({ method: "POST", path: "/saved/locations/upsert", tags: ["WA Cloud"] })
    .input(upsertSavedLocationInputSchema)
    .output(savedLocationSchema)
    .handler(async ({ context, input }) => {
      return upsertSavedLocationService(input, context.user.id);
    }),
  archiveSavedLocation: deleteWa
    .route({ method: "POST", path: "/saved/locations/archive", tags: ["WA Cloud"] })
    .input(z.object({ id: z.number().int().positive() }))
    .output(waOkResponseSchema)
    .handler(async ({ input }) => {
      await archiveSavedLocationService(input.id);
      return { status: "ok" as const };
    }),

  listSavedInteractiveLists: readWa
    .route({ method: "GET", path: "/saved/lists", tags: ["WA Cloud"] })
    .input(z.object({}).optional())
    .output(z.object({ lists: z.array(savedInteractiveListSchema) }))
    .handler(async () => {
      return listSavedInteractiveListsService();
    }),
  upsertSavedInteractiveList: createWa
    .route({ method: "POST", path: "/saved/lists/upsert", tags: ["WA Cloud"] })
    .input(upsertSavedInteractiveListInputSchema)
    .output(savedInteractiveListSchema)
    .handler(async ({ context, input }) => {
      return upsertSavedInteractiveListService(input, context.user.id);
    }),
  archiveSavedInteractiveList: deleteWa
    .route({ method: "POST", path: "/saved/lists/archive", tags: ["WA Cloud"] })
    .input(z.object({ id: z.number().int().positive() }))
    .output(waOkResponseSchema)
    .handler(async ({ input }) => {
      await archiveSavedInteractiveListService(input.id);
      return { status: "ok" as const };
    }),

  listSavedFlows: readWa
    .route({ method: "GET", path: "/saved/flows", tags: ["WA Cloud"] })
    .input(z.object({}).optional())
    .output(z.object({ flows: z.array(savedFlowSchema) }))
    .handler(async () => {
      return listSavedFlowsService();
    }),
  upsertSavedFlow: createWa
    .route({ method: "POST", path: "/saved/flows/upsert", tags: ["WA Cloud"] })
    .input(upsertSavedFlowInputSchema)
    .output(savedFlowSchema)
    .handler(async ({ context, input }) => {
      return upsertSavedFlowService(input, context.user.id);
    }),
  syncFlows: writeWa
    .route({ method: "POST", path: "/saved/flows/sync", tags: ["WA Cloud"] })
    .input(syncFlowsInputSchema)
    .output(syncFlowsResponseSchema)
    .handler(async ({ context, input }) => {
      return syncFlowsService(input, context.user.id);
    }),
  archiveSavedFlow: deleteWa
    .route({ method: "POST", path: "/saved/flows/archive", tags: ["WA Cloud"] })
    .input(z.object({ id: z.number().int().positive() }))
    .output(waOkResponseSchema)
    .handler(async ({ input }) => {
      await archiveSavedFlowService(input.id);
      return { status: "ok" as const };
    }),

  // ── Send via saved entity (chiquillas eligen, no editan) ──────────────────
  sendSavedLocation: writeWa
    .route({ method: "POST", path: "/messages/send-saved-location", tags: ["WA Cloud"] })
    .input(sendSavedLocationInputSchema)
    .output(sendMessageResponseSchema)
    .handler(async ({ context, input }) => {
      return sendSavedLocationService(input, context.user.id);
    }),

  sendSavedList: writeWa
    .route({ method: "POST", path: "/messages/send-saved-list", tags: ["WA Cloud"] })
    .input(sendSavedListInputSchema)
    .output(sendMessageResponseSchema)
    .handler(async ({ context, input }) => {
      return sendSavedListService(input, context.user.id);
    }),

  sendSavedFlow: writeWa
    .route({ method: "POST", path: "/messages/send-saved-flow", tags: ["WA Cloud"] })
    .input(sendSavedFlowInputSchema)
    .output(sendMessageResponseSchema)
    .handler(async ({ context, input }) => {
      return sendSavedFlowService(input, context.user.id);
    }),

  // ── Saved stickers (estilo WhatsApp) ──────────────────────────────────────
  listSavedStickers: readWa
    .route({ method: "GET", path: "/saved/stickers", tags: ["WA Cloud"] })
    .input(listSavedStickersInputSchema)
    .output(listSavedStickersResponseSchema)
    .handler(async ({ input }) => {
      return listSavedStickersService(input);
    }),
  saveSticker: createWa
    .route({ method: "POST", path: "/saved/stickers/save", tags: ["WA Cloud"] })
    .input(saveStickerInputSchema)
    .output(savedStickerSchema)
    .handler(async ({ context, input }) => {
      return saveStickerFromMessageService(input, context.user.id);
    }),
  unsaveSticker: deleteWa
    .route({ method: "POST", path: "/saved/stickers/unsave", tags: ["WA Cloud"] })
    .input(unsaveStickerInputSchema)
    .output(waOkResponseSchema)
    .handler(async ({ input }) => {
      await unsaveStickerService(input.id);
      return { status: "ok" as const };
    }),
  sendSavedSticker: writeWa
    .route({ method: "POST", path: "/messages/send-saved-sticker", tags: ["WA Cloud"] })
    .input(sendSavedStickerInputSchema)
    .output(sendMessageResponseSchema)
    .handler(async ({ context, input }) => {
      return sendSavedStickerService(input, context.user.id);
    }),

  // ── Global scheduled list ─────────────────────────────────────────────────
  listAllScheduled: readWa
    .route({ method: "POST", path: "/scheduled/list-all", tags: ["WA Cloud"] })
    .input(listAllScheduledInputSchema)
    .output(listAllScheduledResponseSchema)
    .handler(async ({ input }) => {
      return listAllScheduledService(input);
    }),

  // ── Account events / alerts ───────────────────────────────────────────────
  listAccountEvents: readWa
    .route({ method: "POST", path: "/account-events/list", tags: ["WA Cloud"] })
    .input(listAccountEventsInputSchema)
    .output(listAccountEventsResponseSchema)
    .handler(async ({ input }) => {
      return listAccountEventsService(input);
    }),

  acknowledgeAccountEvent: writeWa
    .route({ method: "POST", path: "/account-events/ack", tags: ["WA Cloud"] })
    .input(acknowledgeAccountEventInputSchema)
    .output(waOkResponseSchema)
    .handler(async ({ context, input }) => {
      await acknowledgeAccountEventService(input, context.user.id);
      return { status: "ok" as const };
    }),

  // ── Phone admin (register + 2FA PIN) ───────────────────────────────────────
  registerPhone: writeWa
    .route({ method: "POST", path: "/phones/register", tags: ["WA Cloud"] })
    .input(registerPhoneInputSchema)
    .output(waOkResponseSchema)
    .handler(async ({ input }) => {
      await registerPhoneNumber(input.phoneNumberId, input.pin);
      return { status: "ok" as const };
    }),

  setTwoStepPin: writeWa
    .route({ method: "POST", path: "/phones/two-step-pin", tags: ["WA Cloud"] })
    .input(setTwoStepPinInputSchema)
    .output(waOkResponseSchema)
    .handler(async ({ input }) => {
      await setTwoStepPin(input.phoneNumberId, input.pin);
      return { status: "ok" as const };
    }),

  // ── Phone migration between WABAs ──────────────────────────────────────────
  requestPhoneCode: writeWa
    .route({ method: "POST", path: "/phones/request-code", tags: ["WA Cloud"] })
    .input(requestPhoneCodeInputSchema)
    .output(waOkResponseSchema)
    .handler(async ({ input }) => {
      await requestPhoneVerificationCode(input.phoneNumberId, input.codeMethod, input.language);
      return { status: "ok" as const };
    }),

  verifyPhoneCode: writeWa
    .route({ method: "POST", path: "/phones/verify-code", tags: ["WA Cloud"] })
    .input(verifyPhoneCodeInputSchema)
    .output(waOkResponseSchema)
    .handler(async ({ input }) => {
      await verifyPhoneCode(input.phoneNumberId, input.code);
      return { status: "ok" as const };
    }),

  deregisterPhone: writeWa
    .route({ method: "POST", path: "/phones/deregister", tags: ["WA Cloud"] })
    .input(waPhoneIdInput)
    .output(waOkResponseSchema)
    .handler(async ({ input }) => {
      await deregisterPhoneNumber(input.phoneNumberId);
      return { status: "ok" as const };
    }),

  addMigratingPhone: writeWa
    .route({ method: "POST", path: "/phones/add", tags: ["WA Cloud"] })
    .input(
      z.object({
        accountId: z.number().int().positive(),
        countryCode: z.string().regex(/^\d{1,4}$/),
        phoneNumber: z.string().regex(/^\d{4,15}$/),
        migrate: z.boolean().default(true),
      })
    )
    .output(z.object({ phoneNumberId: z.string() }))
    .handler(async ({ input }) => {
      const r = await addMigratingPhoneNumber(
        input.accountId,
        input.countryCode,
        input.phoneNumber,
        input.migrate
      );
      return { phoneNumberId: r.id };
    }),

  // ── Embedded Signup callback (Solution Partner / OBO onboarding) ──────────
  embeddedSignupComplete: createWa
    .route({ method: "POST", path: "/embedded-signup", tags: ["WA Cloud"] })
    .input(embeddedSignupInputSchema)
    .output(accountResponseSchema)
    .handler(async ({ input }) => {
      return embeddedSignupCompleteService(input);
    }),

  // ── Meta Commerce: catalog config + product browser + send ───────────────
  setCommerceCatalog: writeWa
    .route({ method: "POST", path: "/accounts/commerce-catalog", tags: ["WA Cloud"] })
    .input(setCommerceCatalogInputSchema)
    .output(waOkResponseSchema)
    .handler(async ({ input }) => {
      await setCommerceCatalogService(input);
      return { status: "ok" as const };
    }),

  listCommerceProducts: readWa
    .route({ method: "POST", path: "/commerce/products/list", tags: ["WA Cloud"] })
    .input(listCommerceProductsInputSchema)
    .output(listCommerceProductsResponseSchema)
    .handler(async ({ input }) => {
      return listCommerceProductsService(input);
    }),

  sendSingleProduct: writeWa
    .route({ method: "POST", path: "/messages/send-single-product", tags: ["WA Cloud"] })
    .input(sendSingleProductInputSchema)
    .output(sendMessageResponseSchema)
    .handler(async ({ context, input }) => {
      return sendSingleProductService(input, context.user.id);
    }),

  // ── Multi-Product Message (Meta Commerce) ─────────────────────────────────
  sendMultiProduct: writeWa
    .route({ method: "POST", path: "/messages/send-multi-product", tags: ["WA Cloud"] })
    .input(sendMultiProductInputSchema)
    .output(sendMessageResponseSchema)
    .handler(async ({ context, input }) => {
      return sendMultiProductService(input, context.user.id);
    }),

  // ── Extended analytics with pricing ────────────────────────────────────────
  getConversationAnalyticsExtended: readWa
    .route({ method: "POST", path: "/analytics/conversations/extended", tags: ["WA Cloud"] })
    .input(conversationAnalyticsExtendedInputSchema)
    .output(conversationAnalyticsExtendedResponseSchema)
    .handler(async ({ input }) => {
      const r = await getConversationAnalytics({
        accountId: input.accountId,
        startUnix: input.startUnix,
        endUnix: input.endUnix,
        granularity: input.granularity,
        phoneNumbers: input.phoneNumbers,
        includePricing: input.includePricing,
      });
      const conv = r.conversation_analytics?.data?.[0]?.data_points ?? [];
      const pricing = r.pricing_analytics?.data?.[0]?.data_points ?? [];
      return {
        conversation: conv.map((p) => ({
          start: p.start,
          end: p.end,
          conversation: p.conversation,
          cost: p.cost ?? null,
          phone_number: p.phone_number ?? null,
          country: p.country ?? null,
          conversation_type: p.conversation_type ?? null,
          conversation_direction: p.conversation_direction ?? null,
          conversation_category: p.conversation_category ?? null,
        })),
        pricing: pricing.map((p) => ({
          start: p.start,
          end: p.end,
          volume: p.volume,
          cost: p.cost ?? null,
          pricing_category: p.pricing_category ?? null,
          country: p.country ?? null,
          phone_number: p.phone_number ?? null,
          pricing_type: p.pricing_type ?? null,
          tier: p.tier ?? null,
        })),
      };
    }),

  // ── Phone health ───────────────────────────────────────────────────────────
  getPhoneHealth: readWa
    .route({ method: "POST", path: "/phones/health", tags: ["WA Cloud"] })
    .input(waPhoneIdInput)
    .output(phoneHealthResponseSchema)
    .handler(async ({ input }) => {
      return getPhoneHealthService(input);
    }),

  // ── Conversational automation (ice breakers + commands) ───────────────────
  getConversationalAutomation: readWa
    .route({
      method: "POST",
      path: "/phones/conversational-automation",
      tags: ["WA Cloud"],
    })
    .input(waPhoneIdInput)
    .output(conversationalAutomationSchema)
    .handler(async ({ input }) => {
      const r = await getConversationalAutomation(input.phoneNumberId);
      return {
        enable_welcome_message: Boolean(r.enable_welcome_message),
        prompts: r.prompts ?? [],
        commands: r.commands ?? [],
      };
    }),

  updateConversationalAutomation: writeWa
    .route({
      method: "POST",
      path: "/phones/conversational-automation/update",
      tags: ["WA Cloud"],
    })
    .input(updateConversationalAutomationInputSchema)
    .output(waOkResponseSchema)
    .handler(async ({ input }) => {
      await updateConversationalAutomation(input.phoneNumberId, input.config);
      return { status: "ok" as const };
    }),

  // Cheap local-DB summary for the conversation header badge. Reads the
  // qualityRating snapshot (kept fresh by the webhook handler) and counts
  // unacknowledged critical / warning events for this phone.
  getPhoneQualitySummary: readWa
    .route({
      method: "POST",
      path: "/phones/quality-summary",
      tags: ["WA Cloud"],
    })
    .input(phoneQualitySummaryInputSchema)
    .output(phoneQualitySummaryResponseSchema)
    .handler(async ({ input }) => {
      return getPhoneQualitySummaryService(input);
    }),

  // ── Block / unblock ────────────────────────────────────────────────────────
  blockContact: writeWa
    .route({ method: "POST", path: "/contacts/block", tags: ["WA Cloud"] })
    .input(blockContactInputSchema)
    .output(waOkResponseSchema)
    .handler(async ({ context, input }) => {
      await blockContactService(input, context.user.id);
      return { status: "ok" as const };
    }),
  unblockContact: writeWa
    .route({ method: "POST", path: "/contacts/unblock", tags: ["WA Cloud"] })
    .input(blockContactInputSchema)
    .output(waOkResponseSchema)
    .handler(async ({ input }) => {
      await unblockContactService(input);
      return { status: "ok" as const };
    }),
  listBlocked: readWa
    .route({ method: "POST", path: "/contacts/blocked", tags: ["WA Cloud"] })
    .input(waPhoneIdInput)
    .output(listBlockedResponseSchema)
    .handler(async ({ input }) => {
      return listBlockedService(input);
    }),

  // ── Typing indicator ───────────────────────────────────────────────────────
  setTyping: writeWa
    .route({ method: "POST", path: "/conversations/typing", tags: ["WA Cloud"] })
    .input(z.object({ conversationId: z.number().int().positive() }))
    .output(waOkResponseSchema)
    .handler(async ({ context, input }) => {
      // Adjuntar la identidad del operador para el hint de colisión en la
      // bandeja compartida ("Andrea está respondiendo…"). El nombre se resuelve
      // con una sola query (cae al local-part del email si no hay persona).
      const userName = await resolveUserDisplayName(context.user.id, context.user.email);
      await setConversationTypingService(input.conversationId, {
        userId: context.user.id,
        userName,
      });
      return { status: "ok" as const };
    }),

  // ── Analytics ──────────────────────────────────────────────────────────────
  getConversationAnalytics: readWa
    .route({ method: "POST", path: "/analytics/conversations", tags: ["WA Cloud"] })
    .input(conversationAnalyticsInputSchema)
    .output(conversationAnalyticsResponseSchema)
    .handler(async ({ input }) => {
      const r = await getConversationAnalytics({
        accountId: input.accountId,
        startUnix: input.startUnix,
        endUnix: input.endUnix,
        granularity: input.granularity,
        phoneNumbers: input.phoneNumbers,
      });
      const points = r.conversation_analytics?.data?.[0]?.data_points ?? [];
      return {
        dataPoints: points.map((p) => ({
          start: p.start,
          end: p.end,
          conversation: p.conversation,
          cost: p.cost ?? null,
          phone_number: p.phone_number ?? null,
          conversation_type: p.conversation_type ?? null,
          conversation_direction: p.conversation_direction ?? null,
          conversation_category: p.conversation_category ?? null,
        })),
      };
    }),
};

export const waCloudORPCRouter = base.prefix("/api/orpc/wa-cloud").router(waRouterBase);

// Error logging lives in the `base` procedure middleware (path-aware). The
// handler only needs SuperJSONRPCHandler's built-in normalizeServerError.
export const waCloudORPCHandler = new SuperJSONRPCHandler(waCloudORPCRouter);

export const waCloudOpenAPIHandler = new OpenAPIHandler(waCloudORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia WhatsApp Cloud oRPC",
          description: "Contratos para WhatsApp Cloud API integration.",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [onError((error) => logError("openapi.wa-cloud", error, { module: "api" }))],
});

export type WaCloudORPCRouter = typeof waCloudORPCRouter;

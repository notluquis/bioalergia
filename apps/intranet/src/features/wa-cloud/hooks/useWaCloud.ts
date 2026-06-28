// oxlint-disable typescript/no-non-null-assertion -- TODO(strict-null): refactor each `!` to invariant() or explicit guard. Tracked in repo-wide non-null cleanup.
import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { waCloudORPCClient } from "../orpc";

// Mirror of orpc-client's CSRF cookie reader. Multipart uploads bypass the
// oRPC fetch wrapper, so they need to add the X-CSRF-Token header here.
function csrfHeaders(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const m = document.cookie.match(/(?:^|; )csrf_token=([^;]+)/);
  return m ? { "X-CSRF-Token": decodeURIComponent(m[1]!) } : {};
}

const KEY = ["wa-cloud"] as const;

// Subscribe to server-sent events for one conversation. The hook owns
// EventSource lifetime (open on mount/id change, close on cleanup) and
// invalidates the React Query cache on each event so the UI re-renders
// from authoritative server state instead of trying to merge partial
// payloads. See apps/api/src/routes/wa-cloud-sse.ts for the event shapes.
export function useConversationSse(id: number | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!id) return;
    const url = `/api/wa-cloud/sse/${id}`;
    const es = new EventSource(url, { withCredentials: true });
    const refetch = () => {
      void qc.invalidateQueries({ queryKey: [...KEY, "conversation", id] });
      void qc.invalidateQueries({ queryKey: [...KEY, "conversations"] });
    };
    es.addEventListener("message", refetch);
    es.addEventListener("status", refetch);
    es.addEventListener("reaction", refetch);
    es.addEventListener("deleted", refetch);
    // 'open' / 'ping' / 'error' do not trigger a refetch.
    return () => {
      es.close();
    };
  }, [id, qc]);
}

export function useAccounts() {
  return useQuery({
    queryKey: [...KEY, "accounts"],
    queryFn: () => waCloudORPCClient.listAccounts({}),
  });
}

export function useUpsertAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.upsertAccount>[0]) =>
      waCloudORPCClient.upsertAccount(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...KEY, "accounts"] }),
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => waCloudORPCClient.deleteAccount({ id }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...KEY, "accounts"] }),
  });
}

export function useValidateAccount() {
  return useMutation({
    mutationFn: (id: number) => waCloudORPCClient.validateAccount({ id }),
  });
}

export function useSyncPhones() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => waCloudORPCClient.syncPhoneNumbers({ id }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...KEY, "accounts"] }),
  });
}

export function useSyncTemplates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => waCloudORPCClient.syncTemplates({ id }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...KEY, "templates"] }),
  });
}

export function useAbonoAutomationSettings() {
  return useQuery({
    queryKey: [...KEY, "abono-automation-settings"],
    queryFn: () => waCloudORPCClient.getAbonoAutomationSettings({}),
  });
}

export function useUpdateAbonoAutomationSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.updateAbonoAutomationSettings>[0]) =>
      waCloudORPCClient.updateAbonoAutomationSettings(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...KEY, "abono-automation-settings"] }),
  });
}

export function useUpsertPhoneNumber() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.upsertPhoneNumber>[0]) =>
      waCloudORPCClient.upsertPhoneNumber(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...KEY, "accounts"] }),
  });
}

export function useConversations(input: Parameters<typeof waCloudORPCClient.listConversations>[0]) {
  return useQuery({
    queryKey: [...KEY, "conversations", input],
    queryFn: () => waCloudORPCClient.listConversations(input),
    // SSE invalidates this key on every new event for any open conv.
    // Keep a slow safety poll for newly-created convs that the user
    // doesn't have open yet.
    refetchInterval: 30_000,
  });
}

export function useConversation(id: number | undefined) {
  // SSE pushes invalidations; we poll only as a slow fallback.
  useConversationSse(id);
  return useQuery({
    queryKey: [...KEY, "conversation", id],
    enabled: Boolean(id),
    queryFn: () => waCloudORPCClient.getConversation({ id: id! }),
    refetchInterval: 30_000,
  });
}

// Upload a sample header image/video/document for template approval.
// Returns the Meta resumable upload handle (h:... ) which the operator
// pastes into the createTemplate components header.example field.
export async function uploadTemplateHeaderSample(
  file: File,
  phoneNumberId: number
): Promise<{ handle: string; filename: string; size: number; mimeType: string | null }> {
  const form = new FormData();
  form.append("file", file);
  form.append("phoneNumberId", String(phoneNumberId));
  const res = await fetch("/api/wa-cloud/media/template-header-sample", {
    method: "POST",
    body: form,
    credentials: "include",
    headers: csrfHeaders(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Upload falló (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json();
}

// Meta Commerce: catalog config + products + send single product.
export function useSetCommerceCatalog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.setCommerceCatalog>[0]) =>
      waCloudORPCClient.setCommerceCatalog(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...KEY, "accounts"] }),
  });
}
export function useCommerceProducts(
  input: Parameters<typeof waCloudORPCClient.listCommerceProducts>[0] | undefined
) {
  return useQuery({
    queryKey: [...KEY, "commerce-products", input],
    enabled: Boolean(input?.accountId),
    queryFn: () => waCloudORPCClient.listCommerceProducts(input!),
    staleTime: 60_000,
  });
}
export function useSendSingleProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.sendSingleProduct>[0]) =>
      waCloudORPCClient.sendSingleProduct(input),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: [...KEY, "conversation", vars.conversationId] });
    },
  });
}

// Phone migration between WABAs (add slot → request OTP → verify →
// register w/ PIN). Meta sequence: POST /WABA_ID/phone_numbers
// (migrate_phone_number=true) → /PHONE_NUMBER_ID/request_code →
// /PHONE_NUMBER_ID/verify_code → /PHONE_NUMBER_ID/register.
export function useAddMigratingPhone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.addMigratingPhone>[0]) =>
      waCloudORPCClient.addMigratingPhone(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...KEY, "accounts"] }),
  });
}
export function useRequestPhoneCode() {
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.requestPhoneCode>[0]) =>
      waCloudORPCClient.requestPhoneCode(input),
  });
}
export function useVerifyPhoneCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.verifyPhoneCode>[0]) =>
      waCloudORPCClient.verifyPhoneCode(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...KEY, "accounts"] }),
  });
}
export function useDeregisterPhone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.deregisterPhone>[0]) =>
      waCloudORPCClient.deregisterPhone(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...KEY, "accounts"] }),
  });
}

// Multi-Product Message (Meta Commerce catalog).
export function useSendMultiProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.sendMultiProduct>[0]) =>
      waCloudORPCClient.sendMultiProduct(input),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: [...KEY, "conversation", vars.conversationId] });
    },
  });
}

// Embedded Signup callback consumer (Solution Partner / OBO).
export function useEmbeddedSignupComplete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.embeddedSignupComplete>[0]) =>
      waCloudORPCClient.embeddedSignupComplete(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...KEY, "accounts"] }),
  });
}

// Template library (Meta-curated catalog) + clone mutation. The list is
// per-account + filters; clone refetches the local templates list so the
// new entry appears immediately.
export function useTemplateLibrary(
  input: Parameters<typeof waCloudORPCClient.listTemplateLibrary>[0] | undefined
) {
  return useQuery({
    queryKey: [...KEY, "template-library", input],
    enabled: Boolean(input?.accountId),
    queryFn: () => waCloudORPCClient.listTemplateLibrary(input!),
    staleTime: 5 * 60_000,
  });
}

export function useCloneTemplateFromLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.cloneTemplateFromLibrary>[0]) =>
      waCloudORPCClient.cloneTemplateFromLibrary(input),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: [...KEY, "templates", vars.accountId] });
    },
  });
}

// Conversational automation (ice breakers + commands + welcome flag).
// Read-only fetch + write mutation. Cache key per phone.
export function useConversationalAutomation(phoneNumberId: number | undefined) {
  return useQuery({
    queryKey: [...KEY, "conversational-automation", phoneNumberId],
    enabled: Boolean(phoneNumberId),
    queryFn: () => waCloudORPCClient.getConversationalAutomation({ phoneNumberId: phoneNumberId! }),
    staleTime: 60_000,
  });
}

export function useUpdateConversationalAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.updateConversationalAutomation>[0]) =>
      waCloudORPCClient.updateConversationalAutomation(input),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({
        queryKey: [...KEY, "conversational-automation", vars.phoneNumberId],
      });
    },
  });
}

// Cheap per-phone quality summary (snapshot from DB + unack counts) for
// the conversation header badge. Refreshed every 60s; UI overlays a toast
// on top when criticalUnacknowledged grows.
export function usePhoneQualitySummary(phoneNumberId: number | undefined) {
  return useQuery({
    queryKey: [...KEY, "phone-quality-summary", phoneNumberId],
    enabled: Boolean(phoneNumberId),
    queryFn: () => waCloudORPCClient.getPhoneQualitySummary({ phoneNumberId: phoneNumberId! }),
    refetchInterval: 60_000,
  });
}

export function useUpdateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.updateConversation>[0]) =>
      waCloudORPCClient.updateConversation(input),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: [...KEY, "conversation", vars.id] });
      void qc.invalidateQueries({ queryKey: [...KEY, "conversations"] });
    },
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: number) => waCloudORPCClient.markRead({ conversationId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...KEY, "conversations"] });
    },
  });
}

export function useSetMute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { conversationId: number; mutedUntil: string | null }) =>
      waCloudORPCClient.setMute(input),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: [...KEY, "conversation", vars.conversationId] });
      void qc.invalidateQueries({ queryKey: [...KEY, "conversations"] });
    },
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.updateContact>[0]) =>
      waCloudORPCClient.updateContact(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...KEY, "conversation"] }),
  });
}

export function useSendText() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.sendText>[0]) =>
      waCloudORPCClient.sendText(input),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: [...KEY, "conversation", vars.conversationId] });
    },
  });
}

export function useSendTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.sendTemplate>[0]) =>
      waCloudORPCClient.sendTemplate(input),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: [...KEY, "conversation", vars.conversationId] });
    },
  });
}

export function useSendReaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.sendReaction>[0]) =>
      waCloudORPCClient.sendReaction(input),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: [...KEY, "conversation", vars.conversationId] });
    },
  });
}

export function useSendFlow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.sendFlow>[0]) =>
      waCloudORPCClient.sendFlow(input),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: [...KEY, "conversation", vars.conversationId] });
    },
  });
}

// Snippets
export function useSnippets(input?: Parameters<typeof waCloudORPCClient.listSnippets>[0]) {
  return useQuery({
    queryKey: [...KEY, "snippets", input],
    queryFn: () => waCloudORPCClient.listSnippets(input ?? {}),
    staleTime: 30_000,
  });
}
export function useUpsertSnippet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.upsertSnippet>[0]) =>
      waCloudORPCClient.upsertSnippet(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...KEY, "snippets"] }),
  });
}
export function useArchiveSnippet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => waCloudORPCClient.archiveSnippet({ id }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...KEY, "snippets"] }),
  });
}
export function useSendSnippet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.sendSnippet>[0]) =>
      waCloudORPCClient.sendSnippet(input),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: [...KEY, "conversation", vars.conversationId] });
      void qc.invalidateQueries({ queryKey: [...KEY, "snippets"] });
    },
  });
}

// WhatsApp-style stickers: a per-account tray that auto-fills "recientes" as
// stickers are sent and "guardados" when a received sticker is starred.
export function useSavedStickers(accountId: number | undefined, tab: "recientes" | "guardados") {
  return useQuery({
    queryKey: [...KEY, "saved-stickers", accountId, tab],
    enabled: Boolean(accountId),
    queryFn: () => waCloudORPCClient.listSavedStickers({ accountId: accountId!, tab }),
    staleTime: 30_000,
  });
}
export function useSendSavedSticker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.sendSavedSticker>[0]) =>
      waCloudORPCClient.sendSavedSticker(input),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: [...KEY, "conversation", vars.conversationId] });
      void qc.invalidateQueries({ queryKey: [...KEY, "saved-stickers"] });
    },
  });
}
export function useSaveSticker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.saveSticker>[0]) =>
      waCloudORPCClient.saveSticker(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...KEY, "saved-stickers"] }),
  });
}
export function useUnsaveSticker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.unsaveSticker>[0]) =>
      waCloudORPCClient.unsaveSticker(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...KEY, "saved-stickers"] }),
  });
}

// Saved entities catalog
export function useSavedLocations() {
  return useQuery({
    queryKey: [...KEY, "saved-locations"],
    queryFn: () => waCloudORPCClient.listSavedLocations({}),
  });
}
export function useUpsertSavedLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.upsertSavedLocation>[0]) =>
      waCloudORPCClient.upsertSavedLocation(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...KEY, "saved-locations"] }),
  });
}
export function useArchiveSavedLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => waCloudORPCClient.archiveSavedLocation({ id }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...KEY, "saved-locations"] }),
  });
}

export function useSavedInteractiveLists() {
  return useQuery({
    queryKey: [...KEY, "saved-lists"],
    queryFn: () => waCloudORPCClient.listSavedInteractiveLists({}),
  });
}
export function useUpsertSavedInteractiveList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.upsertSavedInteractiveList>[0]) =>
      waCloudORPCClient.upsertSavedInteractiveList(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...KEY, "saved-lists"] }),
  });
}
export function useArchiveSavedInteractiveList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => waCloudORPCClient.archiveSavedInteractiveList({ id }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...KEY, "saved-lists"] }),
  });
}

export function useSavedFlows() {
  return useQuery({
    queryKey: [...KEY, "saved-flows"],
    queryFn: () => waCloudORPCClient.listSavedFlows({}),
  });
}
export function useUpsertSavedFlow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.upsertSavedFlow>[0]) =>
      waCloudORPCClient.upsertSavedFlow(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...KEY, "saved-flows"] }),
  });
}
export function useSyncFlows() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountId: number) => waCloudORPCClient.syncFlows({ accountId }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...KEY, "saved-flows"] }),
  });
}

export function useArchiveSavedFlow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => waCloudORPCClient.archiveSavedFlow({ id }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...KEY, "saved-flows"] }),
  });
}

export function useSendSavedLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.sendSavedLocation>[0]) =>
      waCloudORPCClient.sendSavedLocation(input),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: [...KEY, "conversation", vars.conversationId] });
    },
  });
}
export function useSendSavedList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.sendSavedList>[0]) =>
      waCloudORPCClient.sendSavedList(input),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: [...KEY, "conversation", vars.conversationId] });
    },
  });
}
export function useSendSavedFlow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.sendSavedFlow>[0]) =>
      waCloudORPCClient.sendSavedFlow(input),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: [...KEY, "conversation", vars.conversationId] });
    },
  });
}

export function useAllScheduled(input?: Parameters<typeof waCloudORPCClient.listAllScheduled>[0]) {
  return useQuery({
    queryKey: [...KEY, "scheduled-all", input],
    queryFn: () => waCloudORPCClient.listAllScheduled(input ?? { limit: 200 }),
    refetchInterval: 30_000,
  });
}

export function useAccountEvents(
  input?: Parameters<typeof waCloudORPCClient.listAccountEvents>[0]
) {
  return useQuery({
    queryKey: [...KEY, "account-events", input],
    queryFn: () => waCloudORPCClient.listAccountEvents(input ?? { limit: 100 }),
    refetchInterval: 30_000,
  });
}

export function useAcknowledgeAccountEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => waCloudORPCClient.acknowledgeAccountEvent({ id }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...KEY, "account-events"] }),
  });
}

export function useSendInteractiveList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.sendInteractiveList>[0]) =>
      waCloudORPCClient.sendInteractiveList(input),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: [...KEY, "conversation", vars.conversationId] });
    },
  });
}

export function useSendAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.sendAddress>[0]) =>
      waCloudORPCClient.sendAddress(input),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: [...KEY, "conversation", vars.conversationId] });
    },
  });
}

export function useRegisterPhone() {
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.registerPhone>[0]) =>
      waCloudORPCClient.registerPhone(input),
  });
}

export function useSetTwoStepPin() {
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.setTwoStepPin>[0]) =>
      waCloudORPCClient.setTwoStepPin(input),
  });
}

export function useConversationAnalyticsExtended(
  input: Parameters<typeof waCloudORPCClient.getConversationAnalyticsExtended>[0] | null
) {
  return useQuery({
    queryKey: [...KEY, "analytics-ext", input],
    // skipToken: never runs with null (even via manual refetch/prefetch) and
    // drops the lying `input!` assertion. Golden TanStack v5 conditional query.
    queryFn: input ? () => waCloudORPCClient.getConversationAnalyticsExtended(input) : skipToken,
    staleTime: 5 * 60_000,
  });
}

export async function uploadProfilePicture(
  file: File,
  phoneNumberId: number
): Promise<{ ok: boolean; handle: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("phoneNumberId", String(phoneNumberId));
  const res = await fetch("/api/wa-cloud/media/profile-picture", {
    method: "POST",
    body: form,
    credentials: "include",
    headers: csrfHeaders(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Upload failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json();
}

export function useSendLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.sendLocation>[0]) =>
      waCloudORPCClient.sendLocation(input),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: [...KEY, "conversation", vars.conversationId] });
    },
  });
}

export function useSendContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.sendContacts>[0]) =>
      waCloudORPCClient.sendContacts(input),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: [...KEY, "conversation", vars.conversationId] });
    },
  });
}

export function useEditText() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.editText>[0]) =>
      waCloudORPCClient.editText(input),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: [...KEY, "conversation", vars.conversationId] });
    },
  });
}

export function useSendMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.sendMedia>[0]) =>
      waCloudORPCClient.sendMedia(input),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: [...KEY, "conversation", vars.conversationId] });
    },
  });
}

export function useForwardMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.forwardMessage>[0]) =>
      waCloudORPCClient.forwardMessage(input),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({
        queryKey: [...KEY, "conversation", vars.targetConversationId],
      });
      void qc.invalidateQueries({ queryKey: [...KEY, "conversations"] });
    },
  });
}

// Turn a failed upload Response into a short, human Spanish message. Gateways
// (Railway/Caddy) answer 5xx with a full HTML error page — never surface that
// raw HTML in a toast. Prefer a JSON `{error}` body, else map by status.
async function uploadErrorMessage(res: Response): Promise<string> {
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const j = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
    const msg = j?.error ?? j?.message;
    if (msg) return msg;
  }
  if (res.status === 413) return "El archivo es demasiado grande.";
  if (res.status === 415) return "Tipo de archivo no soportado.";
  if (res.status === 401 || res.status === 403) return "Sesión expirada. Recarga la página.";
  if (res.status >= 500) return "El servidor no está disponible. Intenta de nuevo en un momento.";
  return `No se pudo subir el archivo (${res.status}).`;
}

export async function uploadWaMedia(
  file: File,
  phoneNumberId: number
): Promise<{ id: string; mimeType: string; filename: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("phoneNumberId", String(phoneNumberId));
  const res = await fetch("/api/wa-cloud/media/upload", {
    method: "POST",
    body: form,
    credentials: "include",
    headers: csrfHeaders(),
  });
  if (!res.ok) {
    throw new Error(await uploadErrorMessage(res));
  }
  return res.json();
}

export function useBroadcasts() {
  return useQuery({
    queryKey: [...KEY, "broadcasts"],
    queryFn: () => waCloudORPCClient.listBroadcasts({}),
    refetchInterval: 5000,
  });
}

export function useBroadcast(id: number | undefined) {
  return useQuery({
    queryKey: [...KEY, "broadcast", id],
    enabled: Boolean(id),
    queryFn: () => waCloudORPCClient.getBroadcast({ id: id! }),
    refetchInterval: 3000,
  });
}

export function useCreateBroadcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.createBroadcast>[0]) =>
      waCloudORPCClient.createBroadcast(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...KEY, "broadcasts"] }),
  });
}

export function useStartBroadcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => waCloudORPCClient.startBroadcast({ id }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...KEY, "broadcasts"] });
      void qc.invalidateQueries({ queryKey: [...KEY, "broadcast"] });
    },
  });
}

export function useCancelBroadcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => waCloudORPCClient.cancelBroadcast({ id }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...KEY, "broadcasts"] });
      void qc.invalidateQueries({ queryKey: [...KEY, "broadcast"] });
    },
  });
}

export function useScheduleMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.scheduleMessage>[0]) =>
      waCloudORPCClient.scheduleMessage(input),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: [...KEY, "scheduled", vars.conversationId] });
      // "scheduled-all" (global view) is a disjoint sibling key, not covered by
      // the per-conversation prefix above — invalidate it explicitly.
      void qc.invalidateQueries({ queryKey: [...KEY, "scheduled-all"] });
    },
  });
}

export function useListScheduled(conversationId: number | undefined) {
  return useQuery({
    queryKey: [...KEY, "scheduled", conversationId],
    enabled: Boolean(conversationId),
    queryFn: () => waCloudORPCClient.listScheduled({ conversationId: conversationId! }),
    refetchInterval: 30_000,
  });
}

export function useCancelScheduled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => waCloudORPCClient.cancelScheduled({ id }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...KEY, "scheduled"] });
      // Plus the disjoint global view (sibling key, not a prefix match above).
      void qc.invalidateQueries({ queryKey: [...KEY, "scheduled-all"] });
    },
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.createTemplate>[0]) =>
      waCloudORPCClient.createTemplate(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...KEY, "templates"] }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.deleteTemplate>[0]) =>
      waCloudORPCClient.deleteTemplate(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...KEY, "templates"] }),
  });
}

export function useSearchMessages(
  input: Parameters<typeof waCloudORPCClient.searchMessages>[0] | null
) {
  return useQuery({
    queryKey: [...KEY, "search", input],
    enabled: Boolean(input && input.q.length >= 2),
    queryFn: () => waCloudORPCClient.searchMessages(input!),
    staleTime: 10_000,
  });
}

export function useConversationMedia(conversationId: number | undefined) {
  return useQuery({
    queryKey: [...KEY, "media", conversationId],
    enabled: Boolean(conversationId),
    queryFn: () => waCloudORPCClient.listConversationMedia({ conversationId: conversationId! }),
    staleTime: 30_000,
  });
}

export function useTemplates(accountId?: number) {
  return useQuery({
    queryKey: [...KEY, "templates", accountId],
    queryFn: () => waCloudORPCClient.listTemplates({ accountId }),
  });
}

export function useBusinessProfile(phoneNumberId?: number) {
  return useQuery({
    queryKey: [...KEY, "profile", phoneNumberId],
    enabled: Boolean(phoneNumberId),
    queryFn: () => waCloudORPCClient.getBusinessProfile({ phoneNumberId: phoneNumberId! }),
    staleTime: 60_000,
  });
}

export function useUpdateBusinessProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.updateBusinessProfile>[0]) =>
      waCloudORPCClient.updateBusinessProfile(input),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: [...KEY, "profile", vars.phoneNumberId] });
    },
  });
}

export function usePhoneHealth(phoneNumberId?: number) {
  return useQuery({
    queryKey: [...KEY, "health", phoneNumberId],
    enabled: Boolean(phoneNumberId),
    queryFn: () => waCloudORPCClient.getPhoneHealth({ phoneNumberId: phoneNumberId! }),
    staleTime: 30_000,
  });
}

export function useBlockContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.blockContact>[0]) =>
      waCloudORPCClient.blockContact(input),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: [...KEY, "conversation", vars.conversationId] });
      void qc.invalidateQueries({ queryKey: [...KEY, "conversations"] });
    },
  });
}

export function useUnblockContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof waCloudORPCClient.unblockContact>[0]) =>
      waCloudORPCClient.unblockContact(input),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: [...KEY, "conversation", vars.conversationId] });
    },
  });
}

export function useSetTyping() {
  return useMutation({
    mutationFn: (conversationId: number) => waCloudORPCClient.setTyping({ conversationId }),
  });
}

// Collision detection for the shared inbox: subscribes to the SSE "typing"
// event (which now carries the typer's identity) and exposes the OTHER agent
// currently composing, so the header can warn "Andrea está respondiendo…".
// Ignores our own typing and auto-expires after 6s of silence.
export function useTypingPresence(
  conversationId: number | undefined,
  currentUserId: number | undefined
): { userId: number; userName: string } | null {
  const [typing, setTyping] = useState<{ userId: number; userName: string } | null>(null);
  useEffect(() => {
    if (!conversationId) return;
    const es = new EventSource(`/api/wa-cloud/sse/${conversationId}`, { withCredentials: true });
    let timer: ReturnType<typeof setTimeout> | null = null;
    es.addEventListener("typing", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as {
          userId?: number;
          userName?: string;
        };
        if (!data.userId || (currentUserId && data.userId === currentUserId)) return;
        setTyping({ userId: data.userId, userName: data.userName ?? "Alguien del equipo" });
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => setTyping(null), 6000);
      } catch {
        // ignore malformed events
      }
    });
    return () => {
      es.close();
      if (timer) clearTimeout(timer);
      setTyping(null);
    };
  }, [conversationId, currentUserId]);
  return typing;
}

export function useConversationAnalytics(
  input: Parameters<typeof waCloudORPCClient.getConversationAnalytics>[0] | null
) {
  return useQuery({
    queryKey: [...KEY, "analytics", input],
    enabled: Boolean(input),
    queryFn: () => waCloudORPCClient.getConversationAnalytics(input!),
    staleTime: 5 * 60_000,
  });
}

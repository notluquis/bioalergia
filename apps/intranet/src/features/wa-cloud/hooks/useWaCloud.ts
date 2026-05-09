import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { waCloudORPCClient } from "../orpc";

const KEY = ["wa-cloud"] as const;

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
    refetchInterval: 5000,
  });
}

export function useConversation(id: number | undefined) {
  return useQuery({
    queryKey: [...KEY, "conversation", id],
    enabled: Boolean(id),
    queryFn: () => waCloudORPCClient.getConversation({ id: id! }),
    refetchInterval: 3000,
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
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Upload failed (${res.status}): ${text.slice(0, 200)}`);
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
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...KEY, "scheduled"] }),
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

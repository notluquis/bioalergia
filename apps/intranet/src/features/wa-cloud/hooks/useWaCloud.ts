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

export function useTemplates(accountId?: number) {
  return useQuery({
    queryKey: [...KEY, "templates", accountId],
    queryFn: () => waCloudORPCClient.listTemplates({ accountId }),
  });
}

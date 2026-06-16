import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  connectMetaAccountInputSchema,
  createSocialPostInputSchema,
  renderSocialPostInputSchema,
  scheduleSocialPostInputSchema,
  updateSocialPostInputSchema,
} from "@finanzas/orpc-contracts/social";
import type { z } from "zod";
import { socialORPCClient, toSocialApiError } from "./orpc";
import type { SocialAccount, SocialPost, SocialPostStatus } from "./types";

type CreateInput = z.infer<typeof createSocialPostInputSchema>;
type UpdateInput = z.infer<typeof updateSocialPostInputSchema>;
type RenderInput = z.infer<typeof renderSocialPostInputSchema>;
type ScheduleInput = z.infer<typeof scheduleSocialPostInputSchema>;
type ConnectAccountInput = z.infer<typeof connectMetaAccountInputSchema>;

export const socialKeys = {
  all: ["social"] as const,
  lists: () => [...socialKeys.all, "list"] as const,
  list: (status?: SocialPostStatus) => [...socialKeys.lists(), status ?? "all"] as const,
  details: () => [...socialKeys.all, "detail"] as const,
  detail: (id: number) => [...socialKeys.details(), id] as const,
  accounts: () => [...socialKeys.all, "accounts"] as const,
};

async function fetchSocialPosts(status?: SocialPostStatus): Promise<SocialPost[]> {
  try {
    const result = await socialORPCClient.list(status ? { status } : {});
    return result.posts;
  } catch (error) {
    throw toSocialApiError(error);
  }
}

async function fetchSocialPost(id: number): Promise<SocialPost> {
  try {
    const result = await socialORPCClient.detail({ id });
    return result.post;
  } catch (error) {
    throw toSocialApiError(error);
  }
}

async function fetchSocialAccounts(): Promise<SocialAccount[]> {
  try {
    const result = await socialORPCClient.listAccounts({});
    return result.accounts;
  } catch (error) {
    throw toSocialApiError(error);
  }
}

export function useSocialPosts(status?: SocialPostStatus) {
  return useQuery({
    queryKey: socialKeys.list(status),
    queryFn: () => fetchSocialPosts(status),
  });
}

export function useSocialPost(id: number | undefined) {
  return useQuery({
    enabled: typeof id === "number" && id > 0,
    queryKey: typeof id === "number" ? socialKeys.detail(id) : ["social", "detail", "disabled"],
    queryFn: () => fetchSocialPost(id as number),
  });
}

export function useSocialAccounts() {
  return useQuery({
    queryKey: socialKeys.accounts(),
    queryFn: fetchSocialAccounts,
  });
}

export function useCreateSocialPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateInput) => {
      try {
        const result = await socialORPCClient.create(input);
        return result.post;
      } catch (error) {
        throw toSocialApiError(error);
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: socialKeys.lists() });
    },
  });
}

export function useUpdateSocialPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateInput) => {
      try {
        const result = await socialORPCClient.update(input);
        return result.post;
      } catch (error) {
        throw toSocialApiError(error);
      }
    },
    onSuccess: (post) => {
      void qc.invalidateQueries({ queryKey: socialKeys.lists() });
      void qc.invalidateQueries({ queryKey: socialKeys.detail(post.id) });
    },
  });
}

export function useRenderSocialMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RenderInput) => {
      try {
        const result = await socialORPCClient.render(input);
        return result.post;
      } catch (error) {
        throw toSocialApiError(error);
      }
    },
    onSuccess: (post) => {
      void qc.invalidateQueries({ queryKey: socialKeys.lists() });
      void qc.invalidateQueries({ queryKey: socialKeys.detail(post.id) });
    },
  });
}

export function useApproveSocialPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      try {
        const result = await socialORPCClient.approve({ id });
        return result.post;
      } catch (error) {
        throw toSocialApiError(error);
      }
    },
    onSuccess: (post) => {
      void qc.invalidateQueries({ queryKey: socialKeys.lists() });
      void qc.invalidateQueries({ queryKey: socialKeys.detail(post.id) });
    },
  });
}

export function useRejectSocialPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: number; reason: string }) => {
      try {
        const result = await socialORPCClient.reject(input);
        return result.post;
      } catch (error) {
        throw toSocialApiError(error);
      }
    },
    onSuccess: (post) => {
      void qc.invalidateQueries({ queryKey: socialKeys.lists() });
      void qc.invalidateQueries({ queryKey: socialKeys.detail(post.id) });
    },
  });
}

export function useScheduleSocialPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ScheduleInput) => {
      try {
        const result = await socialORPCClient.schedule(input);
        return result.post;
      } catch (error) {
        throw toSocialApiError(error);
      }
    },
    onSuccess: (post) => {
      void qc.invalidateQueries({ queryKey: socialKeys.lists() });
      void qc.invalidateQueries({ queryKey: socialKeys.detail(post.id) });
    },
  });
}

export function usePublishNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      try {
        const result = await socialORPCClient.publishNow({ id });
        return result.post;
      } catch (error) {
        throw toSocialApiError(error);
      }
    },
    onSuccess: (post) => {
      void qc.invalidateQueries({ queryKey: socialKeys.lists() });
      void qc.invalidateQueries({ queryKey: socialKeys.detail(post.id) });
    },
  });
}

export function useConnectAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ConnectAccountInput) => {
      try {
        const result = await socialORPCClient.connectAccount(input);
        return result.account;
      } catch (error) {
        throw toSocialApiError(error);
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: socialKeys.accounts() });
    },
  });
}

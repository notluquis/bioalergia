import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  PatientOptInResponse,
  SendBroadcastInput,
  SendTestEmailInput,
} from "@finanzas/orpc-contracts/email";
import { emailORPCClient, toEmailApiError } from "./orpc";

export const emailKeys = {
  all: ["email"] as const,
  recipientsCount: () => [...emailKeys.all, "recipients-count"] as const,
  optIn: (personId: number) => [...emailKeys.all, "opt-in", personId] as const,
};

export function useBroadcastRecipientsCount() {
  return useQuery({
    queryKey: emailKeys.recipientsCount(),
    queryFn: async () => {
      try {
        const { count } = await emailORPCClient.recipientsCount();
        return count;
      } catch (error) {
        throw toEmailApiError(error);
      }
    },
  });
}

export function useSendBroadcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SendBroadcastInput) => {
      try {
        return await emailORPCClient.sendBroadcast(input);
      } catch (error) {
        throw toEmailApiError(error);
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: emailKeys.recipientsCount() });
    },
  });
}

export function useSendTestEmail() {
  return useMutation({
    mutationFn: async (input: SendTestEmailInput) => {
      try {
        return await emailORPCClient.sendTest(input);
      } catch (error) {
        throw toEmailApiError(error);
      }
    },
  });
}

export function usePatientOptIn(personId: number | null) {
  return useQuery({
    enabled: personId != null,
    queryKey: emailKeys.optIn(personId ?? 0),
    queryFn: async (): Promise<PatientOptInResponse> => {
      try {
        return await emailORPCClient.getPatientOptIn({ personId: personId as number });
      } catch (error) {
        throw toEmailApiError(error);
      }
    },
  });
}

export function useSetPatientOptIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { personId: number; optIn: boolean }) => {
      try {
        return await emailORPCClient.setPatientOptIn(input);
      } catch (error) {
        throw toEmailApiError(error);
      }
    },
    onSuccess: (data) => {
      qc.setQueryData(emailKeys.optIn(data.personId), data);
      void qc.invalidateQueries({ queryKey: emailKeys.recipientsCount() });
    },
  });
}

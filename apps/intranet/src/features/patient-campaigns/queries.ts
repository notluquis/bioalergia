import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { patientCampaignsORPCClient, toPatientCampaignsApiError } from "./orpc";
import type {
  PatientCampaignRecipient,
  PatientCampaignRecipientStatus,
  PatientCampaignRecipientWithCampaign,
  PatientCampaignWithCounts,
} from "./types";

export const patientCampaignsKeys = {
  all: ["patient-campaigns"] as const,
  lists: () => [...patientCampaignsKeys.all, "list"] as const,
  list: (params?: { includeInactive?: boolean }) =>
    [...patientCampaignsKeys.lists(), params ?? {}] as const,
  details: () => [...patientCampaignsKeys.all, "detail"] as const,
  detail: (id: number) => [...patientCampaignsKeys.details(), id] as const,
  recipients: () => [...patientCampaignsKeys.all, "recipients"] as const,
  recipientsByCampaign: (
    campaignId: number,
    filters?: { status?: PatientCampaignRecipientStatus; query?: string }
  ) => [...patientCampaignsKeys.recipients(), "campaign", campaignId, filters ?? {}] as const,
  recipientsByPatient: (patientRut: string) =>
    [...patientCampaignsKeys.recipients(), "patient", patientRut] as const,
};

export async function fetchPatientCampaigns(params?: {
  includeInactive?: boolean;
}): Promise<PatientCampaignWithCounts[]> {
  try {
    const result = await patientCampaignsORPCClient.listCampaigns(params ?? {});
    return result.campaigns;
  } catch (error) {
    throw toPatientCampaignsApiError(error);
  }
}

export async function fetchPatientCampaign(id: number): Promise<PatientCampaignWithCounts> {
  try {
    const result = await patientCampaignsORPCClient.getCampaign({ id });
    return result.campaign;
  } catch (error) {
    throw toPatientCampaignsApiError(error);
  }
}

export async function fetchCampaignRecipients(params: {
  campaignId: number;
  status?: PatientCampaignRecipientStatus;
  query?: string;
}): Promise<PatientCampaignRecipient[]> {
  try {
    const result = await patientCampaignsORPCClient.listRecipients(params);
    return result.recipients;
  } catch (error) {
    throw toPatientCampaignsApiError(error);
  }
}

export async function fetchRecipientsByPatient(
  patientRut: string
): Promise<PatientCampaignRecipientWithCampaign[]> {
  try {
    const result = await patientCampaignsORPCClient.listByPatient({ patientRut });
    return result.recipients;
  } catch (error) {
    throw toPatientCampaignsApiError(error);
  }
}

export function usePatientCampaigns(params?: { includeInactive?: boolean }) {
  return useQuery({
    queryKey: patientCampaignsKeys.list(params),
    queryFn: () => fetchPatientCampaigns(params),
  });
}

export function usePatientCampaign(id: number | undefined) {
  return useQuery({
    enabled: typeof id === "number" && id > 0,
    queryKey:
      typeof id === "number"
        ? patientCampaignsKeys.detail(id)
        : ["patient-campaigns", "detail", "disabled"],
    queryFn: () => fetchPatientCampaign(id as number),
  });
}

export function useCampaignRecipients(
  campaignId: number | undefined,
  filters?: { status?: PatientCampaignRecipientStatus; query?: string }
) {
  return useQuery({
    enabled: typeof campaignId === "number" && campaignId > 0,
    queryKey:
      typeof campaignId === "number"
        ? patientCampaignsKeys.recipientsByCampaign(campaignId, filters)
        : ["patient-campaigns", "recipients", "disabled"],
    queryFn: () =>
      fetchCampaignRecipients({
        campaignId: campaignId as number,
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.query ? { query: filters.query } : {}),
      }),
  });
}

export function usePatientCampaignsByPatient(patientRut: string | undefined) {
  return useQuery({
    enabled: !!patientRut,
    queryKey: patientRut
      ? patientCampaignsKeys.recipientsByPatient(patientRut)
      : ["patient-campaigns", "recipients", "patient", "disabled"],
    queryFn: () => fetchRecipientsByPatient(patientRut as string),
  });
}

export function useCreatePatientCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      description?: string;
      messageTemplate?: string;
      imageUrl?: string;
      isActive?: boolean;
    }) => {
      try {
        const result = await patientCampaignsORPCClient.createCampaign(input);
        return result.campaign;
      } catch (error) {
        throw toPatientCampaignsApiError(error);
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: patientCampaignsKeys.lists() });
    },
  });
}

export function useUpdatePatientCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: number;
      name?: string;
      description?: string | null;
      messageTemplate?: string | null;
      imageUrl?: string | null;
      isActive?: boolean;
    }) => {
      try {
        const result = await patientCampaignsORPCClient.updateCampaign(input);
        return result.campaign;
      } catch (error) {
        throw toPatientCampaignsApiError(error);
      }
    },
    onSuccess: (campaign) => {
      void qc.invalidateQueries({ queryKey: patientCampaignsKeys.lists() });
      void qc.invalidateQueries({ queryKey: patientCampaignsKeys.detail(campaign.id) });
    },
  });
}

export function useDeletePatientCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      try {
        await patientCampaignsORPCClient.deleteCampaign({ id });
        return id;
      } catch (error) {
        throw toPatientCampaignsApiError(error);
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: patientCampaignsKeys.all });
    },
  });
}

export function useUpsertCampaignRecipient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      campaignId: number;
      patientRut: string;
      patientName?: string;
      patientPhone?: string;
      status?: PatientCampaignRecipientStatus;
      notes?: string;
    }) => {
      try {
        const result = await patientCampaignsORPCClient.upsertRecipient(input);
        return result.recipient;
      } catch (error) {
        throw toPatientCampaignsApiError(error);
      }
    },
    onSuccess: (recipient) => {
      void qc.invalidateQueries({ queryKey: patientCampaignsKeys.lists() });
      void qc.invalidateQueries({ queryKey: patientCampaignsKeys.detail(recipient.campaignId) });
      void qc.invalidateQueries({ queryKey: patientCampaignsKeys.recipients() });
    },
  });
}

export function useUpdateRecipientStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: number;
      status: PatientCampaignRecipientStatus;
      notes?: string;
    }) => {
      try {
        const result = await patientCampaignsORPCClient.updateRecipientStatus(input);
        return result.recipient;
      } catch (error) {
        throw toPatientCampaignsApiError(error);
      }
    },
    onSuccess: (recipient) => {
      void qc.invalidateQueries({ queryKey: patientCampaignsKeys.lists() });
      void qc.invalidateQueries({ queryKey: patientCampaignsKeys.detail(recipient.campaignId) });
      void qc.invalidateQueries({ queryKey: patientCampaignsKeys.recipients() });
    },
  });
}

export function useDeleteCampaignRecipient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      try {
        await patientCampaignsORPCClient.deleteRecipient({ id });
        return id;
      } catch (error) {
        throw toPatientCampaignsApiError(error);
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: patientCampaignsKeys.all });
    },
  });
}

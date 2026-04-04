import { toWhatsappApiError, whatsappORPCClient } from "@/features/whatsapp/orpc";

export async function fetchDoctoraliaPipelineOverview() {
  try {
    return await whatsappORPCClient.getOverview({});
  } catch (error) {
    throw toWhatsappApiError(error);
  }
}

export async function fetchDoctoraliaDispatchNotifications(params: {
  limit?: number;
  offset?: number;
  status?: "PENDING" | "SENT" | "FAILED" | "DELIVERED" | "READ";
}) {
  try {
    return await whatsappORPCClient.listNotifications(params);
  } catch (error) {
    throw toWhatsappApiError(error);
  }
}

export async function fetchDoctoraliaDispatchStats() {
  try {
    return await whatsappORPCClient.getStats({});
  } catch (error) {
    throw toWhatsappApiError(error);
  }
}

export async function triggerDoctoraliaEmailPoll() {
  try {
    return await whatsappORPCClient.triggerPoll({});
  } catch (error) {
    throw toWhatsappApiError(error);
  }
}

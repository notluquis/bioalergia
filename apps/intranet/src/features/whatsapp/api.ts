import { toWhatsappApiError, whatsappORPCClient } from "./orpc";

export async function fetchWhatsappNotifications(params: {
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

export async function fetchWhatsappStats() {
  try {
    return await whatsappORPCClient.getStats({});
  } catch (error) {
    throw toWhatsappApiError(error);
  }
}

export async function sendWhatsappTest(phone: string) {
  try {
    return await whatsappORPCClient.testSend({ phone });
  } catch (error) {
    throw toWhatsappApiError(error);
  }
}

export async function triggerWhatsappPoll() {
  try {
    return await whatsappORPCClient.triggerPoll({});
  } catch (error) {
    throw toWhatsappApiError(error);
  }
}

import { db } from "@finanzas/db";
import { getAccountForPhoneNumber, graphGet, graphPost } from "./_http.ts";

export async function getPhoneHealth(phoneNumberId: number) {
  const phone = await getAccountForPhoneNumber(phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = phone.account.systemUserToken!;
  type Resp = {
    id: string;
    display_phone_number?: string;
    verified_name?: string;
    code_verification_status?: string;
    quality_rating?: string;
    name_status?: string;
    messaging_limit_tier?: string;
    platform_type?: string;
    throughput?: { level?: string };
    health_status?: { can_send_message?: string; entities?: unknown[] };
  };
  const fields =
    "display_phone_number,verified_name,code_verification_status,quality_rating,name_status,messaging_limit_tier,platform_type,throughput,health_status";
  return graphGet<Resp>(`/${phone.phoneNumberId}?fields=${fields}`, token, v);
}

export async function registerPhoneNumber(phoneNumberId: number, pin: string) {
  const phone = await getAccountForPhoneNumber(phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = phone.account.systemUserToken!;
  return graphPost(
    `/${phone.phoneNumberId}/register`,
    { messaging_product: "whatsapp", pin },
    token,
    v,
  );
}

export async function deregisterPhoneNumber(phoneNumberId: number) {
  const phone = await getAccountForPhoneNumber(phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = phone.account.systemUserToken!;
  return graphPost(`/${phone.phoneNumberId}/deregister`, {}, token, v);
}

export async function setTwoStepPin(phoneNumberId: number, pin: string) {
  const phone = await getAccountForPhoneNumber(phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = phone.account.systemUserToken!;
  return graphPost(`/${phone.phoneNumberId}`, { pin }, token, v);
}

export async function listAccountPhoneNumbers(accountId: number) {
  const account = await db.waBusinessAccount.findUnique({ where: { id: accountId } });
  if (!account?.systemUserToken) throw new Error("Account sin token");
  type PhoneApi = {
    id: string;
    display_phone_number: string;
    verified_name: string;
    quality_rating?: string;
  };
  const data = await graphGet<{ data: PhoneApi[] }>(
    `/${account.wabaId}/phone_numbers`,
    account.systemUserToken,
    account.graphApiVersion,
  );
  return data.data;
}

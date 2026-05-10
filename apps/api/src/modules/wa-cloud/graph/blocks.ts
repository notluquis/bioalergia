import { getAccountForPhoneNumber, graphDelete, graphGet, graphPost } from "./_http.ts";

export async function blockUsers(phoneNumberId: number, e164List: string[]) {
  const phone = await getAccountForPhoneNumber(phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = phone.account.systemUserToken!;
  return graphPost(
    `/${phone.phoneNumberId}/block_users`,
    {
      messaging_product: "whatsapp",
      block_users: e164List.map((u) => ({ user: u.replace(/^\+/, "") })),
    },
    token,
    v,
  );
}

export async function unblockUsers(phoneNumberId: number, e164List: string[]) {
  const phone = await getAccountForPhoneNumber(phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = phone.account.systemUserToken!;
  return graphDelete(
    `/${phone.phoneNumberId}/block_users`,
    {
      messaging_product: "whatsapp",
      block_users: e164List.map((u) => ({ user: u.replace(/^\+/, "") })),
    },
    token,
    v,
  );
}

export async function listBlockedUsers(phoneNumberId: number) {
  const phone = await getAccountForPhoneNumber(phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = phone.account.systemUserToken!;
  type Resp = { data: Array<{ wa_id?: string; input?: string }> };
  return graphGet<Resp>(`/${phone.phoneNumberId}/block_users`, token, v);
}

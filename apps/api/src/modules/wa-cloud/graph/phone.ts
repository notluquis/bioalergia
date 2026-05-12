import { getAccountForPhoneNumber, graphGet, graphPost, loadAccount } from "./_http.ts";

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
    v
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

// Number migration between WABAs (Meta 2026):
//  - request_code: Meta sends an OTP to the SIM via SMS or VOICE
//  - verify_code: confirm migration once the operator reads the OTP
// Both operate on the new WABA's phoneNumberId — the source WABA must
// have already deregistered the number first.
export async function requestPhoneVerificationCode(
  phoneNumberId: number,
  codeMethod: "SMS" | "VOICE",
  language: string
) {
  const phone = await getAccountForPhoneNumber(phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = phone.account.systemUserToken!;
  return graphPost(
    `/${phone.phoneNumberId}/request_code`,
    { code_method: codeMethod, language },
    token,
    v
  );
}

export async function verifyPhoneCode(phoneNumberId: number, code: string) {
  const phone = await getAccountForPhoneNumber(phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = phone.account.systemUserToken!;
  return graphPost(`/${phone.phoneNumberId}/verify_code`, { code }, token, v);
}

// Migration step 1 (Meta 2026): provision a new phone slot on the
// destination WABA with `migrate_phone_number: true`. Source WABA
// must be under the same Meta Business Manager and have had 2FA
// disabled on the number. Returns the new phoneNumberId so the
// operator (or our request_code → verify_code → register chain) can
// take it from here.
//
// Refs:
//   - https://developers.facebook.com/docs/whatsapp/cloud-api
//     /reference/phone-numbers
//   - https://respond.io/help/whatsapp/phone-number-migration-to-whatsapp-cloud-api
export async function addMigratingPhoneNumber(
  accountId: number,
  countryCode: string,
  phoneNumber: string,
  migrate: boolean,
) {
  const account = await loadAccount(accountId);
  if (!account?.systemUserToken) throw new Error("Account sin token");
  return graphPost<{ id: string }>(
    `/${account.wabaId}/phone_numbers`,
    {
      cc: countryCode,
      phone_number: phoneNumber,
      migrate_phone_number: migrate,
    },
    account.systemUserToken,
    account.graphApiVersion,
  );
}

export async function listAccountPhoneNumbers(accountId: number) {
  const account = await loadAccount(accountId);
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
    account.graphApiVersion
  );
  return data.data;
}

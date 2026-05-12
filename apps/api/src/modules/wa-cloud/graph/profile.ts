import { getAccountForPhoneNumber, graphGet, graphPost } from "./_http.ts";

export type BusinessProfileFields = {
  about?: string;
  address?: string;
  description?: string;
  email?: string;
  vertical?:
    | "AUTO"
    | "BEAUTY"
    | "APPAREL"
    | "EDU"
    | "ENTERTAIN"
    | "EVENT_PLAN"
    | "FINANCE"
    | "GROCERY"
    | "GOVT"
    | "HOTEL"
    | "HEALTH"
    | "NONPROFIT"
    | "PROF_SERVICES"
    | "RETAIL"
    | "TRAVEL"
    | "RESTAURANT"
    | "NOT_A_BIZ"
    | "OTHER";
  websites?: string[];
  profile_picture_handle?: string;
  profile_picture_url?: never;
};

export async function getBusinessProfile(phoneNumberId: number) {
  const phone = await getAccountForPhoneNumber(phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = phone.account.systemUserToken!;
  type Resp = {
    data: Array<{
      about?: string;
      address?: string;
      description?: string;
      email?: string;
      messaging_product?: string;
      profile_picture_url?: string;
      vertical?: string;
      websites?: string[];
    }>;
  };
  const fields = "about,address,description,email,profile_picture_url,vertical,websites";
  const data = await graphGet<Resp>(
    `/${phone.phoneNumberId}/whatsapp_business_profile?fields=${fields}`,
    token,
    v
  );
  return data.data[0] ?? null;
}

export async function updateBusinessProfile(phoneNumberId: number, fields: BusinessProfileFields) {
  const phone = await getAccountForPhoneNumber(phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = phone.account.systemUserToken!;
  return graphPost(
    `/${phone.phoneNumberId}/whatsapp_business_profile`,
    { messaging_product: "whatsapp", ...fields },
    token,
    v
  );
}

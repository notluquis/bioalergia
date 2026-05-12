import { graphGet, loadAccount } from "./_http.ts";

export type ConversationAnalyticsParams = {
  accountId: number;
  startUnix: number;
  endUnix: number;
  granularity?: "HALF_HOUR" | "DAILY" | "MONTHLY";
  phoneNumbers?: string[];
  // When true, also request the pricing_analytics field with cost breakdown.
  includePricing?: boolean;
};

export async function getConversationAnalytics(params: ConversationAnalyticsParams) {
  const account = await loadAccount(params.accountId);
  if (!account?.systemUserToken) throw new Error("Account sin token");
  const granularity = params.granularity ?? "DAILY";

  // Each Meta field accepts a different dimension set:
  //  conversation_analytics → PHONE, COUNTRY, CONVERSATION_TYPE,
  //                           CONVERSATION_DIRECTION, CONVERSATION_CATEGORY
  //  pricing_analytics      → PHONE, COUNTRY, PRICING_TYPE,
  //                           PRICING_CATEGORY, TIER
  const convDims =
    '["PHONE","COUNTRY","CONVERSATION_TYPE","CONVERSATION_DIRECTION","CONVERSATION_CATEGORY"]';
  let convField = `conversation_analytics.start(${params.startUnix}).end(${params.endUnix}).granularity(${granularity}).dimensions(${convDims})`;
  if (params.phoneNumbers && params.phoneNumbers.length > 0) {
    convField += `.phone_numbers(${JSON.stringify(params.phoneNumbers)})`;
  }

  const fields: string[] = [convField];
  if (params.includePricing) {
    const pricingDims = '["PHONE","COUNTRY","PRICING_TYPE","PRICING_CATEGORY","TIER"]';
    fields.push(
      `pricing_analytics.start(${params.startUnix}).end(${params.endUnix}).granularity(DAILY).dimensions(${pricingDims})`
    );
  }

  const path = `/${account.wabaId}?fields=${fields.join(",")}`;
  type Resp = {
    conversation_analytics?: {
      data: Array<{
        data_points: Array<{
          start: number;
          end: number;
          conversation: number;
          phone_number?: string;
          country?: string;
          conversation_type?: string;
          conversation_direction?: string;
          conversation_category?: string;
          cost?: number;
        }>;
      }>;
    };
    pricing_analytics?: {
      data: Array<{
        data_points: Array<{
          start: number;
          end: number;
          volume: number;
          cost?: number;
          pricing_category?: string;
          country?: string;
          phone_number?: string;
          pricing_type?: string;
          tier?: string;
        }>;
      }>;
    };
  };
  return graphGet<Resp>(path, account.systemUserToken, account.graphApiVersion);
}

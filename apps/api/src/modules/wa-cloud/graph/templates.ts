import { db } from "@finanzas/db";
import { graphDelete, graphGet, graphPost } from "./_http.ts";

export type CreateTemplateInput = {
  accountId: number;
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  components: unknown[];
};

export async function createTemplate(input: CreateTemplateInput) {
  const account = await db.waBusinessAccount.findUnique({ where: { id: input.accountId } });
  if (!account?.systemUserToken) throw new Error("Account sin token");
  const v = account.graphApiVersion;
  const token = account.systemUserToken;
  return graphPost<{ id: string; status: string; category: string }>(
    `/${account.wabaId}/message_templates`,
    {
      name: input.name,
      language: input.language,
      category: input.category,
      components: input.components,
    },
    token,
    v,
  );
}

export async function deleteTemplate(accountId: number, name: string, hsmId?: string) {
  const account = await db.waBusinessAccount.findUnique({ where: { id: accountId } });
  if (!account?.systemUserToken) throw new Error("Account sin token");
  const v = account.graphApiVersion;
  const qs = new URLSearchParams({ name });
  if (hsmId) qs.set("hsm_id", hsmId);
  return graphDelete(
    `/${account.wabaId}/message_templates?${qs.toString()}`,
    {},
    account.systemUserToken,
    v,
  );
}

export async function listAccountTemplates(accountId: number) {
  const account = await db.waBusinessAccount.findUnique({ where: { id: accountId } });
  if (!account?.systemUserToken) throw new Error("Account sin token");
  type TemplateApi = {
    id: string;
    name: string;
    language: string;
    status: string;
    category: string;
    components: unknown[];
    quality_score?: { score?: string };
  };
  const data = await graphGet<{ data: TemplateApi[] }>(
    `/${account.wabaId}/message_templates?fields=id,name,language,status,category,components,quality_score&limit=200`,
    account.systemUserToken,
    account.graphApiVersion,
  );
  return data.data;
}

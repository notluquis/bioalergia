import { db } from "@finanzas/db";
import { graphGet } from "./_http.ts";

export async function listAccountFlows(accountId: number) {
  const account = await db.waBusinessAccount.findUnique({ where: { id: accountId } });
  if (!account?.systemUserToken) throw new Error("Account sin token");
  type FlowApi = {
    id: string;
    name: string;
    status: string;
    categories?: string[];
    validation_errors?: Array<{ error: string; error_type: string; message: string }>;
    health?: { can_send_message?: string; entities?: unknown[] };
    application?: { id: string; name?: string };
  };
  const fields = "id,name,status,categories,validation_errors,health,application";
  const data = await graphGet<{ data: FlowApi[] }>(
    `/${account.wabaId}/flows?fields=${fields}&limit=200`,
    account.systemUserToken,
    account.graphApiVersion,
  );
  return data.data;
}

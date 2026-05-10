import { db } from "@finanzas/db";
import { logWarn } from "../../../lib/logger.ts";

export const GRAPH_BASE = "https://graph.facebook.com";

export async function getAccountForPhoneNumber(phoneNumberId: number) {
  const phone = await db.waPhoneNumber.findUnique({
    where: { id: phoneNumberId },
    include: { account: true },
  });
  if (!phone) throw new Error(`WaPhoneNumber ${phoneNumberId} no existe`);
  if (!phone.account.systemUserToken) {
    throw new Error("WaBusinessAccount sin systemUserToken — configura en Settings");
  }
  return phone;
}

export async function graphPost<T>(
  path: string,
  body: unknown,
  token: string,
  version: string,
): Promise<T> {
  const res = await fetch(`${GRAPH_BASE}/${version}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    logWarn("[wa-cloud.graph] POST failed", { path, status: res.status, body: text.slice(0, 500) });
    throw new Error(`Graph API ${res.status}: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as T;
}

export async function graphGet<T>(path: string, token: string, version: string): Promise<T> {
  const res = await fetch(`${GRAPH_BASE}/${version}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  if (!res.ok) {
    logWarn("[wa-cloud.graph] GET failed", { path, status: res.status, body: text.slice(0, 500) });
    throw new Error(`Graph API ${res.status}: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as T;
}

export async function graphDelete<T>(
  path: string,
  body: unknown,
  token: string,
  version: string,
): Promise<T> {
  const res = await fetch(`${GRAPH_BASE}/${version}${path}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    logWarn("[wa-cloud.graph] DELETE failed", {
      path,
      status: res.status,
      body: text.slice(0, 500),
    });
    throw new Error(`Graph API ${res.status}: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as T;
}

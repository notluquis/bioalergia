// Fetch wrapper para la API MercadoLibre. Auto-refresh on 401.
//
// La lib oficial JS de ML está abandonada — fetch directo basta.

import { getActiveAccessToken } from "./auth.ts";

const ML_API = "https://api.mercadolibre.com";

type RequestOpts = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
};

async function callOnce(opts: RequestOpts, accessToken: string): Promise<Response> {
  const url = new URL(`${ML_API}${opts.path}`);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  return await fetch(url.toString(), {
    method: opts.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
}

export async function mlRequest<T>(opts: RequestOpts): Promise<T> {
  const tok = await getActiveAccessToken();
  if (!tok) {
    throw new Error("[ml-client] no hay cuenta ML conectada");
  }
  let res = await callOnce(opts, tok.accessToken);
  if (res.status === 401) {
    // Force refresh: invalidamos el token y reintento una vez.
    const fresh = await getActiveAccessToken();
    if (fresh) {
      res = await callOnce(opts, fresh.accessToken);
    }
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[ml-client] ${opts.method ?? "GET"} ${opts.path} → ${res.status}: ${body}`);
  }
  return (await res.json()) as T;
}

// ---- High-level helpers ---------------------------------------------------

export type MlCategoryPrediction = {
  domain_id: string;
  category_id: string;
  category_name: string;
  attributes?: Array<{ id: string; name: string; value_name?: string }>;
};

export async function predictCategory(title: string): Promise<MlCategoryPrediction | null> {
  try {
    return await mlRequest<MlCategoryPrediction>({
      path: "/sites/MLC/domain_discovery/search",
      query: { q: title, limit: 1 },
    }).then((r) => (Array.isArray(r) ? (r[0] ?? null) : r));
  } catch {
    return null;
  }
}

export type MlItemCreatePayload = {
  title: string;
  category_id: string;
  price: number;
  currency_id: "CLP";
  available_quantity: number;
  buying_mode: "buy_it_now";
  condition: "new" | "used";
  listing_type_id: string;
  description?: { plain_text: string };
  pictures?: Array<{ source: string }>;
  attributes?: Array<{ id: string; value_name?: string; value_id?: string }>;
  sale_terms?: Array<{ id: string; value_name: string }>;
  seller_custom_field?: string;
};

export type MlItemResponse = {
  id: string;
  permalink: string;
  status: string;
  category_id: string;
  listing_type_id: string;
};

export async function createMlItem(payload: MlItemCreatePayload): Promise<MlItemResponse> {
  return await mlRequest<MlItemResponse>({
    method: "POST",
    path: "/items",
    body: payload,
  });
}

export async function updateMlItem(
  mlItemId: string,
  patch: Partial<{ price: number; available_quantity: number; status: string }>
): Promise<MlItemResponse> {
  return await mlRequest<MlItemResponse>({
    method: "PUT",
    path: `/items/${mlItemId}`,
    body: patch,
  });
}

export async function pauseMlItem(mlItemId: string): Promise<void> {
  await updateMlItem(mlItemId, { status: "paused" });
}

export async function closeMlItem(mlItemId: string): Promise<void> {
  await updateMlItem(mlItemId, { status: "closed" });
}

export type MlOrder = {
  id: number;
  status: string;
  total_amount: number;
  currency_id: string;
  buyer: { id: number; nickname: string; email?: string; first_name?: string; last_name?: string };
  order_items: Array<{
    item: { id: string; title: string; seller_sku?: string };
    quantity: number;
    unit_price: number;
  }>;
  shipping?: { id?: number };
  date_created: string;
};

export async function getMlOrder(orderId: string | number): Promise<MlOrder> {
  return await mlRequest<MlOrder>({ path: `/orders/${orderId}` });
}

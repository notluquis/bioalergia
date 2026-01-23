export const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || "";
export const MP_WEBHOOK_PASSWORD = process.env.MP_WEBHOOK_PASSWORD || "";

export const MP_API = {
  RELEASE: "https://api.mercadopago.com/v1/account/release_report",
  SETTLEMENT: "https://api.mercadopago.com/v1/account/settlement_report",
};

// Check MP configured
export function checkMpConfig() {
  if (!MP_ACCESS_TOKEN) {
    throw new Error("MP_ACCESS_TOKEN not configured");
  }
}

// Generic fetcher for both report types
export async function mpFetch(endpoint: string, baseUrl: string, options: RequestInit = {}) {
  checkMpConfig();
  const url = endpoint ? `${baseUrl}${endpoint}` : baseUrl;

  console.log(`[MP API] Request: ${options.method || "GET"} ${url}`);

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[MP API] Error Response: ${res.status} - ${text}`);
    throw new Error(`MP API error: ${res.status} - ${text}`);
  }

  console.log(`[MP API] Success Response: ${res.status}`);
  return res;
}

// Helper to safely parse MP response (handles 204 No Content)
export async function safeMpJson(res: Response) {
  if (res.status === 204) {
    return { status: "success", message: "Operation completed successfully" };
  }
  const text = await res.text();
  if (!text) {
    return { status: "success", message: "Operation completed successfully" };
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Failed to parse MP response: ${text.substring(0, 100)}...`);
  }
}

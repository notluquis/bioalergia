export const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || "";
export const MP_WEBHOOK_PASSWORD = process.env.MP_WEBHOOK_PASSWORD || "";

export const MP_API = {
  RELEASE: "https://api.mercadopago.com/v1/account/release_report",
  SETTLEMENT: "https://api.mercadopago.com/v1/account/settlement_report",
};

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1_000;

export function checkMpConfig() {
  if (!MP_ACCESS_TOKEN) {
    throw new Error("MP_ACCESS_TOKEN not configured");
  }
}

export function redactMpUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.searchParams.has("access_token")) {
      u.searchParams.set("access_token", "REDACTED");
    }
    return u.toString();
  } catch {
    return url;
  }
}

export async function mpFetch(
  endpoint: string,
  baseUrl: string,
  options: RequestInit & { log?: boolean; timeoutMs?: number; retries?: number } = {}
) {
  checkMpConfig();
  const url = endpoint ? `${baseUrl}${endpoint}` : baseUrl;
  const shouldLog = options.log ?? true;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = options.retries ?? MAX_RETRIES;

  const safeUrl = redactMpUrl(url);
  if (shouldLog) {
    console.log(`[MP API] Request: ${options.method || "GET"} ${safeUrl}`);
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });
      clearTimeout(timer);

      if (res.ok) {
        if (shouldLog) {
          console.log(`[MP API] Success Response: ${res.status}`);
        }
        return res;
      }

      const text = await res.text();
      if (shouldLog) {
        console.error(`[MP API] Error Response: ${res.status} - ${text}`);
      }

      // Retry only on 5xx and 429
      if ((res.status >= 500 || res.status === 429) && attempt < maxRetries) {
        await sleep(backoffDelay(attempt));
        continue;
      }
      throw new Error(`MP API error: ${res.status} - ${text}`);
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      const isAbort = err instanceof Error && err.name === "AbortError";
      const isNetwork = err instanceof TypeError; // fetch network failure
      const isHttpError = err instanceof Error && err.message.startsWith("MP API error:");

      if (isHttpError) {
        // Already wrapped above; non-retryable status reached this branch
        throw err;
      }

      if ((isAbort || isNetwork) && attempt < maxRetries) {
        if (shouldLog) {
          console.error(
            `[MP API] Transient error (attempt ${attempt + 1}/${maxRetries + 1}):`,
            err
          );
        }
        await sleep(backoffDelay(attempt));
        continue;
      }
      throw err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("MP API request failed");
}

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

function backoffDelay(attempt: number): number {
  return BASE_BACKOFF_MS * 2 ** attempt + Math.floor(Math.random() * 200);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

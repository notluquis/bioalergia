// Shared fetch wrapper for oRPC clients. Reads csrf_token from
// document.cookie and mirrors it into the X-CSRF-Token header so the
// server's csrf-double-submit middleware accepts the request.
//
// On the very first request after a cold load there is no cookie yet —
// the server issues it in the response. We auto-retry once after a 403
// to cover that bootstrap case without surfacing the CSRF dance to UI.
function readCsrfCookie(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|; )csrf_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]!) : null;
}

async function doFetch(
  request: RequestInfo | URL,
  init: RequestInit | undefined,
): Promise<Response> {
  const csrf = readCsrfCookie();
  const headers = new Headers(init?.headers);
  if (csrf) headers.set("X-CSRF-Token", csrf);
  return fetch(request, { ...init, headers, credentials: "include" });
}

export async function csrfFetch(
  request: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const cookieBefore = readCsrfCookie();
  const first = await doFetch(request, init);
  if (first.status !== 403) return first;
  // Only retry when the first call went out without a cookie — server
  // issues one in the 403 Set-Cookie header so a single retry succeeds.
  // Avoids masking legitimate 403s (auth denied) with a redundant call.
  if (cookieBefore) return first;
  const cookieNow = readCsrfCookie();
  if (!cookieNow) return first;
  return doFetch(request, init);
}

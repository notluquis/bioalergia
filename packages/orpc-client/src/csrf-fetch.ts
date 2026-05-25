// CSRF double-submit fetch wrapper. Reads csrf_token cookie and mirrors
// it into X-CSRF-Token so the api's csrf-double-submit middleware
// accepts the request. Auto-retries once after a cold-start 403 when
// the api just issued the cookie.

export function readCsrfCookie(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|; )csrf_token=([^;]+)/);
  return m ? decodeURIComponent(m[1] as string) : null;
}

export async function csrfFetch(request: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const cookieBefore = readCsrfCookie();
  const first = await doFetch(request, init);
  if (first.status !== 403) return first;
  if (cookieBefore) return first;
  const cookieNow = readCsrfCookie();
  if (!cookieNow) return first;
  return doFetch(request, init);
}

async function doFetch(
  request: RequestInfo | URL,
  init: RequestInit | undefined
): Promise<Response> {
  const csrf = readCsrfCookie();
  const headers = new Headers(init?.headers);
  if (csrf) headers.set("X-CSRF-Token", csrf);
  return fetch(request, { ...init, headers, credentials: "include" });
}

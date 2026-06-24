// oxlint-disable typescript/no-non-null-assertion -- TODO(strict-null): refactor each `!` to invariant() or explicit guard. Tracked in repo-wide non-null cleanup.
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
  init: RequestInit | undefined
): Promise<Response> {
  const csrf = readCsrfCookie();
  const headers = new Headers(init?.headers);
  if (csrf) headers.set("X-CSRF-Token", csrf);
  return fetch(request, { ...init, headers, credentials: "include" });
}

export async function csrfFetch(request: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const cookieBefore = readCsrfCookie();
  const first = await doFetch(request, init);
  if (first.status !== 403) return first;
  // Only self-heal when the call went out WITHOUT a cookie — a 403 with a
  // cookie already present is a legitimate denial (auth/permission), not the
  // bootstrap case, so don't mask it with a retry.
  if (cookieBefore) return first;
  // Bootstrap: the cookie may not have landed yet (the mint in main.tsx is
  // fire-and-forget, so on a cold load the first oRPC POST can race ahead of
  // it — notably in Safari). Synchronously mint the csrf_token cookie, then
  // retry once. This removes the race entirely instead of hoping the cookie
  // appeared between the two reads.
  if (!readCsrfCookie()) {
    await fetch("/api/csrf", { credentials: "include" }).catch(() => undefined);
  }
  if (!readCsrfCookie()) return first;
  return doFetch(request, init);
}

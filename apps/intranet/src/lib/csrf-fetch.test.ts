/**
 * Tests for `csrfFetch` — mirrors csrf_token cookie into X-CSRF-Token header,
 * retries once after a 403 if no cookie was present and the server has now
 * issued one.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { csrfFetch } from "./csrf-fetch";

function setCookie(value: string | null) {
  if (value === null) {
    // Expire the cookie.
    document.cookie = "csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    return;
  }
  document.cookie = `csrf_token=${encodeURIComponent(value)}; path=/;`;
}

describe("csrfFetch", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    setCookie(null);
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    setCookie(null);
  });

  it("sends the X-CSRF-Token header when the cookie is present", async () => {
    setCookie("token-abc");
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 200 }));

    await csrfFetch("/api/x");

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("X-CSRF-Token")).toBe("token-abc");
    expect(init.credentials).toBe("include");
  });

  it("does not set the header when the cookie is missing", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 200 }));

    await csrfFetch("/api/x");

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.has("X-CSRF-Token")).toBe(false);
  });

  it("returns the first response immediately when status is not 403", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 200 }));
    const r = await csrfFetch("/api/x");
    expect(r.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("retries once when first response is 403 and the server issued a fresh cookie", async () => {
    fetchSpy.mockImplementationOnce(async () => {
      // Simulate the server setting a cookie on the 403 response.
      setCookie("new-token");
      return new Response(null, { status: 403 });
    });
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 200 }));

    const r = await csrfFetch("/api/x");
    expect(r.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const retryInit = fetchSpy.mock.calls[1]?.[1] as RequestInit;
    expect(new Headers(retryInit.headers).get("X-CSRF-Token")).toBe("new-token");
  });

  it("does NOT retry when a cookie was already present before the 403 (legitimate auth denial)", async () => {
    setCookie("had-it");
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 403 }));
    const r = await csrfFetch("/api/x");
    expect(r.status).toBe(403);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry when 403 returns and still no cookie is set", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 403 }));
    const r = await csrfFetch("/api/x");
    expect(r.status).toBe(403);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("forwards custom headers from init alongside CSRF token", async () => {
    setCookie("t");
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 200 }));
    await csrfFetch("/api/x", { headers: { "X-Custom": "yes" }, method: "POST" });
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("X-Custom")).toBe("yes");
    expect(headers.get("X-CSRF-Token")).toBe("t");
    expect(init.method).toBe("POST");
  });
});

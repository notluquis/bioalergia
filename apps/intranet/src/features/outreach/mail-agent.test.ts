/**
 * Tests for the local mail agent client. Covers:
 * - Storage configuration round-trip.
 * - sendOutreachEmailViaAgent: missing-token guard, success POST shape,
 *   trailing-slash URL normalization, error-body parsing.
 * - checkAgentHealth: missing-token returns false, network exception
 *   returns false, 200 response returns true.
 *
 * Golden 2026: module-boundary mocks only (global `fetch`), reset state
 * + storage in beforeEach, cover happy + error paths.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// jsdom 27+ ships without a built-in localStorage; install an in-memory
// polyfill before importing the module under test (same pattern used by
// `share-send-lock.test.ts`).
function installLocalStoragePolyfill() {
  const store = new Map<string, string>();
  const ls = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
  };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: ls,
  });
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: ls,
  });
}
installLocalStoragePolyfill();

const {
  checkAgentHealth,
  getLocalAgentToken,
  getLocalAgentUrl,
  sendOutreachEmailViaAgent,
  setLocalAgentConfig,
} = await import("./mail-agent");

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  globalThis.localStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("local-agent config storage", () => {
  it("setLocalAgentConfig persists url + token to localStorage", () => {
    setLocalAgentConfig("https://127.0.0.1:3333", "token-xyz");
    expect(getLocalAgentToken()).toBe("token-xyz");
    expect(getLocalAgentUrl()).toBe("https://127.0.0.1:3333");
  });

  it("getLocalAgentToken returns null when never configured", () => {
    expect(getLocalAgentToken()).toBeNull();
  });

  it("getLocalAgentUrl falls back to https://127.0.0.1:3333 default", () => {
    // jsdom defaults to http://localhost protocol so the default helper
    // would return the http variant — but only when no env var is set.
    const url = getLocalAgentUrl();
    expect(url).toMatch(/^https?:\/\/127\.0\.0\.1:3333$/);
  });
});

describe("sendOutreachEmailViaAgent", () => {
  const payload = {
    to: "destinatario@example.com",
    from: "info@bioalergia.cl",
    subject: "Saludo",
    html: "<p>hola</p>",
    text: "hola",
    replyTo: "info@bioalergia.cl",
  };

  it("throws when token is missing (no network call)", async () => {
    await expect(sendOutreachEmailViaAgent(payload)).rejects.toThrow(
      "Token del agente local no configurado"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs to <base>/send with token header and full body", async () => {
    setLocalAgentConfig("https://127.0.0.1:3333", "tok");
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));

    await sendOutreachEmailViaAgent(payload);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://127.0.0.1:3333/send");
    expect(init?.method).toBe("POST");
    const headers = init?.headers as Record<string, string>;
    expect(headers["X-Local-Agent-Token"]).toBe("tok");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init?.body as string)).toEqual(payload);
  });

  it("strips trailing slashes from the configured base URL", async () => {
    setLocalAgentConfig("https://127.0.0.1:3333///", "tok");
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));

    await sendOutreachEmailViaAgent(payload);
    expect(fetchMock.mock.calls[0]![0]).toBe("https://127.0.0.1:3333/send");
  });

  it("throws server-provided message on non-2xx JSON response", async () => {
    setLocalAgentConfig("https://127.0.0.1:3333", "tok");
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "SMTP rechazó destinatario" }), {
        status: 502,
      })
    );

    await expect(sendOutreachEmailViaAgent(payload)).rejects.toThrow("SMTP rechazó destinatario");
  });

  it("falls back to status code when error body is not JSON", async () => {
    setLocalAgentConfig("https://127.0.0.1:3333", "tok");
    fetchMock.mockResolvedValue(new Response("Internal Server Error", { status: 500 }));

    await expect(sendOutreachEmailViaAgent(payload)).rejects.toThrow("Agente respondió 500");
  });
});

describe("checkAgentHealth", () => {
  it("returns false without a configured token", async () => {
    await expect(checkAgentHealth()).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns true on 200 from /health/smtp", async () => {
    setLocalAgentConfig("https://127.0.0.1:3333", "tok");
    fetchMock.mockResolvedValue(new Response("ok", { status: 200 }));

    await expect(checkAgentHealth()).resolves.toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://127.0.0.1:3333/health/smtp");
    expect((init?.headers as Record<string, string>)["X-Local-Agent-Token"]).toBe("tok");
  });

  it("returns false on network failure", async () => {
    setLocalAgentConfig("https://127.0.0.1:3333", "tok");
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(checkAgentHealth()).resolves.toBe(false);
  });

  it("returns false on non-2xx response", async () => {
    setLocalAgentConfig("https://127.0.0.1:3333", "tok");
    fetchMock.mockResolvedValue(new Response("nope", { status: 503 }));
    await expect(checkAgentHealth()).resolves.toBe(false);
  });
});

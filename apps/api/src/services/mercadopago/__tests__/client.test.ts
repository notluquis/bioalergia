import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_TOKEN = process.env.MP_ACCESS_TOKEN;

describe("MercadoPago client", () => {
  beforeEach(() => {
    process.env.MP_ACCESS_TOKEN = "test-token-abc";
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.MP_ACCESS_TOKEN = ORIGINAL_TOKEN;
  });

  describe("redactMpUrl", () => {
    it("masks access_token query param", async () => {
      const { redactMpUrl } = await import("../client.ts");
      const out = redactMpUrl("https://api.mercadopago.com/v1/foo?access_token=secret123&other=ok");
      expect(out).toContain("access_token=REDACTED");
      expect(out).not.toContain("secret123");
      expect(out).toContain("other=ok");
    });

    it("returns url unchanged when no access_token param", async () => {
      const { redactMpUrl } = await import("../client.ts");
      const url = "https://api.mercadopago.com/v1/foo?bar=1";
      expect(redactMpUrl(url)).toBe(url);
    });

    it("returns input string for malformed URL", async () => {
      const { redactMpUrl } = await import("../client.ts");
      expect(redactMpUrl("not-a-url")).toBe("not-a-url");
    });
  });

  describe("checkMpConfig", () => {
    it("throws when MP_ACCESS_TOKEN is empty", async () => {
      process.env.MP_ACCESS_TOKEN = "";
      vi.resetModules();
      const { checkMpConfig } = await import("../client.ts");
      expect(() => checkMpConfig()).toThrow("MP_ACCESS_TOKEN not configured");
    });

    it("does not throw when token is set", async () => {
      const { checkMpConfig } = await import("../client.ts");
      expect(() => checkMpConfig()).not.toThrow();
    });
  });

  describe("mpFetch", () => {
    it("retries on 500 then succeeds", async () => {
      const { mpFetch } = await import("../client.ts");
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(new Response("err", { status: 500 }))
        .mockResolvedValueOnce(new Response("err", { status: 502 }))
        .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));

      const res = await mpFetch("/list", "https://api.test.com/r", {
        log: false,
        retries: 3,
      });
      expect(res.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it("retries on 429 (rate limit)", async () => {
      const { mpFetch } = await import("../client.ts");
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(new Response("rate", { status: 429 }))
        .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));

      await mpFetch("", "https://api.test.com/r", { log: false, retries: 2 });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("does NOT retry on 4xx (except 429)", async () => {
      const { mpFetch } = await import("../client.ts");
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockImplementation(async () => new Response("bad", { status: 400 }));

      await expect(
        mpFetch("", "https://api.test.com/r", { log: false, retries: 3 })
      ).rejects.toThrow(/MP API error: 400/);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("retries on network error (TypeError)", async () => {
      const { mpFetch } = await import("../client.ts");
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockRejectedValueOnce(new TypeError("network down"))
        .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));

      await mpFetch("", "https://api.test.com/r", { log: false, retries: 2 });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("sets Authorization Bearer header", async () => {
      const { mpFetch } = await import("../client.ts");
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockImplementation(async () => new Response("{}", { status: 200 }));

      await mpFetch("", "https://api.test.com/r", { log: false });
      const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
      const headers = init.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer test-token-abc");
    });

    it("gives up after maxRetries 5xx and throws", async () => {
      const { mpFetch } = await import("../client.ts");
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockImplementation(async () => new Response("err", { status: 503 }));

      await expect(
        mpFetch("", "https://api.test.com/r", { log: false, retries: 1 })
      ).rejects.toThrow(/MP API error: 503/);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("safeMpJson", () => {
    it("returns success object for 204", async () => {
      const { safeMpJson } = await import("../client.ts");
      const out = await safeMpJson(new Response(null, { status: 204 }));
      expect(out.status).toBe("success");
    });

    it("returns success object for empty body", async () => {
      const { safeMpJson } = await import("../client.ts");
      const out = await safeMpJson(new Response("", { status: 200 }));
      expect(out.status).toBe("success");
    });

    it("parses JSON body", async () => {
      const { safeMpJson } = await import("../client.ts");
      const out = await safeMpJson(new Response('{"foo":42}', { status: 200 }));
      expect(out).toEqual({ foo: 42 });
    });

    it("throws on invalid JSON", async () => {
      const { safeMpJson } = await import("../client.ts");
      await expect(
        safeMpJson(new Response("<html>no json</html>", { status: 200 }))
      ).rejects.toThrow(/Failed to parse MP response/);
    });
  });
});

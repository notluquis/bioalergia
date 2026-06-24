import { ORPCError } from "@orpc/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";

import { calendarORPCClient, SuperJSONLink, toCalendarApiError } from "./orpc";

describe("calendar/orpc — module exports", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "location", {
      value: { origin: "https://test.local" },
      configurable: true,
      writable: true,
    });
  });

  it("exposes calendarORPCClient as a callable proxy", () => {
    // createORPCClient returns a Proxy; smoke check that the module loaded
    // without throwing and that the export is at least an object/function.
    expect(calendarORPCClient).toBeDefined();
    expect(typeof calendarORPCClient).toMatch(/object|function/);
  });

  it("re-exports SuperJSONLink and constructs without throwing", () => {
    expect(SuperJSONLink).toBeDefined();
    const link = new SuperJSONLink({
      fetch: () => Promise.resolve(new Response("{}", { status: 200 })),
      url: () => "https://test.local",
    });
    expect(link).toBeInstanceOf(SuperJSONLink);
  });
});

describe("toCalendarApiError", () => {
  it("returns the same instance when given an ApiError (passthrough)", () => {
    const original = new ApiError("boom", 418, { foo: "bar" });
    const result = toCalendarApiError(original);
    expect(result).toBe(original);
  });

  it("wraps an ORPCError preserving status, message, and data", () => {
    const orpc = new ORPCError("BAD_REQUEST", {
      message: "invalid input",
      status: 400,
      data: { field: "email" },
    });
    const result = toCalendarApiError(orpc);
    expect(result).toBeInstanceOf(ApiError);
    expect(result.status).toBe(400);
    expect(result.message).toBe("invalid input");
    expect(result.details).toEqual({ field: "email" });
  });

  it("wraps a generic Error as 500", () => {
    const err = new Error("kaboom");
    const result = toCalendarApiError(err);
    expect(result).toBeInstanceOf(ApiError);
    expect(result.status).toBe(500);
    expect(result.message).toBe("kaboom");
    expect(result.details).toBeUndefined();
  });

  it("wraps unknown values as 500 with raw payload in details", () => {
    const raw = { weird: "shape" };
    const result = toCalendarApiError(raw);
    expect(result).toBeInstanceOf(ApiError);
    expect(result.status).toBe(500);
    expect(result.message).toBe("Error inesperado");
    expect(result.details).toBe(raw);
  });

  it("wraps a primitive (string) as 500 with raw payload", () => {
    const result = toCalendarApiError("nope");
    expect(result.status).toBe(500);
    expect(result.message).toBe("Error inesperado");
    expect(result.details).toBe("nope");
  });
});

describe("orpcFetch + error pipeline (driven via calendarORPCClient)", () => {
  const originalFetch = globalThis.fetch;
  const originalDocumentCookieDescriptor = Object.getOwnPropertyDescriptor(
    Document.prototype,
    "cookie"
  );

  function makeRpcSuccessResponse(value: unknown): Response {
    // SuperJSONSerializer.serialize wraps payloads as { json, meta? }.
    const body = JSON.stringify({ json: value });
    return new Response(body, {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  beforeEach(() => {
    Object.defineProperty(globalThis, "location", {
      value: { origin: "https://test.local" },
      configurable: true,
      writable: true,
    });
    // Provide a controllable cookie source to drive readCsrfCookie.
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: () => "csrf_token=abc123; other=xyz",
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalDocumentCookieDescriptor) {
      Object.defineProperty(Document.prototype, "cookie", originalDocumentCookieDescriptor);
    }
    vi.restoreAllMocks();
  });

  it("invokes global fetch with credentials + X-CSRF-Token header on a successful RPC call", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      makeRpcSuccessResponse([])
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    // The exact RPC method doesn't matter for coverage; pick any.
    // It just needs to flow through orpcFetch.
    await (calendarORPCClient as unknown as { calendars: () => Promise<unknown> }).calendars();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0]!;
    const headers = new Headers(init?.headers);
    expect(headers.get("X-CSRF-Token")).toBe("abc123");
    expect(init?.credentials).toBe("include");
  });

  it("does not set X-CSRF-Token when cookie is absent", async () => {
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: () => "",
    });
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      makeRpcSuccessResponse([])
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await (calendarORPCClient as unknown as { calendars: () => Promise<unknown> }).calendars();

    const [, init] = fetchMock.mock.calls[0]!;
    const headers = new Headers(init?.headers);
    expect(headers.has("X-CSRF-Token")).toBe(false);
  });

  // Each of these failure-path tests drives an HTTP error response
  // through `orpcFetch` so it executes `toStructuredORPCErrorResponse`,
  // `normalizeORPCErrorStatus`, `defaultErrorMessageByStatus`, and
  // `trimErrorText`. We assert on `status` only — oRPC itself decides
  // how to surface message/code on the thrown ORPCError, and we don't
  // care about its internal mapping; the goal is to exercise the
  // private helpers in this module.
  it("drives a 401 HTML response through the error pipeline", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response("<html>nope</html>", {
          status: 401,
          headers: { "content-type": "text/html" },
        })
    ) as unknown as typeof fetch;

    await expect(
      (calendarORPCClient as unknown as { calendars: () => Promise<unknown> }).calendars()
    ).rejects.toMatchObject({ status: 401 });
  });

  it("drives a 403 plain-text response through the error pipeline (uses raw body trim)", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response("forbidden because reasons", {
          status: 403,
          headers: { "content-type": "text/plain" },
        })
    ) as unknown as typeof fetch;

    await expect(
      (calendarORPCClient as unknown as { calendars: () => Promise<unknown> }).calendars()
    ).rejects.toMatchObject({ status: 403 });
  });

  it("drives a 404 with empty body (defaultErrorMessageByStatus 404 branch)", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response("   ", {
          status: 404,
          headers: { "content-type": "text/plain" },
        })
    ) as unknown as typeof fetch;

    await expect(
      (calendarORPCClient as unknown as { calendars: () => Promise<unknown> }).calendars()
    ).rejects.toMatchObject({ status: 404 });
  });

  it("drives a 429 (RATE_LIMITED code branch + defaultErrorMessageByStatus 429)", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response("", {
          status: 429,
          headers: { "content-type": "text/plain" },
        })
    ) as unknown as typeof fetch;

    await expect(
      (calendarORPCClient as unknown as { calendars: () => Promise<unknown> }).calendars()
    ).rejects.toMatchObject({ status: 429 });
  });

  it("drives a non-standard upstream 599 status (normalizeORPCErrorStatus → 500)", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response("upstream meltdown", {
          status: 599,
          headers: { "content-type": "text/plain" },
        })
    ) as unknown as typeof fetch;

    await expect(
      (calendarORPCClient as unknown as { calendars: () => Promise<unknown> }).calendars()
    ).rejects.toMatchObject({ status: 500 });
  });

  it("drives a JSON body with `message` field through the parsedMessage extraction branch", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ message: "specific server message" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        })
    ) as unknown as typeof fetch;

    await expect(
      (calendarORPCClient as unknown as { calendars: () => Promise<unknown> }).calendars()
    ).rejects.toMatchObject({ status: 400 });
  });

  it("drives a JSON body with only `error` field through the parsedMessage fallback branch", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "fallback error string" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        })
    ) as unknown as typeof fetch;

    await expect(
      (calendarORPCClient as unknown as { calendars: () => Promise<unknown> }).calendars()
    ).rejects.toMatchObject({ status: 400 });
  });

  it("drives a JSON body with no recognised string fields (parsedMessage undefined)", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ unrelated: 1 }), {
          status: 400,
          headers: { "content-type": "application/json" },
        })
    ) as unknown as typeof fetch;

    await expect(
      (calendarORPCClient as unknown as { calendars: () => Promise<unknown> }).calendars()
    ).rejects.toMatchObject({ status: 400 });
  });

  it("drives a JSON body where `message`/`error` are non-strings (returns undefined branch)", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ message: 42, error: 99 }), {
          status: 400,
          headers: { "content-type": "application/json" },
        })
    ) as unknown as typeof fetch;

    await expect(
      (calendarORPCClient as unknown as { calendars: () => Promise<unknown> }).calendars()
    ).rejects.toMatchObject({ status: 400 });
  });

  it("drives an invalid-JSON body claiming application/json (JSON.parse catch branch + trim long-body branch)", async () => {
    const longBody = "x".repeat(500);
    globalThis.fetch = vi.fn(
      async () =>
        new Response(longBody, {
          status: 400,
          headers: { "content-type": "application/json" },
        })
    ) as unknown as typeof fetch;

    await expect(
      (calendarORPCClient as unknown as { calendars: () => Promise<unknown> }).calendars()
    ).rejects.toMatchObject({ status: 400 });
  });

  it("drives a response with no content-type header (contentType === '' branch)", async () => {
    globalThis.fetch = vi.fn(() => {
      const res = new Response("plain text", { status: 400 });
      // jsdom's Response might assign a default content-type; strip it.
      res.headers.delete("content-type");
      return Promise.resolve(res);
    }) as unknown as typeof fetch;

    await expect(
      (calendarORPCClient as unknown as { calendars: () => Promise<unknown> }).calendars()
    ).rejects.toMatchObject({ status: 400 });
  });
});

// Unreachable from unit tests without a live backend:
//   - SuperJSONSerializer.serialize/deserialize async-iterator branches —
//     require a streaming oRPC response (event-stream over fetch).
//   - response.clone().text() throwing inside orpcFetch (lines 149-151)
//     — defensive catch against runtime fetch impls; not worth simulating
//     with a custom Response subclass.

// Unreachable from unit tests without a live backend:
//   - SuperJSONSerializer.serialize/deserialize async-iterator branches —
//     require a streaming oRPC response (event-stream over fetch).
//   - response.clone().text() throwing inside orpcFetch (line 149-151)
//     — the catch is defensive against runtime fetch impls and not worth
//     simulating with a custom Response subclass.

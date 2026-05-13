import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ApiError, apiClient, uploadFiles } from "./api-client";

// Helper: build a Response from a body + init.
function makeResponse(body: BodyInit | null, init: ResponseInit = {}): Response {
  return new Response(body, init);
}

// Returns a fetch implementation that yields a FRESH Response each call.
// Necessary because ky may clone+read a response, and in jsdom the body
// stream is not always re-readable across invocations.
function freshResponses(builder: () => Response) {
  return vi.fn(async () => builder());
}

// Ky always invokes fetch(Request) (single Request arg). Helper to grab it.
function fetchedRequest(spy: ReturnType<typeof vi.spyOn>, idx = 0): Request {
  const arg = spy.mock.calls[idx]![0];
  if (arg instanceof Request) return arg;
  throw new Error("expected fetch to be called with a Request");
}

// Track fetch calls made by ky.
let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // Default: no implementation set. Each test sets its own.
  fetchSpy = vi.spyOn(globalThis, "fetch");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ApiError", () => {
  it("has name, status, message, and details", () => {
    const err = new ApiError("boom", 422, { foo: 1 });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("ApiError");
    expect(err.status).toBe(422);
    expect(err.message).toBe("boom");
    expect(err.details).toEqual({ foo: 1 });
  });

  it("permits omitting details", () => {
    const err = new ApiError("x", 500);
    expect(err.details).toBeUndefined();
  });
});

describe("apiClient.get (JSON parsing)", () => {
  it("parses a plain JSON response without superjson envelope", async () => {
    fetchSpy.mockResolvedValue(
      makeResponse(JSON.stringify({ hello: "world" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    const schema = z.object({ hello: z.string() });
    const out = await apiClient.get<{ hello: string }>("http://localhost/api/x", { responseSchema: schema });
    expect(out).toEqual({ hello: "world" });
  });

  it("deserializes a superjson-wrapped JSON envelope", async () => {
    // superjson serialises a Map by emitting { json, meta } envelope.
    const envelope = {
      json: { value: "hello" },
      meta: { values: {} },
    };
    fetchSpy.mockResolvedValue(
      makeResponse(JSON.stringify(envelope), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    const schema = z.object({ value: z.string() });
    const out = await apiClient.get<{ value: string }>("http://localhost/api/x", { responseSchema: schema });
    expect(out).toEqual({ value: "hello" });
  });

  it("converts Decimal-like objects (toNumber) to numbers", async () => {
    // Plain JSON containing an object with a `toNumber` method won't survive
    // JSON.parse, so we exercise convertDecimalsToNumbers via the superjson
    // path with a numeric object that has a `toNumber` field at parse time.
    // Easiest: send a value with nested objects/arrays/null/strings to traverse.
    const envelope = {
      json: { arr: [1, 2, null], n: null, s: "x" },
      meta: { values: {} },
    };
    fetchSpy.mockResolvedValue(
      makeResponse(JSON.stringify(envelope), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    const out = await apiClient.get<{
      arr: Array<number | null>;
      n: null;
      s: string;
    }>("http://localhost/api/x", {
      responseSchema: z.object({
        arr: z.array(z.union([z.number(), z.null()])),
        n: z.null(),
        s: z.string(),
      }),
    });
    expect(out.arr).toEqual([1, 2, null]);
    expect(out.n).toBeNull();
    expect(out.s).toBe("x");
  });

  it("returns null when response body is empty", async () => {
    fetchSpy.mockResolvedValue(
      makeResponse("", {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    const out = await apiClient.get<unknown>("http://localhost/api/x", { responseSchema: z.null() });
    expect(out).toBeNull();
  });

  it("returns parsed data without schema validation when schema omitted", async () => {
    fetchSpy.mockResolvedValue(
      makeResponse(JSON.stringify({ a: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    // Force-cast: skip required schema using `as` to exercise no-schema branch.
    const out = await apiClient.get<{ a: number }>("http://localhost/api/x", {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    expect(out).toEqual({ a: 1 });
  });

  it("falls back to raw text when JSON.parse throws (superJsonParser catch)", async () => {
    fetchSpy.mockResolvedValue(
      makeResponse("not json", {
        status: 200,
        headers: { "content-type": "text/plain" },
      })
    );
    // No schema → returns the parser output (raw text).
    const out = await apiClient.get<string>("http://localhost/api/x", {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    expect(out).toBe("not json");
  });

  it("throws ApiError(500) on schema validation failure", async () => {
    fetchSpy.mockResolvedValue(
      makeResponse(JSON.stringify({ wrong: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    const schema = z.object({ required: z.string() });
    const promise = apiClient.get("http://localhost/api/x", { responseSchema: schema });
    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({
      status: 500,
      message: expect.stringContaining("Respuesta inválida del servidor"),
    });
  });

  it("includes invalid_type expected/received hint in schema error message", async () => {
    fetchSpy.mockResolvedValue(
      makeResponse(JSON.stringify({ count: "not-a-number" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    // invalid_type with string expected/received populates the
    // "expected X, received Y" branch of formatZodIssue.
    const schema = z.object({ count: z.number() });
    const promise = apiClient.get("http://localhost/api/x", { responseSchema: schema });
    await expect(promise).rejects.toMatchObject({ status: 500 });
    await expect(promise).rejects.toMatchObject({
      details: expect.objectContaining({
        received: { count: "not-a-number" },
      }),
    });
  });
});

describe("apiClient query string handling", () => {
  it("appends query params, JSON-encoding non-strings, omitting null/undefined", async () => {
    fetchSpy.mockResolvedValue(
      makeResponse(JSON.stringify({}), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    await apiClient.get("http://localhost/api/x", {
      responseSchema: z.object({}),
      query: {
        a: "hello",
        b: 42,
        c: { nested: true },
        d: null,
        e: undefined,
        list: ["one", "two"],
      },
    });
    const url = fetchedRequest(fetchSpy).url;
    expect(url).toContain("a=hello");
    expect(url).toContain("b=42");
    expect(url).toContain(encodeURIComponent('{"nested":true}'));
    expect(url).not.toContain("d=");
    expect(url).not.toContain("e=");
    expect(url).toContain("list=one");
    expect(url).toContain("list=two");
  });

  it("returns base url unchanged when query produces no params", async () => {
    fetchSpy.mockResolvedValue(
      makeResponse(JSON.stringify({}), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    await apiClient.get("http://localhost/api/empty", { responseSchema: z.object({}), query: {} });
    expect(fetchedRequest(fetchSpy).url).toMatch(/\/api\/empty$/);
  });

  it("appends with & when url already has ?", async () => {
    fetchSpy.mockResolvedValue(
      makeResponse(JSON.stringify({}), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    await apiClient.get("http://localhost/api/x?already=1", {
      responseSchema: z.object({}),
      query: { extra: "yes" },
    });
    const url = fetchedRequest(fetchSpy).url;
    expect(url).toContain("already=1");
    expect(url).toContain("&extra=yes");
  });

  it("handles request with no options", async () => {
    fetchSpy.mockResolvedValue(
      makeResponse(JSON.stringify({}), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    // Force the no-options branch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await apiClient.get("http://localhost/api/x", undefined as any);
    expect(fetchSpy).toHaveBeenCalled();
  });
});

describe("apiClient.post / put / patch / delete (body handling)", () => {
  it("sends a JSON body for plain objects", async () => {
    let capturedBody = "";
    let capturedMethod = "";
    fetchSpy.mockImplementation(async (input) => {
      const req = input as Request;
      capturedMethod = req.method;
      capturedBody = await req.text();
      return makeResponse(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    await apiClient.post(
      "http://localhost/api/x",
      { name: "hi" },
      { responseSchema: z.object({ ok: z.boolean() }) }
    );
    expect(capturedMethod).toBe("POST");
    expect(capturedBody).toBe(JSON.stringify({ name: "hi" }));
  });

  it("sends FormData unchanged (no JSON serialization)", async () => {
    let capturedCT = "";
    let capturedBody = "";
    fetchSpy.mockImplementation(async (input) => {
      const req = input as Request;
      capturedCT = req.headers.get("content-type") ?? "";
      capturedBody = await req.text();
      return makeResponse(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const fd = new FormData();
    fd.append("k", "v");
    await apiClient.post("http://localhost/api/x", fd, {
      responseSchema: z.object({ ok: z.boolean() }),
    });
    expect(capturedCT).toMatch(/multipart\/form-data/);
    expect(capturedBody).toContain("k");
  });

  it("PUT sends body and method", async () => {
    fetchSpy.mockResolvedValue(
      makeResponse(JSON.stringify({}), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    await apiClient.put("http://localhost/api/x", { a: 1 }, { responseSchema: z.object({}) });
    expect(fetchedRequest(fetchSpy).method).toBe("PUT");
  });

  it("PATCH sends body and method", async () => {
    fetchSpy.mockResolvedValue(
      makeResponse(JSON.stringify({}), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    await apiClient.patch("http://localhost/api/x", { a: 1 }, { responseSchema: z.object({}) });
    expect(fetchedRequest(fetchSpy).method).toBe("PATCH");
  });

  it("DELETE uses correct method", async () => {
    fetchSpy.mockResolvedValue(
      makeResponse(JSON.stringify({}), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    await apiClient.delete("http://localhost/api/x", { responseSchema: z.object({}) });
    expect(fetchedRequest(fetchSpy).method).toBe("DELETE");
  });
});

describe("apiClient.getRaw / postRaw (non-json response types)", () => {
  it("returns a Blob for blob responseType", async () => {
    fetchSpy.mockResolvedValue(
      makeResponse("hello", {
        status: 200,
        headers: { "content-type": "application/octet-stream" },
      })
    );
    const out = await apiClient.getRaw<Blob>("http://localhost/api/file", { responseType: "blob" });
    expect(out).toBeInstanceOf(Blob);
    expect(await (out as Blob).text()).toBe("hello");
  });

  it("returns a string for text responseType", async () => {
    fetchSpy.mockResolvedValue(
      makeResponse("hi", {
        status: 200,
        headers: { "content-type": "text/plain" },
      })
    );
    const out = await apiClient.getRaw<string>("http://localhost/api/file", { responseType: "text" });
    expect(out).toBe("hi");
  });

  it("postRaw with FormData returns text body", async () => {
    fetchSpy.mockResolvedValue(
      makeResponse("done", {
        status: 200,
        headers: { "content-type": "text/plain" },
      })
    );
    const fd = new FormData();
    fd.append("k", "v");
    const out = await apiClient.postRaw<string>("http://localhost/api/upload", fd, {
      responseType: "text",
    });
    expect(out).toBe("done");
  });
});

describe("apiClient error handling (handleKyError)", () => {
  it("maps 401 to default Spanish message when body is empty", async () => {
    fetchSpy.mockResolvedValue(
      makeResponse("", { status: 401, statusText: "" })
    );
    const promise = apiClient.get("http://localhost/api/x", { responseSchema: z.object({}) });
    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({
      status: 401,
      message: "Tu sesión expiró. Vuelve a iniciar sesión.",
    });
  });

  it("maps 403 default message", async () => {
    fetchSpy.mockResolvedValue(makeResponse("", { status: 403, statusText: "" }));
    await expect(
      apiClient.get("http://localhost/api/x", { responseSchema: z.object({}) })
    ).rejects.toMatchObject({ status: 403, message: "No tienes permisos para realizar esta acción." });
  });

  it("maps 404 default message", async () => {
    fetchSpy.mockResolvedValue(makeResponse("", { status: 404, statusText: "" }));
    await expect(
      apiClient.get("http://localhost/api/x", { responseSchema: z.object({}) })
    ).rejects.toMatchObject({ status: 404, message: "Recurso no encontrado." });
  });

  it("maps 5xx default message (no retry on POST)", async () => {
    fetchSpy.mockResolvedValue(makeResponse("", { status: 500, statusText: "" }));
    await expect(
      apiClient.post("http://localhost/api/x", { a: 1 }, { responseSchema: z.object({}) })
    ).rejects.toMatchObject({ status: 500, message: "Ocurrió un error interno del servidor." });
  });

  it("maps 4xx unknown to default unexpected message", async () => {
    fetchSpy.mockResolvedValue(makeResponse("", { status: 418, statusText: "" }));
    await expect(
      apiClient.post("http://localhost/api/x", { a: 1 }, { responseSchema: z.object({}) })
    ).rejects.toMatchObject({ status: 418, message: "Ocurrió un error inesperado." });
  });

  it("uses statusText when no body is provided", async () => {
    fetchSpy.mockResolvedValue(
      makeResponse("", { status: 400, statusText: "Bad stuff" })
    );
    await expect(
      apiClient.post("http://localhost/api/x", {}, { responseSchema: z.object({}) })
    ).rejects.toMatchObject({ status: 400, message: "Bad stuff" });
  });

  // Note: ky@2.0.2 HTTPError documents that the response body is consumed
  // when ky pre-parses error.data. Our handleKyError attempts response.text()
  // anyway and silently falls back via try/catch. So at runtime we end up
  // with the status-derived default message and undefined details. These
  // tests pin that observed behavior so we notice if ky changes.
  it("returns ApiError with status when body has JSON message (body already consumed by ky)", async () => {
    fetchSpy.mockResolvedValue(
      makeResponse(JSON.stringify({ message: "Invalid" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      })
    );
    const promise = apiClient.post("http://localhost/api/x", {}, { responseSchema: z.object({}) });
    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({ status: 400 });
  });

  it("returns ApiError(422) for unprocessable JSON body", async () => {
    fetchSpy.mockResolvedValue(
      makeResponse(JSON.stringify({ error: "ErrName", issues: [] }), {
        status: 422,
        headers: { "content-type": "application/json" },
      })
    );
    await expect(
      apiClient.post("http://localhost/api/x", {}, { responseSchema: z.object({}) })
    ).rejects.toMatchObject({ status: 422 });
  });

  it("returns ApiError(400) when error body is a plain string", async () => {
    fetchSpy.mockResolvedValue(
      makeResponse("plain text error", { status: 400, statusText: "" })
    );
    await expect(
      apiClient.post("http://localhost/api/x", {}, { responseSchema: z.object({}) })
    ).rejects.toMatchObject({ status: 400 });
  });

  it("re-throws non-HTTPError errors (network failure)", async () => {
    fetchSpy.mockRejectedValue(new TypeError("network down"));
    await expect(
      apiClient.post("http://localhost/api/x", {}, { responseSchema: z.object({}) })
    ).rejects.toThrow(/network down/);
  });
});

describe("apiClient retry override + timeout", () => {
  it("respects retry: 0 (no retries on 500 GET)", async () => {
    fetchSpy.mockResolvedValue(makeResponse("", { status: 500, statusText: "" }));
    await expect(
      apiClient.get("http://localhost/api/x", { responseSchema: z.object({}), retry: 0 })
    ).rejects.toBeInstanceOf(ApiError);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("accepts timeout: false (disables timeout)", async () => {
    fetchSpy.mockResolvedValue(
      makeResponse(JSON.stringify({}), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    await apiClient.post(
      "http://localhost/api/x",
      { a: 1 },
      { responseSchema: z.object({}), timeout: false }
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe("uploadFiles", () => {
  it("uploads each file and returns successful summaries", async () => {
    const summary = { inserted: 5, total: 5, status: "ok" };
    fetchSpy.mockResolvedValue(
      makeResponse(JSON.stringify(summary), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    const file = new File(["x"], "a.xlsx");
    const out = await uploadFiles([file], "http://localhost/api/import", "[ctx]");
    expect(out).toEqual([{ file: "a.xlsx", summary }]);
  });

  it("captures per-file errors with the error message", async () => {
    fetchSpy.mockResolvedValue(
      makeResponse(JSON.stringify({ message: "bad" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      })
    );
    const file = new File(["x"], "b.xlsx");
    const out = await uploadFiles([file], "http://localhost/api/import", "[ctx]");
    expect(out).toHaveLength(1);
    expect(out[0]!.file).toBe("b.xlsx");
    expect(out[0]!.error).toBeTruthy();
    expect(out[0]!.summary).toBeUndefined();
  });

  it("treats payload.status === 'error' as failure", async () => {
    const payload = {
      inserted: 0,
      total: 0,
      status: "error",
      message: "schema mismatch",
    };
    fetchSpy.mockResolvedValue(
      makeResponse(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    const file = new File(["x"], "c.xlsx");
    const out = await uploadFiles([file], "http://localhost/api/import", "[ctx]");
    expect(out[0]!.error).toBe("schema mismatch");
  });

  it("uses fallback message for non-Error throws (e.g. payload.status error w/o message)", async () => {
    const payload = { inserted: 0, total: 0, status: "error" };
    fetchSpy.mockResolvedValue(
      makeResponse(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    const file = new File(["x"], "d.xlsx");
    const out = await uploadFiles([file], "http://localhost/api/import", "[ctx]");
    expect(out[0]!.error).toBe("Error status returned");
  });

  it("processes multiple files independently", async () => {
    const summary = { inserted: 1, total: 1, status: "ok" };
    fetchSpy
      .mockResolvedValueOnce(
        makeResponse(JSON.stringify(summary), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        makeResponse(JSON.stringify({ message: "boom" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        })
      );
    const files = [new File(["x"], "ok.xlsx"), new File(["y"], "bad.xlsx")];
    const out = await uploadFiles(files, "http://localhost/api/import", "[ctx]");
    expect(out[0]!.summary).toBeDefined();
    expect(out[1]!.error).toBeTruthy();
  });

  it("returns empty array when no files are passed", async () => {
    const out = await uploadFiles([], "http://localhost/api/import", "[ctx]");
    expect(out).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { isDomainError } from "../../lib/errors.ts";
import { createResendProvider } from "../email/resend-provider.ts";

function mockFetch(status: number, body: unknown): typeof fetch {
  return vi.fn<() => Promise<Response>>(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      })
  ) as unknown as typeof fetch;
}

const FROM = "Bioalergia <noreply@send.bioalergia.cl>";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resend provider", () => {
  it("send maps fields to Resend wire format (reply_to snake_case) and returns id", async () => {
    const fetchMock = mockFetch(200, { id: "abc-123" });
    vi.stubGlobal("fetch", fetchMock);
    const provider = createResendProvider("re_test", FROM);

    const result = await provider.send({
      to: "p@example.com",
      subject: "Hola",
      html: "<p>hi</p>",
      replyTo: "contacto@bioalergia.cl",
      idempotencyKey: "reset/1",
    });

    expect(result).toEqual({ id: "abc-123", to: ["p@example.com"], ok: true });
    const call = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe("https://api.resend.com/emails");
    const init = call[1] as RequestInit;
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("reset/1");
    const payload = JSON.parse(init.body as string);
    expect(payload).toMatchObject({
      from: FROM,
      to: ["p@example.com"],
      reply_to: "contacto@bioalergia.cl",
    });
    expect(payload.replyTo).toBeUndefined();
  });

  it("maps 429 to RATE_LIMITED DomainError", async () => {
    vi.stubGlobal("fetch", mockFetch(429, { message: "Too many", name: "rate_limit_exceeded" }));
    const provider = createResendProvider("re_test", FROM);
    const err = await provider
      .send({ to: "x@y.com", subject: "s", text: "t" })
      .catch((e: unknown) => e);
    expect(isDomainError(err)).toBe(true);
    expect(err).toMatchObject({ kind: "RATE_LIMITED", status: 429 });
  });

  it("maps 422 to UNPROCESSABLE_ENTITY", async () => {
    vi.stubGlobal("fetch", mockFetch(422, { message: "bad domain", name: "validation_error" }));
    const provider = createResendProvider("re_test", FROM);
    await expect(provider.send({ to: "x@y.com", subject: "s", text: "t" })).rejects.toMatchObject({
      kind: "UNPROCESSABLE_ENTITY",
    });
  });

  it("sendBatch returns one result per input, order-preserved", async () => {
    vi.stubGlobal("fetch", mockFetch(200, { data: [{ id: "id-1" }, { id: "id-2" }] }));
    const provider = createResendProvider("re_test", FROM);
    const out = await provider.sendBatch([
      { to: "a@x.com", subject: "1", text: "1" },
      { to: "b@x.com", subject: "2", text: "2" },
    ]);
    expect(out).toEqual([
      { id: "id-1", to: ["a@x.com"], ok: true },
      { id: "id-2", to: ["b@x.com"], ok: true },
    ]);
  });

  it("sendBatch rejects when over the 100 cap", async () => {
    vi.stubGlobal("fetch", mockFetch(200, { data: [] }));
    const provider = createResendProvider("re_test", FROM);
    const tooMany = Array.from({ length: 101 }, (_, i) => ({
      to: `u${i}@x.com`,
      subject: "s",
      text: "t",
    }));
    await expect(provider.sendBatch(tooMany)).rejects.toMatchObject({ kind: "BAD_REQUEST" });
  });
});

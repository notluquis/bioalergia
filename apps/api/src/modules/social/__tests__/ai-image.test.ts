import { beforeEach, describe, expect, it, vi } from "vitest";

import { isDomainError } from "../../../lib/errors.ts";

// generateAiImage: pin del contrato de cada proveedor (Gemini inlineData base64
// → Buffer; Recraft url → fetch → Buffer) y del guard sin-key (DomainError).
// fetch global mockeado; nada toca la red real.

const { mockGetAiConfig } = vi.hoisted(() => ({ mockGetAiConfig: vi.fn() }));

vi.mock("../../../lib/logger.ts", () => ({
  logEvent: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));
vi.mock("../../../lib/social-settings.ts", () => ({
  getAiConfig: mockGetAiConfig,
}));

const { generateAiImage } = await import("../ai-image.ts");

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);

function config(over: Record<string, unknown> = {}) {
  return {
    provider: "GEMINI" as const,
    geminiApiKey: "gem-key",
    recraftApiKey: "rec-key",
    hasGeminiKey: true,
    hasRecraftKey: true,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("generateAiImage — Gemini", () => {
  it("decodifica inlineData base64 a Buffer PNG", async () => {
    mockGetAiConfig.mockResolvedValue(config());
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                { inlineData: { mimeType: "image/png", data: PNG_BYTES.toString("base64") } },
              ],
            },
          },
        ],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const buf = await generateAiImage({ prompt: "un consultorio luminoso" });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.equals(PNG_BYTES)).toBe(true);
    // Apunta al endpoint de Nano Banana con la key como query param.
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("gemini-2.5-flash-image:generateContent");
    expect(url).toContain("key=gem-key");
  });

  it("incluye la imagen de referencia como inlineData", async () => {
    mockGetAiConfig.mockResolvedValue(config());
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [
          { content: { parts: [{ inlineData: { data: PNG_BYTES.toString("base64") } }] } },
        ],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await generateAiImage({
      prompt: "x",
      referenceImage: { mimeType: "image/png", data: Buffer.from([1, 2, 3]) },
    });
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    const parts = body.contents[0].parts;
    expect(parts).toHaveLength(2);
    expect(parts[1].inlineData.mimeType).toBe("image/png");
    expect(parts[1].inlineData.data).toBe(Buffer.from([1, 2, 3]).toString("base64"));
  });

  it("lanza UNPROCESSABLE_ENTITY si no hay imagen en la respuesta", async () => {
    mockGetAiConfig.mockResolvedValue(config());
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text: "no img" }] } }] }),
      }))
    );
    await expect(generateAiImage({ prompt: "x" })).rejects.toSatisfy(
      (e) => isDomainError(e) && e.kind === "UNPROCESSABLE_ENTITY"
    );
  });

  it("lanza UNPROCESSABLE_ENTITY si el HTTP no es ok", async () => {
    mockGetAiConfig.mockResolvedValue(config());
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 429, text: async () => "rate limit" }))
    );
    await expect(generateAiImage({ prompt: "x" })).rejects.toSatisfy(
      (e) => isDomainError(e) && e.kind === "UNPROCESSABLE_ENTITY"
    );
  });

  it("sin key de Gemini → BAD_REQUEST (no llama a fetch)", async () => {
    mockGetAiConfig.mockResolvedValue(config({ geminiApiKey: "", hasGeminiKey: false }));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(generateAiImage({ prompt: "x" })).rejects.toSatisfy(
      (e) => isDomainError(e) && e.kind === "BAD_REQUEST"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("generateAiImage — Recraft", () => {
  it("pide la generación y descarga la url → Buffer", async () => {
    mockGetAiConfig.mockResolvedValue(config({ provider: "RECRAFT" }));
    const fetchMock = vi
      .fn()
      // 1ª llamada: generación → { data: [{ url }] }
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ url: "https://img/x.png" }] }),
      })
      // 2ª llamada: descarga de la url → arrayBuffer
      .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => PNG_BYTES.buffer.slice(0) });
    vi.stubGlobal("fetch", fetchMock);

    const buf = await generateAiImage({ prompt: "consultorio" });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstUrl = String(fetchMock.mock.calls[0][0]);
    expect(firstUrl).toContain("recraft.ai");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer rec-key");
    expect(String(fetchMock.mock.calls[1][0])).toBe("https://img/x.png");
  });

  it("override de provider GEMINI→RECRAFT en el input", async () => {
    mockGetAiConfig.mockResolvedValue(config({ provider: "GEMINI" }));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ url: "https://img/x.png" }] }),
      })
      .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => PNG_BYTES.buffer.slice(0) });
    vi.stubGlobal("fetch", fetchMock);
    await generateAiImage({ prompt: "x", provider: "RECRAFT" });
    expect(String(fetchMock.mock.calls[0][0])).toContain("recraft.ai");
  });

  it("sin key de Recraft → BAD_REQUEST", async () => {
    mockGetAiConfig.mockResolvedValue(
      config({ provider: "RECRAFT", recraftApiKey: "", hasRecraftKey: false })
    );
    vi.stubGlobal("fetch", vi.fn());
    await expect(generateAiImage({ prompt: "x" })).rejects.toSatisfy(
      (e) => isDomainError(e) && e.kind === "BAD_REQUEST"
    );
  });

  it("data vacía de Recraft → UNPROCESSABLE_ENTITY", async () => {
    mockGetAiConfig.mockResolvedValue(config({ provider: "RECRAFT" }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ data: [] }) }))
    );
    await expect(generateAiImage({ prompt: "x" })).rejects.toSatisfy(
      (e) => isDomainError(e) && e.kind === "UNPROCESSABLE_ENTITY"
    );
  });
});

describe("generateAiImage — validación", () => {
  it("prompt vacío → BAD_REQUEST", async () => {
    await expect(generateAiImage({ prompt: "   " })).rejects.toSatisfy(
      (e) => isDomainError(e) && e.kind === "BAD_REQUEST"
    );
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

// OAuth de TikTok: exchange code→tokens y refresh proactivo. Verifica que el
// refresh_token rotado se persiste (el más nuevo gana) y que pre-expiración
// dispara el refresh; con token vigente NO se llama a la API.

const { mockDb } = vi.hoisted(() => {
  const mockDb = { socialAccount: { update: vi.fn() } };
  return { mockDb };
});

vi.mock("@finanzas/db", () => ({ db: mockDb }));
vi.mock("@finanzas/db/slices", () => {
  const noopDb = { $setOptions: () => noopDb };
  return { dbClinicalSeries: noopDb };
});
vi.mock("../../../../lib/logger.ts", () => ({
  logEvent: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));
vi.mock("../../../../lib/secret-cipher.ts", () => ({ encryptSecret: (s: string) => `enc:${s}` }));

const { exchangeCodeForTokens, refreshAccessToken, getValidTiktokAccessToken } = await import(
  "../oauth.ts"
);

function mockFetchOnce(json: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok,
      status,
      json: async () => json,
    }))
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("exchangeCodeForTokens", () => {
  it("mapea la respuesta a tokens con expiraciones absolutas", async () => {
    mockFetchOnce({
      open_id: "open_1",
      access_token: "acc_1",
      refresh_token: "ref_1",
      expires_in: 86400,
      refresh_expires_in: 31536000,
      scope: "video.publish",
    });
    const res = await exchangeCodeForTokens({
      clientKey: "ck",
      clientSecret: "cs",
      code: "code123",
      redirectUri: "https://api/cb",
      codeVerifier: "verifier",
    });
    expect(res.openId).toBe("open_1");
    expect(res.accessToken).toBe("acc_1");
    expect(res.refreshToken).toBe("ref_1");
    expect(res.expiresAt).toBeInstanceOf(Date);
    expect(res.refreshExpiresAt).toBeInstanceOf(Date);
  });

  it("lanza si la respuesta no trae tokens", async () => {
    mockFetchOnce({ error: "invalid_grant", error_description: "bad code" });
    await expect(
      exchangeCodeForTokens({
        clientKey: "ck",
        clientSecret: "cs",
        code: "x",
        redirectUri: "r",
        codeVerifier: "v",
      })
    ).rejects.toThrow(/bad code/);
  });
});

describe("refreshAccessToken", () => {
  it("devuelve el refresh_token rotado por TikTok", async () => {
    mockFetchOnce({
      open_id: "open_1",
      access_token: "acc_2",
      refresh_token: "ref_2_rotated",
      expires_in: 86400,
      refresh_expires_in: 31536000,
    });
    const res = await refreshAccessToken({
      clientKey: "ck",
      clientSecret: "cs",
      refreshToken: "ref_1",
    });
    expect(res.accessToken).toBe("acc_2");
    expect(res.refreshToken).toBe("ref_2_rotated"); // rotado
  });
});

describe("getValidTiktokAccessToken", () => {
  const baseAccount = {
    id: 7,
    openId: "open_1",
    accessToken: "acc_current",
    refreshToken: "ref_1",
    clientKey: "ck",
    clientSecret: "cs",
    tokenExpiresAt: null as Date | null,
    refreshExpiresAt: null as Date | null,
  };

  it("token vigente (lejos de expirar) → NO refresca, devuelve el actual", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const token = await getValidTiktokAccessToken({
      ...baseAccount,
      tokenExpiresAt: new Date(Date.now() + 6 * 3600 * 1000),
    });
    expect(token).toBe("acc_current");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockDb.socialAccount.update).not.toHaveBeenCalled();
  });

  it("token por expirar → refresca y persiste el access+refresh nuevos", async () => {
    mockFetchOnce({
      open_id: "open_1",
      access_token: "acc_new",
      refresh_token: "ref_new",
      expires_in: 86400,
      refresh_expires_in: 31536000,
    });
    mockDb.socialAccount.update.mockResolvedValue({});
    const token = await getValidTiktokAccessToken({
      ...baseAccount,
      tokenExpiresAt: new Date(Date.now() + 60 * 1000), // <30min → refresca
    });
    expect(token).toBe("acc_new");
    const data = mockDb.socialAccount.update.mock.calls[0][0].data;
    expect(data.pageAccessToken).toBe("enc:acc_new");
    expect(data.refreshToken).toBe("enc:ref_new");
  });

  it("refresh falla → cae al token actual (no rompe la publicación)", async () => {
    mockFetchOnce({ error: "invalid_grant" }, false, 400);
    const token = await getValidTiktokAccessToken({
      ...baseAccount,
      tokenExpiresAt: new Date(Date.now() + 60 * 1000),
    });
    expect(token).toBe("acc_current");
  });
});

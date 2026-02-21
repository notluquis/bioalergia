import superjson from "superjson";
import { describe, expect, it } from "vitest";
import { normalizeErrorResponse } from "../normalize-error-response";

type MockContext = {
  req: { method: string; path: string };
  res: Response;
};

function createContext({
  body,
  contentType = "application/json",
  path,
  status,
}: {
  body: unknown;
  contentType?: string;
  path: string;
  status: number;
}): MockContext {
  return {
    req: {
      method: "GET",
      path,
    },
    res: new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: {
        "content-type": contentType,
      },
    }),
  };
}

describe("normalizeErrorResponse", () => {
  it("adds code for legacy { error } payload", async () => {
    const c = createContext({
      body: { error: "No se proporcionó ningún archivo" },
      status: 400,
      path: "/api/patients/1/attachments",
    }) as unknown as Parameters<typeof normalizeErrorResponse>[0];

    await normalizeErrorResponse(c);

    expect(await c.res.json()).toEqual({
      status: "error",
      message: "No se proporcionó ningún archivo",
      code: "PATIENT_ATTACHMENT_FILE_REQUIRED",
    });
  });

  it("adds code inside superjson payload from reply()", async () => {
    const serialized = superjson.serialize({ status: "error", message: "Token inválido" });

    const c = createContext({
      body: serialized,
      status: 401,
      path: "/api/auth/me/session",
    }) as unknown as Parameters<typeof normalizeErrorResponse>[0];

    await normalizeErrorResponse(c);

    const json = (await c.res.json()) as {
      json: { code: string; message: string; status: string };
    };

    expect(json.json.status).toBe("error");
    expect(json.json.message).toBe("Token inválido");
    expect(json.json.code).toBe("AUTH_INVALID_TOKEN");
  });

  it("does not modify successful responses", async () => {
    const c = createContext({
      body: { status: "ok" },
      status: 200,
      path: "/api/health",
    }) as unknown as Parameters<typeof normalizeErrorResponse>[0];

    await normalizeErrorResponse(c);

    expect(await c.res.json()).toEqual({ status: "ok" });
  });

  it("does not modify non-json responses", async () => {
    const c = createContext({
      body: "plain-text-error",
      contentType: "text/plain",
      status: 500,
      path: "/api/auth/login",
    }) as unknown as Parameters<typeof normalizeErrorResponse>[0];

    await normalizeErrorResponse(c);

    expect(await c.res.text()).toBe("plain-text-error");
  });

  it("keeps payload unchanged when code is already present", async () => {
    const payload = { status: "error", code: "AUTH_INVALID_TOKEN", message: "Token inválido" };

    const c = createContext({
      body: payload,
      status: 401,
      path: "/api/auth/me/session",
    }) as unknown as Parameters<typeof normalizeErrorResponse>[0];

    await normalizeErrorResponse(c);

    expect(await c.res.json()).toEqual(payload);
  });
});

import { Hono } from "hono";
import superjson from "superjson";
import { describe, expect, it } from "vitest";

import { errorReply } from "../error-reply.ts";

/**
 * error-reply tests.
 *
 * errorReply wraps reply() (which uses superjson serialization).
 * We mount a minimal Hono app to get a real Context and inspect the response.
 */

async function parseBody(res: Response) {
  const json = await res.json();
  // reply() serializes with superjson: unwrap it to get the original data
  return superjson.deserialize(json) as Record<string, unknown>;
}

function makeApp(
  status: number,
  message: string,
  options?: Parameters<typeof errorReply>[3],
) {
  const app = new Hono();
  app.get("/test", (c) => {
    return errorReply(c, status as Parameters<typeof errorReply>[1], message, options);
  });
  return app;
}

describe("error-reply", () => {
  describe("HTTP status → default error code mapping", () => {
    it("maps 400 to BAD_REQUEST", async () => {
      const app = makeApp(400, "bad input");
      const res = await app.request("/test");
      const body = await parseBody(res);
      expect(res.status).toBe(400);
      expect(body.code).toBe("BAD_REQUEST");
    });

    it("maps 401 to UNAUTHORIZED", async () => {
      const app = makeApp(401, "not authenticated");
      const res = await app.request("/test");
      const body = await parseBody(res);
      expect(res.status).toBe(401);
      expect(body.code).toBe("UNAUTHORIZED");
    });

    it("maps 403 to FORBIDDEN", async () => {
      const app = makeApp(403, "access denied");
      const res = await app.request("/test");
      const body = await parseBody(res);
      expect(res.status).toBe(403);
      expect(body.code).toBe("FORBIDDEN");
    });

    it("maps 404 to NOT_FOUND", async () => {
      const app = makeApp(404, "not found");
      const res = await app.request("/test");
      const body = await parseBody(res);
      expect(res.status).toBe(404);
      expect(body.code).toBe("NOT_FOUND");
    });

    it("maps 409 to CONFLICT", async () => {
      const app = makeApp(409, "conflict");
      const res = await app.request("/test");
      const body = await parseBody(res);
      expect(res.status).toBe(409);
      expect(body.code).toBe("CONFLICT");
    });

    it("maps 500 to INTERNAL_ERROR", async () => {
      const app = makeApp(500, "crash");
      const res = await app.request("/test");
      const body = await parseBody(res);
      expect(res.status).toBe(500);
      expect(body.code).toBe("INTERNAL_ERROR");
    });

    it("maps 503 (>= 500) to INTERNAL_ERROR", async () => {
      const app = makeApp(503, "service unavailable");
      const res = await app.request("/test");
      const body = await parseBody(res);
      expect(body.code).toBe("INTERNAL_ERROR");
    });

    it("maps other 4xx codes to REQUEST_ERROR", async () => {
      // 422 Unprocessable Entity — not explicitly mapped
      const app = makeApp(422, "validation failed");
      const res = await app.request("/test");
      const body = await parseBody(res);
      expect(res.status).toBe(422);
      expect(body.code).toBe("REQUEST_ERROR");
    });

    it("maps 429 to REQUEST_ERROR (not explicitly mapped)", async () => {
      const app = makeApp(429, "rate limited");
      const res = await app.request("/test");
      const body = await parseBody(res);
      expect(body.code).toBe("REQUEST_ERROR");
    });
  });

  describe("response shape", () => {
    it("always sets status field to 'error'", async () => {
      const app = makeApp(400, "any message");
      const res = await app.request("/test");
      const body = await parseBody(res);
      expect(body.status).toBe("error");
    });

    it("includes the message in the response body", async () => {
      const app = makeApp(404, "Resource XYZ was not found");
      const res = await app.request("/test");
      const body = await parseBody(res);
      expect(body.message).toBe("Resource XYZ was not found");
    });

    it("does not include 'details' key when options is undefined", async () => {
      const app = makeApp(400, "bad request");
      const res = await app.request("/test");
      const body = await parseBody(res);
      expect(body).not.toHaveProperty("details");
    });

    it("includes details when provided", async () => {
      const app = makeApp(400, "validation error", {
        details: { field: "email", issue: "invalid format" },
      });
      const res = await app.request("/test");
      const body = await parseBody(res);
      expect(body.details).toEqual({ field: "email", issue: "invalid format" });
    });

    it("includes details when details is an array", async () => {
      const app = makeApp(400, "multiple errors", {
        details: ["field A is required", "field B is invalid"],
      });
      const res = await app.request("/test");
      const body = await parseBody(res);
      expect(body.details).toEqual(["field A is required", "field B is invalid"]);
    });

    it("includes details when details is a string", async () => {
      const app = makeApp(500, "crash", { details: "stack trace here" });
      const res = await app.request("/test");
      const body = await parseBody(res);
      expect(body.details).toBe("stack trace here");
    });

    it("does not include details when options.details is undefined", async () => {
      const app = makeApp(500, "crash", { details: undefined });
      const res = await app.request("/test");
      const body = await parseBody(res);
      expect(body).not.toHaveProperty("details");
    });
  });

  describe("custom error code override", () => {
    it("uses the provided code instead of the default", async () => {
      const app = makeApp(400, "wrong tenant", { code: "WRONG_TENANT" });
      const res = await app.request("/test");
      const body = await parseBody(res);
      expect(body.code).toBe("WRONG_TENANT");
    });

    it("uses custom code even for 500 errors", async () => {
      const app = makeApp(500, "db down", { code: "DB_UNAVAILABLE" });
      const res = await app.request("/test");
      const body = await parseBody(res);
      expect(body.code).toBe("DB_UNAVAILABLE");
    });

    it("uses custom code together with details", async () => {
      const app = makeApp(409, "duplicate record", {
        code: "DUPLICATE_RUT",
        details: { rut: "12345678-9" },
      });
      const res = await app.request("/test");
      const body = await parseBody(res);
      expect(body.code).toBe("DUPLICATE_RUT");
      expect(body.details).toEqual({ rut: "12345678-9" });
    });
  });
});

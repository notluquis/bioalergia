import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { csrfDoubleSubmit } from "../csrf-double-submit.ts";

function appWith() {
  const app = new Hono();
  app.use("*", csrfDoubleSubmit());
  app.get("/", (c) => c.text("ok"));
  app.post("/", (c) => c.text("ok"));
  return app;
}

function getCookie(res: Response): string | null {
  const sc = res.headers.get("set-cookie");
  if (!sc) return null;
  const m = sc.match(/csrf_token=([^;]+)/);
  return m ? m[1]! : null;
}

describe("csrfDoubleSubmit", () => {
  it("issues a csrf_token cookie on first GET", async () => {
    const app = appWith();
    const res = await app.request("/", { method: "GET" });
    expect(res.status).toBe(200);
    const cookie = getCookie(res);
    expect(cookie).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects POST without header", async () => {
    const app = appWith();
    const get = await app.request("/", { method: "GET" });
    const cookie = getCookie(get)!;
    const res = await app.request("/", {
      method: "POST",
      headers: { cookie: `csrf_token=${cookie}` },
    });
    expect(res.status).toBe(403);
  });

  it("rejects POST with mismatched header", async () => {
    const app = appWith();
    const get = await app.request("/", { method: "GET" });
    const cookie = getCookie(get)!;
    const res = await app.request("/", {
      method: "POST",
      headers: { cookie: `csrf_token=${cookie}`, "X-CSRF-Token": "bad" },
    });
    expect(res.status).toBe(403);
  });

  it("accepts POST when header matches cookie", async () => {
    const app = appWith();
    const get = await app.request("/", { method: "GET" });
    const cookie = getCookie(get)!;
    const res = await app.request("/", {
      method: "POST",
      headers: { cookie: `csrf_token=${cookie}`, "X-CSRF-Token": cookie },
    });
    expect(res.status).toBe(200);
  });

  it("rejects POST without any cookie", async () => {
    const app = appWith();
    const res = await app.request("/", {
      method: "POST",
      headers: { "X-CSRF-Token": "nope" },
    });
    expect(res.status).toBe(403);
  });
});

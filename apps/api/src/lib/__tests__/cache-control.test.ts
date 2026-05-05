import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { cacheControl } from "../cache-control";

/**
 * cache-control middleware tests.
 *
 * Since cacheControl is a Hono middleware factory we exercise it by mounting it
 * on a minimal Hono app and inspecting the response headers.
 */
describe("cache-control", () => {
  describe("cacheControl middleware", () => {
    it("sets Cache-Control header on GET 200", async () => {
      const app = new Hono();
      app.use("/api/*", cacheControl(60));
      app.get("/api/data", (c) => c.json({ ok: true }));

      const res = await app.request("/api/data");
      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toBe("private, max-age=60");
    });

    it("uses private directive by default", async () => {
      const app = new Hono();
      app.use("*", cacheControl(120));
      app.get("/data", (c) => c.json({ ok: true }));

      const res = await app.request("/data");
      expect(res.headers.get("Cache-Control")).toContain("private");
    });

    it("uses public directive when specified", async () => {
      const app = new Hono();
      app.use("*", cacheControl(300, "public"));
      app.get("/data", (c) => c.json({ ok: true }));

      const res = await app.request("/data");
      expect(res.headers.get("Cache-Control")).toBe("public, max-age=300");
    });

    it("embeds the correct seconds in max-age", async () => {
      const app = new Hono();
      app.use("*", cacheControl(3600));
      app.get("/data", (c) => c.json({ ok: true }));

      const res = await app.request("/data");
      expect(res.headers.get("Cache-Control")).toContain("max-age=3600");
    });

    it("does NOT set Cache-Control header on POST requests", async () => {
      const app = new Hono();
      app.use("*", cacheControl(60));
      app.post("/data", (c) => c.json({ ok: true }));

      const res = await app.request("/data", { method: "POST" });
      // middleware only caches GET 200, so header should not be set
      expect(res.headers.get("Cache-Control")).toBeNull();
    });

    it("does NOT set Cache-Control header on non-200 responses", async () => {
      const app = new Hono();
      app.use("*", cacheControl(60));
      app.get("/missing", (c) => c.json({ error: "not found" }, 404));

      const res = await app.request("/missing");
      expect(res.status).toBe(404);
      expect(res.headers.get("Cache-Control")).toBeNull();
    });

    it("does NOT set Cache-Control header on PUT requests", async () => {
      const app = new Hono();
      app.use("*", cacheControl(60));
      app.put("/data", (c) => c.json({ ok: true }));

      const res = await app.request("/data", { method: "PUT" });
      expect(res.headers.get("Cache-Control")).toBeNull();
    });

    it("does NOT set Cache-Control header on DELETE requests", async () => {
      const app = new Hono();
      app.use("*", cacheControl(60));
      app.delete("/data", (c) => c.json({ ok: true }));

      const res = await app.request("/data", { method: "DELETE" });
      expect(res.headers.get("Cache-Control")).toBeNull();
    });

    it("works with max-age=0 (disables caching)", async () => {
      const app = new Hono();
      app.use("*", cacheControl(0));
      app.get("/data", (c) => c.json({ ok: true }));

      const res = await app.request("/data");
      expect(res.headers.get("Cache-Control")).toBe("private, max-age=0");
    });

    it("can apply different durations on different routes", async () => {
      const app = new Hono();
      app.use("/short/*", cacheControl(10));
      app.use("/long/*", cacheControl(86400, "public"));
      app.get("/short/data", (c) => c.json({ ok: true }));
      app.get("/long/data", (c) => c.json({ ok: true }));

      const short = await app.request("/short/data");
      const long = await app.request("/long/data");

      expect(short.headers.get("Cache-Control")).toBe("private, max-age=10");
      expect(long.headers.get("Cache-Control")).toBe("public, max-age=86400");
    });

    it("does NOT set Cache-Control on 201 responses", async () => {
      const app = new Hono();
      app.use("*", cacheControl(60));
      app.get("/created", (c) => c.json({ ok: true }, 201));

      const res = await app.request("/created");
      expect(res.status).toBe(201);
      expect(res.headers.get("Cache-Control")).toBeNull();
    });

    it("does NOT set Cache-Control on 500 responses", async () => {
      const app = new Hono();
      app.use("*", cacheControl(60));
      app.get("/error", (c) => c.json({ error: "crash" }, 500));

      const res = await app.request("/error");
      expect(res.status).toBe(500);
      expect(res.headers.get("Cache-Control")).toBeNull();
    });
  });
});

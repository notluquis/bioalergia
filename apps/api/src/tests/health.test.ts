import { describe, expect, it, vi } from "vitest";
import { app } from "../app.ts";

// Mock the database to strictly prevent any accidental connections
// even though this test shouldn't touch them. Also mock /slices
// because services/clinical-series transitively pulls it and calls
// db.$setOptions(...) at module-load time. Factories must be self-
// contained (vi.mock hoists, no outer references allowed).
vi.mock("@finanzas/db", () => {
  const noopDb: { $setOptions: () => typeof noopDb } = {
    $setOptions: () => noopDb,
  };
  return { authDb: noopDb, db: noopDb, kysely: {}, schema: {} };
});
vi.mock("@finanzas/db/slices", () => {
  const noopDb: { $setOptions: () => typeof noopDb } = {
    $setOptions: () => noopDb,
  };
  return { dbClinicalSeries: noopDb };
});

describe("API Health Check", () => {
  it("GET /health should return 200 OK", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("GET /api/health should return 200 OK", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Drives MercadoPagoService.listReports end-to-end by stubbing global fetch,
// keyed on whether the request hits /search (available files) or /list
// (generation tasks). Verifies the merge that surfaces in-flight "Generando"
// reports — the behavior the released-money tab was missing.

const ORIGINAL_TOKEN = process.env.MP_ACCESS_TOKEN;

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function stubFetch(byPath: { search: unknown; list: unknown }) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes("/search")) return jsonResponse(byPath.search);
    if (url.includes("/list")) return jsonResponse(byPath.list);
    throw new Error(`unexpected fetch: ${url}`);
  });
}

describe("MercadoPagoService.listReports merge", () => {
  beforeEach(() => {
    process.env.MP_ACCESS_TOKEN = "test-token-abc";
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.MP_ACCESS_TOKEN = ORIGINAL_TOKEN;
  });

  it("prepends in-flight tasks from /list ahead of available /search files", async () => {
    const { MercadoPagoService } = await import("../index.ts");
    stubFetch({
      search: {
        paging: { total: 1 },
        results: [{ id: 1, status: "available", file_name: "release-done.csv" }],
      },
      list: [
        { id: 2, status: "pending", file_name: null, generation_date: "2026-06-08T00:00:00Z" },
        { id: 1, status: "processed", file_name: "release-done.csv" },
      ],
    });

    const out = await MercadoPagoService.listReports("release", { silent: true });

    // pending task first, then the available file
    expect(out.reports).toHaveLength(2);
    expect(out.reports[0]).toMatchObject({ id: 2, status: "pending" });
    expect(out.reports[1]).toMatchObject({ id: 1, file_name: "release-done.csv" });
    // total = search total + the one in-flight task
    expect(out.total).toBe(2);
    // generation_date backfilled into date_created for the UI
    expect(out.reports[0]).toMatchObject({ date_created: "2026-06-08T00:00:00Z" });
  });

  it("dedupes a pending task whose file already shows in /search", async () => {
    const { MercadoPagoService } = await import("../index.ts");
    stubFetch({
      search: {
        paging: { total: 1 },
        results: [{ id: 1, status: "available", file_name: "dup.csv" }],
      },
      // same file_name as the search result → already materialized, not in-flight
      list: [{ id: 1, status: "processing", file_name: "dup.csv" }],
    });

    const out = await MercadoPagoService.listReports("release", { silent: true });

    expect(out.reports).toHaveLength(1);
    expect(out.reports[0]).toMatchObject({ file_name: "dup.csv" });
    expect(out.total).toBe(1);
  });

  it("falls back to the full /list when /search returns no files", async () => {
    const { MercadoPagoService } = await import("../index.ts");
    stubFetch({
      search: { paging: { total: 0 }, results: [] },
      list: [
        { id: 9, status: "processed", file_name: "settle.csv" },
        { id: 10, status: "pending", file_name: null },
      ],
    });

    const out = await MercadoPagoService.listReports("settlement", { silent: true });

    expect(out.reports).toHaveLength(2);
    expect(out.total).toBe(2);
  });
});

// GET /api/diag/heap — gated by header x-diag-token === env DIAG_TOKEN
//
// Returns process.memoryUsage() + v8.getHeapStatistics() snapshot for Railway
// RAM baselining. Temporary instrumentation for the 2026 RAM optimization pass;
// remove once baselines are captured.

import type { Hono } from "hono";
import * as v8 from "node:v8";

export function registerDiagRoutes(app: Hono) {
  app.get("/api/diag/heap", (c) => {
    const token = process.env.DIAG_TOKEN;
    if (!token || c.req.header("x-diag-token") !== token) {
      return c.json({ error: "unauthorized" }, 401);
    }

    const mem = process.memoryUsage();
    const heap = v8.getHeapStatistics();

    return c.json({
      ts: new Date().toISOString(),
      uptime_s: Math.round(process.uptime()),
      pid: process.pid,
      mem: {
        rss_mb: Math.round(mem.rss / 1024 / 1024),
        heapTotal_mb: Math.round(mem.heapTotal / 1024 / 1024),
        heapUsed_mb: Math.round(mem.heapUsed / 1024 / 1024),
        external_mb: Math.round(mem.external / 1024 / 1024),
        arrayBuffers_mb: Math.round(mem.arrayBuffers / 1024 / 1024),
      },
      heap: {
        total_heap_size_mb: Math.round(heap.total_heap_size / 1024 / 1024),
        used_heap_size_mb: Math.round(heap.used_heap_size / 1024 / 1024),
        heap_size_limit_mb: Math.round(heap.heap_size_limit / 1024 / 1024),
        malloced_memory_mb: Math.round(heap.malloced_memory / 1024 / 1024),
        peak_malloced_memory_mb: Math.round(heap.peak_malloced_memory / 1024 / 1024),
        number_of_native_contexts: heap.number_of_native_contexts,
        number_of_detached_contexts: heap.number_of_detached_contexts,
      },
    });
  });
}

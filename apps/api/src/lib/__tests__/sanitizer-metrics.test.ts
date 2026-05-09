import { describe, expect, it } from "vitest";
import { SanitizationAuditLog, SanitizationMonitor, SanitizationRateLimiter } from "../sanitizer-metrics.ts";

describe("SanitizationRateLimiter", () => {
  it("allows operations within limit", () => {
    const limiter = new SanitizationRateLimiter(60000, 5);
    for (let i = 0; i < 5; i++) {
      expect(limiter.isAllowed()).toBe(true);
    }
  });

  it("blocks when limit exceeded", () => {
    const limiter = new SanitizationRateLimiter(60000, 3);
    limiter.isAllowed();
    limiter.isAllowed();
    limiter.isAllowed();
    expect(limiter.isAllowed()).toBe(false);
  });

  it("resets counter after reset()", () => {
    const limiter = new SanitizationRateLimiter(60000, 2);
    limiter.isAllowed();
    limiter.isAllowed();
    expect(limiter.isAllowed()).toBe(false);
    limiter.reset();
    expect(limiter.isAllowed()).toBe(true);
  });
});

describe("SanitizationAuditLog", () => {
  it("logs entries and retrieves them", () => {
    const log = new SanitizationAuditLog();
    log.log({ operation: "sanitize", inputLength: 100, outputLength: 80, durationMs: 5 });
    const entries = log.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.operation).toBe("sanitize");
    expect(entries[0]?.inputLength).toBe(100);
  });

  it("adds timestamp automatically", () => {
    const log = new SanitizationAuditLog();
    const before = Date.now();
    log.log({ operation: "clear", inputLength: 0, outputLength: 0, durationMs: 1 });
    const after = Date.now();
    const ts = log.getEntries()[0]?.timestamp.getTime() ?? 0;
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it("trims entries at maxEntries (circular buffer)", () => {
    const log = new SanitizationAuditLog(3);
    for (let i = 0; i < 5; i++) {
      log.log({ operation: "sanitize", inputLength: i, outputLength: i, durationMs: 1 });
    }
    expect(log.getEntries()).toHaveLength(3);
    expect(log.getEntries()[0]?.inputLength).toBe(2);
  });

  it("clear() removes all entries", () => {
    const log = new SanitizationAuditLog();
    log.log({ operation: "sanitize", inputLength: 10, outputLength: 8, durationMs: 2 });
    log.clear();
    expect(log.getEntries()).toHaveLength(0);
  });
});

describe("SanitizationMonitor", () => {
  it("allows operation and records metrics", () => {
    const monitor = new SanitizationMonitor();
    const result = monitor.checkAndLog("sanitize", 200, 150, 10);
    expect(result.allowed).toBe(true);
    expect(monitor.getMetrics().totalOperations).toBe(1);
  });

  it("reset() clears all state", () => {
    const monitor = new SanitizationMonitor();
    monitor.checkAndLog("sanitize", 100, 90, 5);
    monitor.reset();
    expect(monitor.getMetrics().totalOperations).toBe(0);
    expect(monitor.getAuditEntries()).toHaveLength(0);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createLogger } from "./logger";

describe("logger", () => {
  beforeEach(() => {
    vi.spyOn(console, "debug").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a namespaced logger that prefixes messages", () => {
    const log = createLogger("ns");
    log.warn("hello");
    expect(console.warn).toHaveBeenCalledWith("[ns]", "hello");
  });

  it("creates an unprefixed logger when no namespace is given", () => {
    const log = createLogger();
    log.error("boom");
    expect(console.error).toHaveBeenCalledWith("boom");
  });

  it("error and warn always go through (showInProd=true)", () => {
    const log = createLogger("x");
    log.error("e");
    log.warn("w");
    expect(console.error).toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
  });

  it("info/debug/log methods exist and are callable", () => {
    const log = createLogger();
    expect(() => {
      log.info("i");
      log.debug("d");
      log.log("l");
    }).not.toThrow();
  });

  it("forwards multiple arguments", () => {
    const log = createLogger("multi");
    log.warn("a", "b", 3);
    expect(console.warn).toHaveBeenCalledWith("[multi]", "a", "b", 3);
  });
});

import { ORPCError } from "@orpc/client";
import { beforeEach, describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api-client";

import { patientsORPCClient, toPatientsApiError } from "./orpc";

describe("patients/orpc — module exports", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "location", {
      value: { origin: "https://test.local" },
      configurable: true,
      writable: true,
    });
  });

  it("exposes patientsORPCClient as a callable proxy", () => {
    expect(patientsORPCClient).toBeDefined();
    expect(typeof patientsORPCClient).toMatch(/object|function/);
  });
});

describe("toPatientsApiError", () => {
  it("returns the same instance when given an ApiError (passthrough)", () => {
    const original = new ApiError("nope", 422, { reason: "invalid" });
    const result = toPatientsApiError(original);
    expect(result).toBe(original);
  });

  it("wraps an ORPCError preserving status, message, and data", () => {
    const orpc = new ORPCError("FORBIDDEN", {
      message: "no permission",
      status: 403,
      data: { role: "guest" },
    });
    const result = toPatientsApiError(orpc);
    expect(result).toBeInstanceOf(ApiError);
    expect(result.status).toBe(403);
    expect(result.message).toBe("no permission");
    expect(result.details).toEqual({ role: "guest" });
  });

  it("wraps a generic Error as 500", () => {
    const err = new Error("network down");
    const result = toPatientsApiError(err);
    expect(result).toBeInstanceOf(ApiError);
    expect(result.status).toBe(500);
    expect(result.message).toBe("network down");
    expect(result.details).toBeUndefined();
  });

  it("wraps unknown values as 500 with raw payload in details", () => {
    const raw = 42;
    const result = toPatientsApiError(raw);
    expect(result).toBeInstanceOf(ApiError);
    expect(result.status).toBe(500);
    expect(result.message).toBe("Error inesperado");
    expect(result.details).toBe(raw);
  });

  it("wraps null as 500 with raw payload", () => {
    const result = toPatientsApiError(null);
    expect(result.status).toBe(500);
    expect(result.message).toBe("Error inesperado");
    expect(result.details).toBeNull();
  });
});

// Unreachable from unit tests without a live backend:
//   - patientsORPCLink construction wires csrfFetch + window.location.origin
//     into SuperJSONLink; actual fetch invocation only happens when a client
//     method is awaited against a real (or mocked) network.
//   - createORPCClient<...> returns a Proxy whose internal trap chains run
//     only on real RPC calls.

import { describe, expect, it } from "vitest";
import { AppError } from "../app-error";

describe("AppError", () => {
  it("constructs with status, code and message", () => {
    const err = new AppError(400, { code: "INVALID_INPUT", message: "Bad request" });
    expect(err.code).toBe("INVALID_INPUT");
    expect(err.message).toBe("Bad request");
    expect(err.status).toBe(400);
  });

  it("defaults expose to true for 4xx statuses", () => {
    const err = new AppError(422, { code: "VALIDATION_ERROR", message: "Validation failed" });
    expect(err.expose).toBe(true);
  });

  it("defaults expose to false for 5xx statuses", () => {
    const err = new AppError(500, { code: "INTERNAL_ERROR", message: "Something went wrong" });
    expect(err.expose).toBe(false);
  });

  it("respects explicit expose override", () => {
    const err = new AppError(500, {
      code: "SAFE_ERROR",
      message: "Safe to expose",
      expose: true,
    });
    expect(err.expose).toBe(true);
  });

  it("stores details when provided", () => {
    const details = { field: "email", reason: "invalid format" };
    const err = new AppError(400, { code: "ERR", message: "msg", details });
    expect(err.details).toEqual(details);
  });

  it("details is undefined when not provided", () => {
    const err = new AppError(400, { code: "ERR", message: "msg" });
    expect(err.details).toBeUndefined();
  });

  it("is an instance of Error", () => {
    const err = new AppError(404, { code: "NOT_FOUND", message: "Not found" });
    expect(err).toBeInstanceOf(Error);
  });
});

import { describe, expect, it } from "vitest";

import { formatErrors, hasErrors, stringifyError } from "./form-errors";

describe("stringifyError", () => {
  it("returns string errors unchanged", () => {
    expect(stringifyError("campo requerido")).toBe("campo requerido");
  });

  it("returns Error.message for Error instances", () => {
    expect(stringifyError(new Error("algo salió mal"))).toBe("algo salió mal");
  });

  it("reads message property from plain objects", () => {
    expect(stringifyError({ message: "valor inválido" })).toBe("valor inválido");
  });

  it("reads detail property when message is absent", () => {
    expect(stringifyError({ detail: "detalle del error" })).toBe("detalle del error");
  });

  it("falls back to String() for numbers", () => {
    expect(stringifyError(42)).toBe("42");
  });

  it("falls back to String() for booleans", () => {
    expect(stringifyError(false)).toBe("false");
  });

  it("returns empty string result from String(null) — 'null'", () => {
    // String(null) === "null", which is truthy so returned as-is
    expect(stringifyError(null)).toBe("null");
  });

  it("ignores non-string message properties", () => {
    // message exists but is not a string, then checks detail
    expect(stringifyError({ message: 123, detail: "ok" })).toBe("ok");
  });

  it("handles objects without message or detail", () => {
    const result = stringifyError({ code: 500 });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("formatErrors", () => {
  it("returns empty string for empty array", () => {
    expect(formatErrors([])).toBe("");
  });

  it("joins multiple string errors with ', '", () => {
    expect(formatErrors(["campo requerido", "muy corto"])).toBe("campo requerido, muy corto");
  });

  it("filters out undefined values", () => {
    expect(formatErrors([undefined, "error real"])).toBe("error real");
  });

  it("filters out null values", () => {
    expect(formatErrors([null, "otro error"])).toBe("otro error");
  });

  it("filters out empty string values", () => {
    expect(formatErrors(["", "válido"])).toBe("válido");
  });

  it("handles mixed types (Error object + string)", () => {
    const result = formatErrors([new Error("fallo"), "texto"]);
    expect(result).toBe("fallo, texto");
  });

  it("handles object errors with message property", () => {
    expect(formatErrors([{ message: "dato inválido" }])).toBe("dato inválido");
  });

  it("returns empty string for non-array input", () => {
    // TypeScript prevents this but the function guard handles it at runtime
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(formatErrors(null as unknown as any[])).toBe("");
  });

  it("handles array with all falsy values", () => {
    expect(formatErrors([null, undefined, ""])).toBe("");
  });
});

describe("hasErrors", () => {
  it("returns false for null", () => {
    expect(hasErrors(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(hasErrors(undefined)).toBe(false);
  });

  it("returns false for empty array", () => {
    expect(hasErrors([])).toBe(false);
  });

  it("returns false when all entries are null/undefined/empty", () => {
    expect(hasErrors([null, undefined, ""])).toBe(false);
  });

  it("returns true when at least one real error exists", () => {
    expect(hasErrors([null, "un error"])).toBe(true);
  });

  it("returns true for array with only string errors", () => {
    expect(hasErrors(["requerido"])).toBe(true);
  });

  it("returns true for array with object errors", () => {
    expect(hasErrors([{ message: "oops" }])).toBe(true);
  });

  it("returns true for array with Error instances", () => {
    expect(hasErrors([new Error("boom")])).toBe(true);
  });
});

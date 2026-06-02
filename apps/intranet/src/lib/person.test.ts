import { describe, expect, it } from "vitest";

import {
  extractPersonFromResponse,
  formatPersonDisplay,
  getPersonFullName,
  getPersonInitials,
  toTitleCase,
} from "./person";

describe("toTitleCase", () => {
  it("capitalizes a simple name", () => {
    expect(toTitleCase("MARIA")).toBe("Maria");
  });

  it("capitalizes multi-word names", () => {
    expect(toTitleCase("JUAN PABLO")).toBe("Juan Pablo");
  });

  it("lowercases Spanish particles in mid-position", () => {
    expect(toTitleCase("MARIA DEL PILAR SALAS")).toBe("Maria del Pilar Salas");
  });

  it("handles 'de la' particle combo", () => {
    expect(toTitleCase("CAROLINA DE LA FUENTE")).toBe("Carolina de la Fuente");
  });

  it("lowercases 'van' and 'von' particles", () => {
    expect(toTitleCase("OTTO VON BISMARCK")).toBe("Otto von Bismarck");
  });

  it("returns empty string for empty input", () => {
    expect(toTitleCase("")).toBe("");
  });

  it("returns empty string for null", () => {
    expect(toTitleCase(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(toTitleCase(undefined)).toBe("");
  });

  it("preserves hyphens in compound names", () => {
    const result = toTitleCase("ANNE-MARIE");
    expect(result).toBe("Anne-Marie");
  });

  it("capitalizes first particle if it is the first word", () => {
    // index === 0, so the first word is always capitalized regardless of being a particle
    expect(toTitleCase("DEL MONTE")).toBe("Del Monte");
  });

  it("handles all-lowercase input", () => {
    expect(toTitleCase("pedro del campo")).toBe("Pedro del Campo");
  });

  it("handles 'y' as particle", () => {
    expect(toTitleCase("ROMEO Y JULIETA")).toBe("Romeo y Julieta");
  });

  it("preserves consecutive whitespace as a single separator token", () => {
    // The split captures `\s+` runs; double space must survive verbatim (kills
    // the `\s+`→`\s` and separator-regex mutants).
    expect(toTitleCase("MARIA  JOSE")).toBe("Maria  Jose");
  });

  it("capitalizes the word after a hyphen separator", () => {
    expect(toTitleCase("jose-luis del rio")).toBe("Jose-Luis del Rio");
  });
});

describe("getPersonFullName", () => {
  it("returns empty string for null person", () => {
    expect(getPersonFullName(null)).toBe("");
  });

  it("returns empty string for undefined person", () => {
    expect(getPersonFullName(undefined)).toBe("");
  });

  it("returns empty string when names is missing", () => {
    expect(getPersonFullName({ fatherName: "Garcia", motherName: "Lopez" })).toBe("");
  });

  it("returns names only when surnames are absent", () => {
    expect(getPersonFullName({ names: "Juan" })).toBe("Juan");
  });

  it("combines names and fatherName", () => {
    expect(getPersonFullName({ names: "Carlos", fatherName: "Saez" })).toBe("Carlos Saez");
  });

  it("combines all three parts", () => {
    expect(getPersonFullName({ names: "Ana", fatherName: "Perez", motherName: "Vega" })).toBe(
      "Ana Perez Vega"
    );
  });

  it("ignores empty/whitespace surnames", () => {
    expect(getPersonFullName({ names: "Luis", fatherName: "  ", motherName: "" })).toBe("Luis");
  });

  it("trims whitespace from names", () => {
    expect(getPersonFullName({ names: "  Maria  ", fatherName: "  Castro  " })).toBe(
      "Maria Castro"
    );
  });

  it("trims whitespace from motherName specifically", () => {
    // Kills the `motherName?.trim()` mutant — untrimmed would leak inner spaces.
    expect(getPersonFullName({ names: "Ana", fatherName: "Perez", motherName: "  Vega  " })).toBe(
      "Ana Perez Vega"
    );
  });
});

describe("formatPersonDisplay", () => {
  it("returns full name when available", () => {
    expect(formatPersonDisplay({ names: "Laura", fatherName: "Torres" })).toBe("Laura Torres");
  });

  it("returns 'No identificado' for null", () => {
    expect(formatPersonDisplay(null)).toBe("No identificado");
  });

  it("returns 'No identificado' for undefined", () => {
    expect(formatPersonDisplay(undefined)).toBe("No identificado");
  });

  it("returns 'No identificado' when names is empty", () => {
    expect(formatPersonDisplay({ names: "" })).toBe("No identificado");
  });
});

describe("getPersonInitials", () => {
  it("returns '?' for null person", () => {
    expect(getPersonInitials(null)).toBe("?");
  });

  it("returns '?' for undefined person", () => {
    expect(getPersonInitials(undefined)).toBe("?");
  });

  it("returns '?' when names is not set", () => {
    expect(getPersonInitials({ fatherName: "Garcia" })).toBe("?");
  });

  it("uses first char of names + first char of fatherName", () => {
    expect(getPersonInitials({ names: "Ana", fatherName: "Blanco" })).toBe("AB");
  });

  it("uses first two chars of names when no fatherName", () => {
    expect(getPersonInitials({ names: "Carlos" })).toBe("CA");
  });

  it("returns single initial when names is one character and no fatherName", () => {
    expect(getPersonInitials({ names: "X" })).toBe("X");
  });

  it("uppercases initials regardless of input case", () => {
    expect(getPersonInitials({ names: "ana", fatherName: "blanco" })).toBe("AB");
  });
});

describe("extractPersonFromResponse", () => {
  it("returns null for null input", () => {
    expect(extractPersonFromResponse(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(extractPersonFromResponse(undefined)).toBeNull();
  });

  it("unwraps person from nested response", () => {
    const response = { person: { names: "Sofia", fatherName: "Ruiz" }, extra: "data" };
    expect(extractPersonFromResponse(response)).toEqual({ names: "Sofia", fatherName: "Ruiz" });
  });

  it("returns the object directly when no person key", () => {
    const response = { names: "Pedro", fatherName: "Leal" };
    expect(extractPersonFromResponse(response)).toEqual({ names: "Pedro", fatherName: "Leal" });
  });

  it("returns object directly when person key is null", () => {
    const response = { person: null, names: "Eduardo" };
    expect(extractPersonFromResponse(response)).toEqual({ person: null, names: "Eduardo" });
  });

  it("returns object directly when person key is undefined", () => {
    // Kills the `response.person !== undefined` mutant — without that guard it
    // would unwrap to the undefined person instead of returning the response.
    const response = { person: undefined, names: "Tomas" };
    expect(extractPersonFromResponse(response)).toEqual({ person: undefined, names: "Tomas" });
  });
});

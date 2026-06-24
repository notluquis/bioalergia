import { describe, expect, it } from "vitest";

import { titleFromSlug } from "./slug";

describe("titleFromSlug", () => {
  it("returns an empty string for an empty slug", () => {
    expect(titleFromSlug("")).toBe("");
  });

  it("capitalizes a single word", () => {
    expect(titleFromSlug("rinitis")).toBe("Rinitis");
  });

  it("capitalizes each hyphen-delimited word and joins with spaces", () => {
    expect(titleFromSlug("rinitis-alergica")).toBe("Rinitis Alergica");
  });

  it("handles multiple hyphens / many words", () => {
    expect(titleFromSlug("dermatitis-atopica-en-ninos")).toBe("Dermatitis Atopica En Ninos");
  });

  it("preserves already-capitalized words (only first char is touched)", () => {
    expect(titleFromSlug("ABC-def")).toBe("ABC Def");
  });

  it("collapses consecutive hyphens into empty words (extra spaces)", () => {
    expect(titleFromSlug("a--b")).toBe("A  B");
  });
});
